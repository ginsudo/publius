// Unit tests for the deterministic helpers in triage-annotations.ts.
//
// Run:
//   node --experimental-strip-types --test scripts/triage-annotations.test.ts
//
// Coverage focus:
//   - findPeriodVocab — routes to "manual" tier (low-risk side). Tested to
//     prevent false negatives that would re-expose the LLM to the surface
//     where v2's Hecwelder hallucination occurred.
//   - italicizedIn, matchMisspelling, spellingApplied — produce ACCEPT
//     verdicts (high-risk side). A bug here IS the Hecwelder failure
//     relocated into code. These are tested directly against the original
//     failure case ("Hecwelder" still in rendering must NOT be acceptable).
//
// The LLM rubric's period-vocab hard guard is NOT a safety net for bugs in
// these helpers (see triage-annotations.ts comment on TOCQUEVILLE_RUBRIC).
// This test IS the safety net.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PERIOD_VOCAB,
  MISSPELLINGS,
  UNTRANSLATED_TERMS,
  findPeriodVocab,
  italicizedIn,
  matchMisspelling,
  spellingApplied,
  spellingNotApplied,
} from './triage-annotations.ts';

test('findPeriodVocab detects every entry in PERIOD_VOCAB', () => {
  for (const term of PERIOD_VOCAB) {
    const sentence = `Some leading text. ${term} appears here in context.`;
    const hit = findPeriodVocab(sentence);
    assert.notEqual(hit, null, `expected a hit for ${term} in: ${sentence}`);
    // PERIOD_VOCAB contains a singular/plural pair (sauvage, sauvages) and a
    // ligature pair (moeurs, mœurs). The loop returns the first match in
    // PERIOD_VOCAB order. For "sauvages" the regex for "sauvages" wins
    // because it is listed before "sauvage" and is the precise match.
    // For "sauvage" alone, "sauvages" cannot match (no trailing s), so
    // "sauvage" wins. Assert containment rather than equality to keep the
    // test robust to PERIOD_VOCAB ordering changes that preserve the rule.
    assert.ok(
      sentence.toLowerCase().includes(hit!.toLowerCase()),
      `hit ${hit} should be a substring of input for ${term}`,
    );
  }
});

test('findPeriodVocab returns null for plain text with no period vocab', () => {
  assert.equal(findPeriodVocab(''), null);
  assert.equal(findPeriodVocab('The text has nothing of interest here.'), null);
  assert.equal(
    findPeriodVocab('A passage about constitutions, courts, and statutes.'),
    null,
  );
});

test('findPeriodVocab is Unicode-word-bounded (no substring matches)', () => {
  // "communément" contains "commune" but ends with "ément" — \b would treat
  // the "é" as a non-word boundary in ASCII mode and falsely match. The
  // lookaround-based wordRegex must NOT match.
  assert.equal(findPeriodVocab('Le mot communément utilisé.'), null);
  // "patriotique" contains "patrie"-like prefix but is a different word.
  assert.equal(findPeriodVocab('Un sentiment patriotique fort.'), null);
  // Adjacent ASCII letters must also block the match.
  assert.equal(findPeriodVocab('moeursomething'), null);
  // But hyphen and punctuation are NOT letters; word boundary should hold.
  assert.equal(findPeriodVocab('moeurs-influence'), 'moeurs');
  assert.equal(findPeriodVocab('"moeurs."'), 'moeurs');
});

test('findPeriodVocab is case-insensitive', () => {
  assert.equal(findPeriodVocab('THE *MOEURS* SECTION'), 'moeurs');
  assert.equal(findPeriodVocab('Sauvages'), 'sauvages');
  assert.equal(findPeriodVocab('LIBERTÉ'), 'liberté');
});

test('findPeriodVocab distinguishes moeurs from mœurs ligature', () => {
  // Both forms must be detectable — they are distinct Unicode characters
  // and the resolver lists both in PERIOD_VOCAB.
  const hitAscii = findPeriodVocab('le mot moeurs ici');
  const hitLigature = findPeriodVocab('le mot mœurs ici');
  assert.equal(hitAscii, 'moeurs');
  assert.equal(hitLigature, 'mœurs');
});

// ---------------------------------------------------------------------------
// italicizedIn — high-risk: a false positive here is a false ACCEPT.
// ---------------------------------------------------------------------------

test('italicizedIn detects markdown *…* italics', () => {
  assert.equal(italicizedIn('the *bourgeois* class', 'bourgeois'), true);
  assert.equal(italicizedIn('*bourgeoisie*', 'bourgeoisie'), true);
  assert.equal(italicizedIn('an *arrondissement* in Paris', 'arrondissement'), true);
});

test('italicizedIn detects HTML <em>…</em> italics', () => {
  assert.equal(italicizedIn('the <em>bourgeois</em> class', 'bourgeois'), true);
  assert.equal(italicizedIn('<em>bourgeoisie</em>', 'bourgeoisie'), true);
  // HTML with attributes is still <em>…</em>.
  assert.equal(italicizedIn('<em class="x">bourgeois</em>', 'bourgeois'), true);
});

test('italicizedIn returns false when term is not italicized', () => {
  assert.equal(italicizedIn('the bourgeois class', 'bourgeois'), false);
  assert.equal(italicizedIn('an Ancien Régime survival', 'Ancien Régime'), false);
  assert.equal(italicizedIn('', 'bourgeois'), false);
});

