#!/usr/bin/env node
// verify-pipeline-integrity.mjs
// Guards MediFlow's security pipeline against silent regressions in CI config.
//
// It parses every .github/workflows/*.yml and asserts:
//
//   (a) PRESENCE + MAIN TRIGGER
//       The security workflows gitleaks, semgrep, container-scan and zap-dast
//       all exist and are triggered on the "main" branch (via push and/or
//       pull_request whose branch filter includes main, or an unfiltered
//       push/pull_request which implicitly covers main).
//
//   (b) HARD GATES MUST BLOCK
//       The hard-gate workflows gitleaks, container-scan and codeql contain
//       NO `continue-on-error: true` anywhere (job- or step-level). If they did,
//       a failing scan would not block a merge.
//
//   (c) INFORMATIONAL GATES ARE ALLOWED TO SOFT-FAIL
//       semgrep and zap-dast MAY use continue-on-error (they are informational),
//       so they are never failed on that basis.
//
// Exit 0 + "pipeline integrity OK" when everything holds; otherwise a clear
// report is printed and the process exits 1.

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, basename } from 'node:path';
import yaml from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
// ops/security/ -> repo root is two levels up.
const REPO_ROOT = resolve(__dirname, '..', '..');
const WORKFLOWS_DIR = join(REPO_ROOT, '.github', 'workflows');

// Logical id -> how to recognise its workflow. A workflow matches a scanner if
// its filename OR its `name:` matches any of the given (lower-cased) regexes.
// Patterns are deliberately specific so codeql and semgrep never collide even
// though both carry a "(SAST)" suffix in their display name.
const SCANNERS = {
  gitleaks: [/gitleaks/, /secret[\s_-]*scan/],
  semgrep: [/semgrep/],
  'container-scan': [/container[\s_-]*scan/, /container\s*&?\s*iac/, /trivy/],
  'zap-dast': [/zap/, /\bdast\b/],
  codeql: [/codeql/],
};

// Scanners that MUST be present and trigger on main.
const REQUIRED_ON_MAIN = ['gitleaks', 'semgrep', 'container-scan', 'zap-dast'];

// Scanners that MUST NOT contain continue-on-error: true (hard gates).
const HARD_GATES = ['gitleaks', 'container-scan', 'codeql'];

function listWorkflowFiles() {
  let entries;
  try {
    entries = readdirSync(WORKFLOWS_DIR);
  } catch (err) {
    console.error(`Cannot read workflows directory ${WORKFLOWS_DIR}: ${err.message}`);
    process.exit(1);
  }
  return entries
    .filter((f) => /\.ya?ml$/i.test(f))
    .map((f) => join(WORKFLOWS_DIR, f));
}

function loadWorkflow(path) {
  const raw = readFileSync(path, 'utf8');
  let doc;
  try {
    doc = yaml.load(raw);
  } catch (err) {
    console.error(`Failed to parse YAML in ${basename(path)}: ${err.message}`);
    process.exit(1);
  }
  return { path, raw, doc: doc && typeof doc === 'object' ? doc : {} };
}

// Does this workflow correspond to the given scanner id?
function matchesScanner(wf, scannerId) {
  const patterns = SCANNERS[scannerId];
  const file = basename(wf.path).toLowerCase();
  const name = typeof wf.doc.name === 'string' ? wf.doc.name.toLowerCase() : '';
  return patterns.some((re) => re.test(file) || re.test(name));
}

// GitHub normalises the `on:` key; because YAML 1.1 parses a bare `on` as the
// boolean true, js-yaml exposes the trigger block under either "on" or true.
function getTriggers(doc) {
  if (doc.on !== undefined) return doc.on;
  if (doc[true] !== undefined) return doc[true];
  return undefined;
}

function branchesInclude(branchesNode, target) {
  if (branchesNode === undefined || branchesNode === null) {
    // No branch filter -> event fires on all branches, including main.
    return true;
  }
  const arr = Array.isArray(branchesNode) ? branchesNode : [branchesNode];
  return arr.some((b) => {
    const s = String(b);
    if (s === target) return true;
    // Treat simple wildcards ("*", "**", "ma*") as matching main.
    if (s.includes('*')) {
      const re = new RegExp('^' + s.replace(/\*+/g, '.*') + '$');
      return re.test(target);
    }
    return false;
  });
}

