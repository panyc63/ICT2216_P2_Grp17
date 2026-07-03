// Minimal, dependency-free QR Code generator (byte mode, error-correction level M, versions
// 1–9). Enough for a short verify URL (~<100 bytes). No npm package — implemented from the
// ISO/IEC 18004 spec so we don't pull in a third-party dependency.
//
// Public API:
//   qrMatrix(text) -> { size, modules }   // modules[r][c] === true means a dark module
//   qrSvg(text, opts) -> string           // a self-contained <svg> string

// --- Galois field GF(256) for Reed–Solomon ---------------------------------
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(function initGf() {
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d; // primitive polynomial
  }
  for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255];
})();
const gfMul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

// Reed–Solomon generator polynomial of a given degree.
function rsGenerator(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i += 1) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j += 1) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

// Standard polynomial division remainder = EC codewords.
function polyDiv(data, gen, ecLen) {
  const buf = data.concat(new Array(ecLen).fill(0));
  for (let i = 0; i < data.length; i += 1) {
    const coef = buf[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j += 1) buf[i + j] ^= gfMul(gen[j], coef);
    }
  }
  return buf.slice(data.length);
}

// --- Version tables (ECC level M, versions 1–9) ----------------------------
// [ ecPerBlock, group1Blocks, group1DataPerBlock, group2Blocks, group2DataPerBlock ]
const EC_M = {
  1: [10, 1, 16, 0, 0],
  2: [16, 1, 28, 0, 0],
  3: [26, 1, 44, 0, 0],
  4: [18, 2, 32, 0, 0],
  5: [24, 2, 43, 0, 0],
  6: [16, 4, 27, 0, 0],
  7: [18, 4, 31, 0, 0],
  8: [22, 2, 38, 2, 39],
  9: [22, 3, 36, 2, 37],
};
const ALIGN = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
  6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46],
};
const totalDataCodewords = (v) => {
  const [, g1b, g1d, g2b, g2d] = EC_M[v];
  return g1b * g1d + g2b * g2d;
};

function chooseVersion(byteLen) {
  const need = 4 + 8 + byteLen * 8; // mode(4) + count(8, valid for v1–9 byte mode) + data
  for (let v = 1; v <= 9; v += 1) {
    if (totalDataCodewords(v) * 8 >= need) return v;
  }
  throw new Error('QR payload too large for supported versions (1–9).');
}

// --- Bit buffer ------------------------------------------------------------
function encodeData(text, version) {
  const bytes = new TextEncoder().encode(text);
  const bits = [];
  const push = (val, len) => { for (let i = len - 1; i >= 0; i -= 1) bits.push((val >> i) & 1); };
  push(0b0100, 4);          // byte mode
  push(bytes.length, 8);    // char count (8 bits for v1–9)
  for (const b of bytes) push(b, 8);
  const cap = totalDataCodewords(version) * 8;
  push(0, Math.min(4, cap - bits.length)); // terminator
  while (bits.length % 8 !== 0) bits.push(0);
  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j += 1) byte = (byte << 1) | bits[i + j];
    codewords.push(byte);
  }
  const pad = [0xec, 0x11];
  let pi = 0;
  while (codewords.length < totalDataCodewords(version)) { codewords.push(pad[pi % 2]); pi += 1; }
  return codewords;
}

// Split into blocks, add EC, interleave (per spec).
function buildCodewords(dataCodewords, version) {
  const [ecLen, g1b, g1d, g2b, g2d] = EC_M[version];
  const blocks = [];
  let idx = 0;
  for (let i = 0; i < g1b; i += 1) { blocks.push(dataCodewords.slice(idx, idx + g1d)); idx += g1d; }
  for (let i = 0; i < g2b; i += 1) { blocks.push(dataCodewords.slice(idx, idx + g2d)); idx += g2d; }
  const ecBlocks = blocks.map((b) => polyDiv(b, rsGenerator(ecLen), ecLen));
  const maxData = Math.max(...blocks.map((b) => b.length));
  const out = [];
  for (let i = 0; i < maxData; i += 1) for (const b of blocks) if (i < b.length) out.push(b[i]);
  for (let i = 0; i < ecLen; i += 1) for (const eb of ecBlocks) out.push(eb[i]);
  return out;
}

