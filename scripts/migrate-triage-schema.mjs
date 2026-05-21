// One-shot schema migration for the confidence-tiered flag triage pipeline.
// Adds three nullable per-record fields (triage_tier, triage_rationale,
// triage_generated_at) to every flagged annotation record across both
// annotation files, and two nullable file-level fields
// (triage_rubric_version, triage_rubric_sha256). All initial values are
// null — populated later by scripts/triage-annotations.ts.
//
// Idempotent: re-running is safe. Fields that already exist are not
// overwritten; only missing fields are added. Atomic writes via temp +
// rename, matching the existing review-annotations CLI pattern.
//
// Run:
//   node scripts/migrate-triage-schema.mjs
//
// Rationale and dependencies in DECISIONS.md ("Confidence-tiered flag
// triage pipeline") and IMPLEMENTATION_LOG.md.

import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const TARGETS = [
  {
    corpus: 'federalist',
    path: resolve(REPO_ROOT, 'data/federalist/federalist-annotations.json'),
    recordContainers: (file) =>
      // Federalist: papers[].paragraphs[] — paragraphs only, no footnotes.
      file.papers.flatMap((p) => p.paragraphs),
  },
  {
    corpus: 'tocqueville',
    path: resolve(REPO_ROOT, 'data/tocqueville/tocqueville-annotations.json'),
    recordContainers: (file) =>
      // Tocqueville: items[].paragraphs[] AND items[].footnotes[] — both.
      file.items.flatMap((it) => [...it.paragraphs, ...it.footnotes]),
  },
];

const PER_RECORD_FIELDS = ['triage_tier', 'triage_rationale', 'triage_generated_at'];
const FILE_LEVEL_FIELDS = ['triage_rubric_version', 'triage_rubric_sha256'];

function atomicWriteJson(path, obj) {
  const tmp = path + '.tmp';
  writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n');
  renameSync(tmp, path);
}

function addMissingFields(obj, fields) {
  let added = 0;
  for (const f of fields) {
    if (!(f in obj)) {
      obj[f] = null;
      added++;
    }
  }
  return added;
}

// Insert triage_rubric_* fields after prompt_sha256 (where the other
// file-level metadata clusters) rather than at the end of the object.
// JSON.stringify preserves insertion order; rebuilding the top-level
// object is the cleanest way to control placement.
function reorderFileLevelFields(file) {
  const needsInsertion = FILE_LEVEL_FIELDS.some((f) => !(f in file));
  // Idempotent path: if all file-level fields are already present in the
  // intended position (immediately after prompt_sha256), leave alone.
  const keys = Object.keys(file);
  const promptShaIdx = keys.indexOf('prompt_sha256');
  const alreadyOrdered =
    promptShaIdx >= 0 &&
    keys[promptShaIdx + 1] === FILE_LEVEL_FIELDS[0] &&
    keys[promptShaIdx + 2] === FILE_LEVEL_FIELDS[1];
  if (alreadyOrdered && !needsInsertion) return 0;

  const out = {};
  let added = 0;
  for (const k of keys) {
    if (FILE_LEVEL_FIELDS.includes(k)) continue;
    out[k] = file[k];
    if (k === 'prompt_sha256') {
      for (const f of FILE_LEVEL_FIELDS) {
        if (!(f in file)) {
          out[f] = null;
          added++;
        } else {
          out[f] = file[f];
        }
      }
    }
  }
  // Wipe original keys and re-populate in the new order. (Mutating in
  // place because the caller holds the reference.)
  for (const k of Object.keys(file)) delete file[k];
  Object.assign(file, out);
  return added;
}

function migrateFile({ corpus, path, recordContainers }) {
  const raw = readFileSync(path, 'utf8');
  const file = JSON.parse(raw);

  const fileLevelAdded = reorderFileLevelFields(file);

  const records = recordContainers(file);
  let recordsTouched = 0;
  let fieldsAdded = 0;
  for (const rec of records) {
    const added = addMissingFields(rec, PER_RECORD_FIELDS);
    if (added > 0) {
      recordsTouched++;
      fieldsAdded += added;
    }
  }

  atomicWriteJson(path, file);

  // Verification — every record now has all three fields.
  const reread = JSON.parse(readFileSync(path, 'utf8'));
  const verifyRecords = recordContainers(reread);
  for (const rec of verifyRecords) {
    for (const f of PER_RECORD_FIELDS) {
      if (!(f in rec)) {
        throw new Error(`verification failed: ${corpus} record missing field ${f}`);
      }
    }
  }
  for (const f of FILE_LEVEL_FIELDS) {
    if (!(f in reread)) {
      throw new Error(`verification failed: ${corpus} file missing field ${f}`);
    }
  }

  return {
    corpus,
    totalRecords: records.length,
    fileLevelFieldsAdded: fileLevelAdded,
    recordsTouched,
    fieldsAdded,
  };
}

function main() {
  console.log('Triage schema migration — adding nullable fields to annotation files.');
  console.log('');
  for (const target of TARGETS) {
    const result = migrateFile(target);
    console.log(`[${result.corpus}]`);
    console.log(`  total records:              ${result.totalRecords}`);
    console.log(`  file-level fields added:    ${result.fileLevelFieldsAdded} (of ${FILE_LEVEL_FIELDS.length})`);
    console.log(`  records touched:            ${result.recordsTouched}`);
    console.log(`  per-record fields added:    ${result.fieldsAdded}`);
    console.log('');
  }
  console.log('Done. All annotation records now have triage_tier, triage_rationale, triage_generated_at (null).');
  console.log('All annotation files now have triage_rubric_version, triage_rubric_sha256 (null).');
}

main();