test('italicizedIn rejects the cross-emphasis bridge (high-risk Accept-2 false positive)', () => {
  // The closing * of one emphasis and the opening * of the next form a pair
  // around any bare text between them. A loose implementation would wrongly
  // return true here — an Accept-2 false positive on the high-risk side of
  // the matrix. Strict semantics (term is the sole content of an italic
  // run, modulo whitespace) reject this case.
  assert.equal(
    italicizedIn('one *first* then bourgeois then *second*', 'bourgeois'),
    false,
  );
  // Also reject the term embedded in a longer italicized phrase.
  assert.equal(
    italicizedIn('the *bourgeois doctrine and its critics*', 'bourgeois'),
    false,
  );
});

test('italicizedIn handles multi-word UNTRANSLATED_TERMS with spaces, apostrophe, and accented letters', () => {
  // The escaping/regex must survive: space, U+0027 apostrophe, and U+00C9 É.
  assert.equal(italicizedIn("*raison d'État*", "raison d'État"), true);
  assert.equal(italicizedIn("the *raison d'État* doctrine", "raison d'État"), true);
  assert.equal(italicizedIn("<em>raison d'État</em>", "raison d'État"), true);
  assert.equal(italicizedIn("raison d'État without italics", "raison d'État"), false);

  assert.equal(italicizedIn('*Ancien Régime*', 'Ancien Régime'), true);
  assert.equal(italicizedIn('the *Ancien Régime* persisted', 'Ancien Régime'), true);
  assert.equal(italicizedIn('<em>Ancien Régime</em>', 'Ancien Régime'), true);
  assert.equal(italicizedIn('Ancien Régime without italics', 'Ancien Régime'), false);
});

test('italicizedIn covers every entry in UNTRANSLATED_TERMS', () => {
  // Asserts the helper works on the exact set the resolver passes it.
  for (const term of UNTRANSLATED_TERMS) {
    assert.equal(
      italicizedIn(`prefix *${term}* suffix`, term),
      true,
      `expected *${term}* to be detected as italicized`,
    );
    assert.equal(
      italicizedIn(`prefix ${term} suffix`, term),
      false,
      `expected bare ${term} to NOT be detected as italicized`,
    );
  }
});

// ---------------------------------------------------------------------------
// matchMisspelling — high-risk: must catch the Hecwelder failure surface.
// ---------------------------------------------------------------------------

test('matchMisspelling matches when flag.key contains the misspelling', () => {
  for (const m of MISSPELLINGS) {
    const hit = matchMisspelling({ key: m.wrong, note: '' });
    assert.deepEqual(hit, m, `expected match on key="${m.wrong}"`);
  }
});

test('matchMisspelling matches when flag.note mentions the misspelling', () => {
  for (const m of MISSPELLINGS) {
    const hit = matchMisspelling({
      key: null,
      note: `corrected spelling should be ${m.right}, not ${m.wrong}`,
    });
    assert.deepEqual(hit, m, `expected match on note for "${m.wrong}"`);
  }
});

test('matchMisspelling returns null when no misspelling is referenced', () => {
  assert.equal(matchMisspelling({ key: null, note: '' }), null);
  assert.equal(
    matchMisspelling({ key: 'Tocqueville', note: 'unrelated note' }),
    null,
  );
  // Substring of a misspelling that is not word-bounded must not match.
  assert.equal(matchMisspelling({ key: null, note: 'Hecwelderian' }), null);
});

// ---------------------------------------------------------------------------
// spellingApplied / spellingNotApplied — the literal Hecwelder gate.
// ---------------------------------------------------------------------------

test('spellingApplied returns true when corrected form is present and misspelled is absent', () => {
  for (const m of MISSPELLINGS) {
    const rendering = `Some text mentioning ${m.right} once.`;
    assert.equal(
      spellingApplied(rendering, m),
      true,
      `expected applied=true for ${m.wrong}→${m.right}`,
    );
  }
});

test('spellingApplied returns false when misspelled form is still present (the Hecwelder failure case)', () => {
  // This is the v2 back-test failure, transposed to the deterministic
  // resolver. The rendering says "Hecwelder" — spellingApplied must be
  // false, which means the Accept 3 branch of deterministicResolve does
  // NOT fire and the candidate is correctly routed to rewrite (via
  // spellingNotApplied) rather than accept.
  const hecwelder = MISSPELLINGS.find((m) => m.wrong === 'Hecwelder')!;
  assert.equal(
    spellingApplied('Heckewelder reports… but also Hecwelder appears.', hecwelder),
    false,
    'both forms present → not applied',
  );
  assert.equal(
    spellingApplied('Only the misspelled Hecwelder appears here.', hecwelder),
    false,
    'only misspelled form present → not applied',
  );
});

test('spellingApplied returns false when corrected form is absent', () => {
  for (const m of MISSPELLINGS) {
    assert.equal(
      spellingApplied('Plain text with no mention.', m),
      false,
      `expected applied=false when ${m.right} absent`,
    );
  }
});

test('spellingNotApplied returns true iff misspelled form still appears verbatim', () => {
  const hecwelder = MISSPELLINGS.find((m) => m.wrong === 'Hecwelder')!;
  assert.equal(
    spellingNotApplied('Hecwelder reports…', hecwelder),
    true,
    'misspelled present → not applied (route to rewrite)',
  );
  assert.equal(
    spellingNotApplied('Heckewelder reports…', hecwelder),
    false,
    'only corrected present → applied (no rewrite trigger)',
  );
});
