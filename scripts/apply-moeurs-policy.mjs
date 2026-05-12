import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TARGET = resolve(__dirname, '../data/tocqueville/tocqueville-annotations.json');

const EDITORIAL_NOTE =
  'Render "moeurs" as "mores" throughout — direct Latin cognate, carries all three senses (manners, morals, customs), recognized by the target audience, reads more naturally in English prose than the untranslated French.';

const REWRITTEN_FLAG_NOTE =
  '"moeurs" rendered as "mores" per standing convention — direct Latin cognate, carries all three senses (manners, morals, customs). Recurs throughout the volume.';

const SPECIAL_FLAG_REWRITE = {
  itemId: 'tocqueville:vol1.part2.ch3',
  paragraphIndex: 1,
};

function flagMentionsMoeurs(flag) {
  const f = (flag.french ?? '').toLowerCase();
  const n = (flag.note ?? '').toLowerCase();
  return f.includes('moeurs') || f.includes('mœurs') || n.includes('moeurs') || n.includes('mœurs');
}

function unitMatches(unit) {
  return Array.isArray(unit.flags) && unit.flags.some(flagMentionsMoeurs);
}

function main() {
  const raw = readFileSync(TARGET, 'utf8');
  const data = JSON.parse(raw);
  const before = JSON.parse(raw);

  const affected = [];

  for (const item of data.items) {
    for (const p of item.paragraphs ?? []) {
      if (unitMatches(p)) {
        p.editorial_status = 'flagged_for_rewrite';
        p.editorial_note = EDITORIAL_NOTE;
        affected.push({ kind: 'paragraph', item: item.item_id, idx: p.paragraph_index });

        if (item.item_id === SPECIAL_FLAG_REWRITE.itemId && p.paragraph_index === SPECIAL_FLAG_REWRITE.paragraphIndex) {
          for (const flag of p.flags) {
            if (flagMentionsMoeurs(flag)) {
              flag.note = REWRITTEN_FLAG_NOTE;
            }
          }
        }
      }
    }
    for (const fn of item.footnotes ?? []) {
      if (unitMatches(fn)) {
        fn.editorial_status = 'flagged_for_rewrite';
        fn.editorial_note = EDITORIAL_NOTE;
        affected.push({ kind: 'footnote', item: item.item_id, marker: fn.marker });
      }
    }
  }

  verifyOnlyExpectedChanges(before, data, affected);

  writeFileSync(TARGET, JSON.stringify(data, null, 2) + '\n');

  console.log(`Wrote ${TARGET}`);
  console.log(`Affected units: ${affected.length}`);
  const paraCount = affected.filter((a) => a.kind === 'paragraph').length;
  const fnCount = affected.filter((a) => a.kind === 'footnote').length;
  console.log(`  paragraphs: ${paraCount}`);
  console.log(`  footnotes:  ${fnCount}`);
}

function verifyOnlyExpectedChanges(before, after, affected) {
  const affectedKey = new Set(
    affected.map((a) => (a.kind === 'paragraph' ? `${a.item}::p::${a.idx}` : `${a.item}::f::${a.marker}`)),
  );

  if (before.items.length !== after.items.length) throw new Error('items length changed');

  for (let i = 0; i < before.items.length; i++) {
    const b = before.items[i];
    const a = after.items[i];
    if (b.item_id !== a.item_id) throw new Error(`item_id reorder at index ${i}`);

    const bPara = b.paragraphs ?? [];
    const aPara = a.paragraphs ?? [];
    if (bPara.length !== aPara.length) throw new Error(`paragraph count changed in ${b.item_id}`);
    for (let j = 0; j < bPara.length; j++) {
      const key = `${b.item_id}::p::${bPara[j].paragraph_index}`;
      verifyUnit(bPara[j], aPara[j], key, affectedKey.has(key), b.item_id);
    }

    const bFn = b.footnotes ?? [];
    const aFn = a.footnotes ?? [];
    if (bFn.length !== aFn.length) throw new Error(`footnote count changed in ${b.item_id}`);
    for (let j = 0; j < bFn.length; j++) {
      const key = `${b.item_id}::f::${bFn[j].marker}`;
      verifyUnit(bFn[j], aFn[j], key, affectedKey.has(key), b.item_id);
    }
  }
}

function verifyUnit(before, after, key, isAffected, itemId) {
  const beforeKeys = Object.keys(before).sort();
  const afterKeys = Object.keys(after).sort();
  if (JSON.stringify(beforeKeys) !== JSON.stringify(afterKeys)) {
    throw new Error(`field set changed at ${key}`);
  }

  for (const k of beforeKeys) {
    if (k === 'editorial_status' || k === 'editorial_note') continue;
    if (k === 'flags') {
      const isSpecial =
        isAffected &&
        itemId === SPECIAL_FLAG_REWRITE.itemId &&
        (before.paragraph_index === SPECIAL_FLAG_REWRITE.paragraphIndex);
      if (!isSpecial) {
        if (JSON.stringify(before.flags) !== JSON.stringify(after.flags)) {
          throw new Error(`flags changed unexpectedly at ${key}`);
        }
      }
      continue;
    }
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) {
      throw new Error(`field ${k} changed unexpectedly at ${key}`);
    }
  }

  if (!isAffected) {
    if (JSON.stringify(before.editorial_status) !== JSON.stringify(after.editorial_status)) {
      throw new Error(`editorial_status changed on non-affected unit ${key}`);
    }
    if (JSON.stringify(before.editorial_note) !== JSON.stringify(after.editorial_note)) {
      throw new Error(`editorial_note changed on non-affected unit ${key}`);
    }
  } else {
    if (after.editorial_status !== 'flagged_for_rewrite') {
      throw new Error(`expected flagged_for_rewrite at ${key}`);
    }
    if (after.editorial_note !== EDITORIAL_NOTE) {
      throw new Error(`unexpected editorial_note at ${key}`);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
