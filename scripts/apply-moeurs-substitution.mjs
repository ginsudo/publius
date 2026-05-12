import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORPUS = resolve(__dirname, '../data/tocqueville/tocqueville.json');
const ANN = resolve(__dirname, '../data/tocqueville/tocqueville-annotations.json');

const TRANSLATOR_NOTE_TARGET = {
  itemId: 'tocqueville:vol1.introduction',
  paragraphIndex: 1,
};
const LEAKED_FLAG_TARGET = {
  itemId: 'tocqueville:vol1.t1.notes.E',
  paragraphIndex: 20,
};

function applyTextOps(text, counters) {
  let out = text;

  // Rule 1: "Custom and *moeurs*" → "Habits and mores"
  out = out.replace(/Custom and \*moeurs\*/g, () => {
    counters.rule1++;
    return 'Habits and mores';
  });

  // Rule 2: "custom and *moeurs*" → "habits and mores"
  out = out.replace(/custom and \*moeurs\*/g, () => {
    counters.rule2++;
    return 'habits and mores';
  });

  // Rule 3: remaining "*moeurs*" → "mores"
  out = out.replace(/\*moeurs\*/g, () => {
    counters.rule3++;
    return 'mores';
  });

  // Rule 4: bare "moeurs" → "mores" (word-boundary, not flanked by *)
  out = out.replace(/(^|[^*])moeurs(?!\*)\b/g, (m, pre) => {
    counters.rule4++;
    return pre + 'mores';
  });

  return out;
}

