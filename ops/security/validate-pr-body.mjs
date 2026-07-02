#!/usr/bin/env node
// validate-pr-body.mjs
// Enforces that a pull-request body contains the three governance sections
// required by MediFlow's PR template, each with non-empty content:
//   ## Description
//   ## Testing Completed
//   ## Security Impact
//
// Input resolution (in order):
//   1. process.env.PR_BODY
//   2. a file path passed as argv[2] (the body is read from that file)
//
// Exit codes:
//   0 -> all three sections present with content
//   1 -> one or more sections missing or empty (per-section message printed)

import { readFileSync } from 'node:fs';

// Exact H2 headings that must be present, in the order we report them.
const REQUIRED_SECTIONS = ['Description', 'Testing Completed', 'Security Impact'];

function loadBody() {
  const fromEnv = process.env.PR_BODY;
  if (typeof fromEnv === 'string' && fromEnv.length > 0) {
    return fromEnv;
  }

  const fromArg = process.argv[2];
  if (fromArg) {
    try {
      return readFileSync(fromArg, 'utf8');
    } catch (err) {
      console.error(`Could not read PR body file "${fromArg}": ${err.message}`);
      process.exit(1);
    }
  }

  return '';
}

// Split the body into H2 sections. Returns a Map of heading-text -> body-text.
// A heading is a line beginning with exactly "## " (optionally indented/trailing
// whitespace). Everything up to the next H2 (or a higher-level "# ") heading is
// that section's content. Higher-level H1 headings terminate a section too.
function extractSections(body) {
  const lines = body.split(/\r?\n/);
  const sections = new Map();
  let currentHeading = null;
  let buffer = [];

  const flush = () => {
    if (currentHeading !== null) {
      sections.set(currentHeading, buffer.join('\n'));
    }
  };

  const h2Re = /^\s*##\s+(.+?)\s*$/;
  // An H1 (single #) closes the current H2 section but starts no new H2.
  const h1Re = /^\s*#\s+(?!#)/;

  for (const line of lines) {
    const h2 = line.match(h2Re);
    if (h2) {
      flush();
      currentHeading = h2[1].trim();
      buffer = [];
      continue;
    }
    if (h1Re.test(line)) {
      flush();
      currentHeading = null;
      buffer = [];
      continue;
    }
    if (currentHeading !== null) {
      buffer.push(line);
    }
  }
  flush();

  return sections;
}

// A section "has content" if, after stripping HTML comments and whitespace,
// anything remains. This prevents an empty heading (or one that only contains
// the template's <!-- ... --> guidance comment) from passing.
function hasContent(text) {
  if (typeof text !== 'string') return false;
  const withoutComments = text.replace(/<!--[\s\S]*?-->/g, '');
  return withoutComments.trim().length > 0;
}

function main() {
  const body = loadBody();
  const sections = extractSections(body);

  const errors = [];
  for (const name of REQUIRED_SECTIONS) {
    if (!sections.has(name)) {
      errors.push(`Missing required section: "## ${name}"`);
    } else if (!hasContent(sections.get(name))) {
      errors.push(`Section "## ${name}" is present but empty (add a real description, not just a comment).`);
    }
  }

  if (errors.length > 0) {
    console.error('PR body validation FAILED:');
    for (const e of errors) {
      console.error(`  - ${e}`);
    }
    console.error('');
    console.error('The PR description must contain these H2 sections with content:');
    for (const name of REQUIRED_SECTIONS) {
      console.error(`  ## ${name}`);
    }
    process.exit(1);
  }

  console.log('PR body validation OK: all required sections present with content.');
  process.exit(0);
}

main();