// --- Matrix construction ---------------------------------------------------
function makeMatrix(version, finalCodewords) {
  const size = version * 4 + 17;
  const m = Array.from({ length: size }, () => new Array(size).fill(null)); // null = free
  const reserved = Array.from({ length: size }, () => new Array(size).fill(false));

  const place = (r, c, dark) => { m[r][c] = dark; reserved[r][c] = true; };

  // Finder pattern + separator at a top-left origin.
  const finder = (r0, c0) => {
    for (let r = -1; r <= 7; r += 1) for (let c = -1; c <= 7; c += 1) {
      const rr = r0 + r; const cc = c0 + c;
      if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
      const inRing = (r >= 0 && r <= 6 && (c === 0 || c === 6)) || (c >= 0 && c <= 6 && (r === 0 || r === 6));
      const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      place(rr, cc, inRing || inCore);
    }
  };
  finder(0, 0); finder(0, size - 7); finder(size - 7, 0);

  // Timing patterns.
  for (let i = 8; i < size - 8; i += 1) {
    if (!reserved[6][i]) place(6, i, i % 2 === 0);
    if (!reserved[i][6]) place(i, 6, i % 2 === 0);
  }

  // Alignment patterns.
  const centers = ALIGN[version];
  for (const r of centers) for (const c of centers) {
    if (reserved[r][c]) continue; // skip ones overlapping finders
    for (let dr = -2; dr <= 2; dr += 1) for (let dc = -2; dc <= 2; dc += 1) {
      const ring = Math.max(Math.abs(dr), Math.abs(dc));
      place(r + dr, c + dc, ring !== 1);
    }
  }

  // Dark module.
  place(size - 8, 8, true);

  // Reserve format-info areas (filled later).
  const reserveFormat = () => {
    for (let i = 0; i <= 8; i += 1) {
      if (!reserved[8][i]) reserved[8][i] = true;
      if (!reserved[i][8]) reserved[i][8] = true;
    }
    for (let i = 0; i < 8; i += 1) {
      reserved[8][size - 1 - i] = true;
      reserved[size - 1 - i][8] = true;
    }
  };
  reserveFormat();

  // Place data bits (zigzag, upward/downward columns, skipping column 6).
  const bits = [];
  for (const cw of finalCodewords) for (let i = 7; i >= 0; i -= 1) bits.push((cw >> i) & 1);
  let bitIdx = 0;
  let upward = true;
  for (let col = size - 1; col > 0; col -= 2) {
    const c = col === 6 ? col - 1 : col; // skip timing column
    for (let i = 0; i < size; i += 1) {
      const row = upward ? size - 1 - i : i;
      for (let k = 0; k < 2; k += 1) {
        const cc = c - k;
        if (reserved[row][cc]) continue;
        m[row][cc] = bitIdx < bits.length ? bits[bitIdx] === 1 : false;
        bitIdx += 1;
      }
    }
    upward = !upward;
  }

  return { size, m, reserved };
}

const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function applyMask(base, maskFn) {
  const size = base.size;
  const g = Array.from({ length: size }, (_, r) => base.m[r].slice());
  for (let r = 0; r < size; r += 1) for (let c = 0; c < size; c += 1) {
    if (!base.reserved[r][c] && maskFn(r, c)) g[r][c] = g[r][c] ? 0 : 1;
    g[r][c] = g[r][c] ? 1 : 0;
  }
  return g;
}

function penalty(g) {
  const size = g.length;
  let score = 0;
  // Rule 1: runs of 5+.
  for (let r = 0; r < size; r += 1) {
    for (let dir = 0; dir < 2; dir += 1) {
      let run = 1;
      for (let c = 1; c < size; c += 1) {
        const a = dir === 0 ? g[r][c] : g[c][r];
        const b = dir === 0 ? g[r][c - 1] : g[c - 1][r];
        if (a === b) { run += 1; if (run === 5) score += 3; else if (run > 5) score += 1; }
        else run = 1;
      }
    }
  }
  // Rule 2: 2x2 blocks.
  for (let r = 0; r < size - 1; r += 1) for (let c = 0; c < size - 1; c += 1) {
    if (g[r][c] === g[r][c + 1] && g[r][c] === g[r + 1][c] && g[r][c] === g[r + 1][c + 1]) score += 3;
  }
  // Rule 4: proportion of dark modules.
  let dark = 0;
  for (let r = 0; r < size; r += 1) for (let c = 0; c < size; c += 1) dark += g[r][c];
  const pct = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(pct - 50) / 5) * 10;
  return score;
}

// BCH-encoded 15-bit format string for level M (bits 00) + mask (0–7).
function formatBits(mask) {
  const data = (0b00 << 3) | mask; // level M = 00
  let rem = data;
  for (let i = 0; i < 10; i += 1) rem = (rem << 1) ^ ((rem >> 9) & 1 ? 0b10100110111 : 0);
  const bits = ((data << 10) | rem) ^ 0b101010000010010;
  return bits & 0x7fff;
}

function placeFormat(g, mask) {
  const size = g.length;
  const bits = formatBits(mask);
  const bit = (i) => (bits >> i) & 1;
  for (let i = 0; i < 15; i += 1) {
    const b = bit(i);
    // Vertical strip in column 8 (skips the timing row at index 6).
    if (i < 6) g[i][8] = b;
    else if (i < 8) g[i + 1][8] = b;
    else g[size - 15 + i][8] = b;
    // Horizontal strip in row 8 (skips the timing column).
    if (i < 8) g[8][size - i - 1] = b;
    else if (i < 9) g[8][7] = b;
    else g[8][14 - i] = b;
  }
  g[size - 8][8] = 1; // fixed dark module
  return g;
}

export function qrMatrix(text) {
  const version = chooseVersion(new TextEncoder().encode(text).length);
  const data = encodeData(text, version);
  const finalCw = buildCodewords(data, version);
  const base = makeMatrix(version, finalCw);
  let best = null;
  for (let mask = 0; mask < 8; mask += 1) {
    const g = placeFormat(applyMask(base, MASKS[mask]), mask);
    const score = penalty(g);
    if (!best || score < best.score) best = { g, score };
  }
  return { size: base.size, modules: best.g.map((row) => row.map((v) => v === 1)) };
}

// Render to a compact, self-contained SVG string (crisp black modules on white + quiet zone).
export function qrSvg(text, { moduleSize = 4, margin = 4, color = '#0f172a' } = {}) {
  const { size, modules } = qrMatrix(text);
  const dim = (size + margin * 2) * moduleSize;
  let rects = '';
  for (let r = 0; r < size; r += 1) for (let c = 0; c < size; c += 1) {
    if (modules[r][c]) {
      const x = (c + margin) * moduleSize;
      const y = (r + margin) * moduleSize;
      rects += `<rect x="${x}" y="${y}" width="${moduleSize}" height="${moduleSize}"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${dim}" height="${dim}" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="${dim}" height="${dim}" fill="#ffffff"/><g fill="${color}">${rects}</g></svg>`;
}