// Is this workflow triggered on the `main` branch via push or pull_request?
function triggersOnMain(doc) {
  const on = getTriggers(doc);
  if (on === undefined || on === null) return false;

  // Shorthand: `on: push` or `on: [push, pull_request]` (no branch filter).
  if (typeof on === 'string') {
    return on === 'push' || on === 'pull_request';
  }
  if (Array.isArray(on)) {
    return on.includes('push') || on.includes('pull_request');
  }

  // Mapping form: inspect push / pull_request entries.
  for (const evt of ['push', 'pull_request']) {
    if (!(evt in on)) continue;
    const cfg = on[evt];
    // `push:` with an empty/null value -> fires on all branches.
    if (cfg === null || cfg === undefined) return true;
    if (typeof cfg === 'object' && !Array.isArray(cfg)) {
      if (branchesInclude(cfg.branches, 'main')) return true;
      // branches-ignore that does not list main still allows main.
      if (cfg['branches-ignore'] !== undefined) {
        const ignored = Array.isArray(cfg['branches-ignore'])
          ? cfg['branches-ignore']
          : [cfg['branches-ignore']];
        if (!ignored.map(String).includes('main')) return true;
      }
      // Event present with no branch constraints at all.
      if (cfg.branches === undefined && cfg['branches-ignore'] === undefined) return true;
    } else {
      // e.g. `push: [main]` style is unusual, but handle gracefully.
      if (branchesInclude(cfg, 'main')) return true;
    }
  }
  return false;
}

// Detect `continue-on-error: true` anywhere in the workflow. We walk the parsed
// object (so commented-out occurrences do not count) and normalise the value,
// accepting the YAML-1.1 truthy spellings just in case.
function hasContinueOnErrorTrue(node) {
  if (node === null || typeof node !== 'object') return false;
  if (Array.isArray(node)) {
    return node.some((item) => hasContinueOnErrorTrue(item));
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === 'continue-on-error') {
      if (value === true) return true;
      if (typeof value === 'string' && /^(true|yes|on)$/i.test(value.trim())) return true;
      // Expression like ${{ ... }} is treated as "possibly true" -> flag it,
      // because a hard gate must be unconditionally blocking.
      if (typeof value === 'string' && value.includes('${{')) return true;
    }
    if (value && typeof value === 'object' && hasContinueOnErrorTrue(value)) {
      return true;
    }
  }
  return false;
}

function main() {
  const workflows = listWorkflowFiles().map(loadWorkflow);

  // Index workflows by scanner id (a scanner may map to >1 file; keep all).
  const byScanner = {};
  for (const id of Object.keys(SCANNERS)) {
    byScanner[id] = workflows.filter((wf) => matchesScanner(wf, id));
  }

  const problems = [];

  // (a) Presence + main trigger.
  for (const id of REQUIRED_ON_MAIN) {
    const matches = byScanner[id];
    if (matches.length === 0) {
      problems.push(`Required security workflow "${id}" was not found in .github/workflows/.`);
      continue;
    }
    const onMain = matches.some((wf) => triggersOnMain(wf.doc));
    if (!onMain) {
      const files = matches.map((wf) => basename(wf.path)).join(', ');
      problems.push(
        `Security workflow "${id}" (${files}) is not triggered on the main branch ` +
          `(needs push or pull_request with branches including main).`
      );
    }
  }

  // (b) Hard gates must not soft-fail.
  for (const id of HARD_GATES) {
    const matches = byScanner[id];
    if (matches.length === 0) {
      problems.push(`Hard-gate workflow "${id}" was not found in .github/workflows/.`);
      continue;
    }
    for (const wf of matches) {
      if (hasContinueOnErrorTrue(wf.doc)) {
        problems.push(
          `Hard-gate workflow "${id}" (${basename(wf.path)}) contains ` +
            `continue-on-error: true — it must fail the pipeline on findings.`
        );
      }
    }
  }

  // (c) semgrep / zap-dast are informational: intentionally not checked for
  // continue-on-error.

  if (problems.length > 0) {
    console.error('PIPELINE INTEGRITY CHECK FAILED');
    console.error('================================');
    for (const p of problems) {
      console.error(`  - ${p}`);
    }
    console.error('');
    console.error(`Scanned ${workflows.length} workflow file(s) in ${WORKFLOWS_DIR}.`);
    process.exit(1);
  }

  console.log('pipeline integrity OK');
  process.exit(0);
}

main();