function applySpecialEdits(text, itemId, paragraphIndex, counters) {
  let out = text;

  if (itemId === TRANSLATOR_NOTE_TARGET.itemId && paragraphIndex === TRANSLATOR_NOTE_TARGET.paragraphIndex) {
    const before = out;
    out = out.replace(
      / \[Translator's note: \*moeurs\* — Tocqueville's term for the habits, dispositions, and moral character of a people; no English equivalent captures its full range\.\]/,
      '',
    );
    if (out === before) throw new Error('translator-note strip missed at ' + itemId + ' para ' + paragraphIndex);
    counters.translatorNoteStripped++;
  }

  if (itemId === LEAKED_FLAG_TARGET.itemId && paragraphIndex === LEAKED_FLAG_TARGET.paragraphIndex) {
    const before = out;
    out = out.replace(/\n\nTEXTURE: "les moeurs[\s\S]*$/, '');
    if (out === before) throw new Error('leaked-annotation strip missed at ' + itemId + ' para ' + paragraphIndex);
    counters.leakedAnnotationStripped++;
  }

  return out;
}

function atomicWriteJson(path, obj) {
  const tmp = path + '.tmp';
  writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n');
  renameSync(tmp, path);
}

function main() {
  const corpusRaw = readFileSync(CORPUS, 'utf8');
  const annRaw = readFileSync(ANN, 'utf8');
  const corpus = JSON.parse(corpusRaw);
  const ann = JSON.parse(annRaw);

  const counters = {
    rule1: 0,
    rule2: 0,
    rule3: 0,
    rule4: 0,
    translatorNoteStripped: 0,
    leakedAnnotationStripped: 0,
    paragraphsTouched: 0,
    footnoteParagraphsTouched: 0,
    annUnitsCleared: 0,
    annParagraphsCleared: 0,
    annFootnotesCleared: 0,
  };

  for (const item of corpus.items) {
    const t = item.tocqueville?.translation;
    if (Array.isArray(t)) {
      for (let i = 0; i < t.length; i++) {
        if (t[i] == null) continue;
        let next = t[i];
        next = applySpecialEdits(next, item.id, i, counters);
        next = applyTextOps(next, counters);
        if (next !== t[i]) {
          t[i] = next;
          counters.paragraphsTouched++;
        }
      }
    }
    const ft = item.tocqueville?.footnotes_translation;
    if (Array.isArray(ft)) {
      for (const f of ft) {
        if (!Array.isArray(f.paragraphs)) continue;
        for (let i = 0; i < f.paragraphs.length; i++) {
          if (f.paragraphs[i] == null) continue;
          const before = f.paragraphs[i];
          const next = applyTextOps(before, counters);
          if (next !== before) {
            f.paragraphs[i] = next;
            counters.footnoteParagraphsTouched++;
          }
        }
      }
    }
  }

  for (const item of ann.items) {
    for (const p of item.paragraphs ?? []) {
      if (Array.isArray(p.flags) && p.flags.length === 1 && p.flags[0].french === 'moeurs') {
        p.editorial_status = null;
        p.editorial_note = null;
        counters.annUnitsCleared++;
        counters.annParagraphsCleared++;
      }
    }
    for (const fn of item.footnotes ?? []) {
      if (Array.isArray(fn.flags) && fn.flags.length === 1 && fn.flags[0].french === 'moeurs') {
        fn.editorial_status = null;
        fn.editorial_note = null;
        counters.annUnitsCleared++;
        counters.annFootnotesCleared++;
      }
    }
  }

  verifyCorpus(corpus);
  verifyAnnotations(JSON.parse(annRaw), ann, counters);

  atomicWriteJson(CORPUS, corpus);
  atomicWriteJson(ANN, ann);

  console.log('Wrote both files.');
  console.log('=== Corpus ===');
  console.log('  rule 1 ("Custom and *moeurs*"):', counters.rule1);
  console.log('  rule 2 ("custom and *moeurs*"):', counters.rule2);
  console.log('  rule 3 ("*moeurs*"):', counters.rule3);
  console.log('  rule 4 (bare moeurs):', counters.rule4);
  console.log('  translator note stripped:', counters.translatorNoteStripped);
  console.log('  leaked annotation stripped:', counters.leakedAnnotationStripped);
  console.log('  translation paragraphs touched:', counters.paragraphsTouched);
  console.log('  footnote paragraphs touched:', counters.footnoteParagraphsTouched);
  console.log('=== Annotations ===');
  console.log('  units cleared:', counters.annUnitsCleared, '(' + counters.annParagraphsCleared + ' para + ' + counters.annFootnotesCleared + ' fn)');
}

function verifyCorpus(corpus) {
  let leftoverItal = 0;
  let leftoverBare = 0;
  for (const item of corpus.items) {
    const collect = [];
    if (Array.isArray(item.tocqueville?.translation)) collect.push(...item.tocqueville.translation);
    if (Array.isArray(item.tocqueville?.footnotes_translation)) {
      for (const f of item.tocqueville.footnotes_translation) {
        if (Array.isArray(f.paragraphs)) collect.push(...f.paragraphs);
      }
    }
    for (const p of collect) {
      if (p == null) continue;
      const ital = p.match(/\*moeurs\*/g);
      const bare = p.match(/\bmoeurs\b/g);
      if (ital) leftoverItal += ital.length;
      if (bare) leftoverBare += bare.length;
    }
  }
  if (leftoverItal !== 0) throw new Error('verify: ' + leftoverItal + ' italicized *moeurs* remain in translations');
  if (leftoverBare !== 0) throw new Error('verify: ' + leftoverBare + ' bare moeurs remain in translations');
}

function verifyAnnotations(before, after, counters) {
  if (before.items.length !== after.items.length) throw new Error('annotation item count changed');
  let expectedCleared = 0;
  for (let i = 0; i < before.items.length; i++) {
    const bi = before.items[i];
    const ai = after.items[i];
    if (bi.item_id !== ai.item_id) throw new Error('item_id reorder');
    const checkColl = (bArr, aArr, key) => {
      if ((bArr ?? []).length !== (aArr ?? []).length) throw new Error('coll len mismatch in ' + bi.item_id);
      for (let j = 0; j < (bArr ?? []).length; j++) {
        const b = bArr[j];
        const a = aArr[j];
        const isClear = Array.isArray(b.flags) && b.flags.length === 1 && b.flags[0].french === 'moeurs';
        if (isClear) {
          expectedCleared++;
          if (a.editorial_status !== null) throw new Error('expected null status at ' + bi.item_id + ' ' + key + ' ' + j);
          if (a.editorial_note !== null) throw new Error('expected null note at ' + bi.item_id + ' ' + key + ' ' + j);
          if (JSON.stringify(b.flags) !== JSON.stringify(a.flags)) throw new Error('flags mutated at clear unit ' + bi.item_id);
        } else {
          if (JSON.stringify(b) !== JSON.stringify(a)) throw new Error('non-clear unit mutated at ' + bi.item_id + ' ' + key + ' ' + j);
        }
      }
    };
    checkColl(bi.paragraphs, ai.paragraphs, 'para');
    checkColl(bi.footnotes, ai.footnotes, 'fn');
  }
  if (expectedCleared !== counters.annUnitsCleared) {
    throw new Error('verify: counter (' + counters.annUnitsCleared + ') vs scan (' + expectedCleared + ') mismatch');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
