# Editorial Review — Session Handoff

*Last updated: May 2026. Replace project file before starting the next review session.*

---

## What this document is

A handoff for the next planning chat accompanying a Claude Code session for Publius. It covers the state of both editorial review passes (Federalist plain-English and Tocqueville translation), the conventions established so far, and the key decisions made. The next thread should be able to pick up either review intelligently without re-deriving any of this.

---

# FEDERALIST PLAIN-ENGLISH REVIEW

## Current position

- **CLI command:** `node --experimental-strip-types scripts/review-annotations.ts`
- **Resume position:** `g next` — use the new navigation command; last known position was Federalist 8, paragraph 6
- **Reviewed so far:** 75 of 901 flagged paragraphs
- **Flagged for rewrite:** queryable from annotations file; approximately 20+ at this point
- **Flag rate:** approximately 20% — higher than initial projection, tracking Hamilton's denser style

---

## What the CLI does

`scripts/review-annotations.ts` pages through flagged paragraphs/units in document order, displaying the original text, the plain English or translated rendering, the flags, and current editorial status. Commands (updated with new features):

- `n` / `p` — next / previous (skips reviewed units when skip-reviewed mode is ON)
- `g <paper> <para>` — jump to specific flagged paragraph (Federalist); `g <item_id> <paragraph_index>` (Tocqueville)
- `g next` / `g n` — jump to first unreviewed flagged unit in document order
- `a` — accept rendering, advance (prompts to overwrite if status already set)
- `f` — flag for rewrite, prompts for optional note, advance (prompts to overwrite if status already set)
- `F` — flag for rewrite without note prompt; preserves existing note; advance
- `e` — open in `$EDITOR` for direct edit, advance
- `m <note>` — set editorial note, stay
- `u` — unset status and note, stay
- `s` — toggle skip-reviewed mode for n/p navigation
- `q` — quit with session summary (shows cumulative + this-session stats)
- `?` — help

Atomic writes on every action. Progress is durable — quitting and relaunching is safe.

---

## Three-pass structure

1. **This pass (current)** — move fast. `a` if acceptable, `f` with a diagnostic note if not. `e` only for trivial one-word fixes. The goal is to record intent, not execute repairs.
2. **Retry pass** — `--retry` against all `flagged_for_rewrite` paragraphs, run against a refined system prompt synthesized from editorial preferences and `f` notes. **The owner has decided to run the retry pass now, at 75 positions reviewed, rather than waiting for the full 901.** The retry pass Claude Code session should extract all `f` notes from `federalist-annotations.json`, synthesize them into a refined system prompt, show it to the owner for approval, and only then run the batch. Do not run the batch without approval.
3. **Hand-edit pass** — anything still wrong after retry gets `e` treatment directly.

**Key discipline:** prefer `f` over `e` during this pass. Don't mix repair work into the review pass.

---

## Editorial preferences established so far

These are settled decisions. Apply them consistently in the retry pass system prompt and in future review decisions.

### Preserve these words — do not substitute

The owner's audience is constitutional scholars (Princeton Murphy/George course level, Dworkin seminar). Words that are still current English and carry precise meaning should be preserved rather than substituted, even if archaic-sounding to a general reader. Established cases:

| Original word | Wrong substitution | Reason to preserve |
|---|---|---|
| emoluments | compensation, financial benefits | Legal term of art; still current in constitutional discourse |
| sated | satisfied | Gluttony/visceral connotation load-bearing |
| culpable | blameworthy | Juridical moral-judgment sense; pointless substitution |
| specious | attractive | Deceptive-gloss sense entirely lost in substitution |
| pretended (to protect) | claimed | Accusation of bad faith is deliberate; "pretended" still current |
| deluged | drenched | Flood/overwhelming scale image load-bearing |
| denominate | call | Legalistic, quasi-official weight lost in substitution |
| spirit of enterprise | entrepreneurial spirit | Aggressive, unbridled daring lost in modern business connotation |
| implacable | (dropped/truncated) | Still current; relentless-and-unyielding sense load-bearing |
| haughty | (preserved correctly) | Moral characterization, not neutral descriptor |
| certain characters | individuals | Pointed irony; implies questionable integrity deliberately |
| trite | well-worn | Self-aware dismissiveness load-bearing; "well-worn" softens the edge; alliteration with "true" in "as true as it is trite" is also load-bearing |
| liberal (18c sense) | enlightened | Original still current; 18th-century sense is fair-minded/broad-minded, not the modern political sense; substituting away imposes a modern political anxiety the founders didn't have |
| pernicious | dangerous | Insidious/corrupting sense lost in "dangerous"; "pernicious" still current |
| signal (adj.) | notable | "Signal achievement" still current English; emphatic force of "notable" is weaker |
| not too highly wrought | not overdrawn | "Wrought" carries craft/artistic construction metaphor; "overdrawn" is financial register and wrong |

### Consistent substitutions accepted

| Original | Accepted substitution | Notes |
|---|---|---|
| laws of nations | international law | Owner preference; consistent modernization; audience uses this term |
| sanguine | optimistic | Accepted throughout; humoral connotation noted but not load-bearing |
| candor (18c sense) | fairness / openness | Accepted; owner aware of semantic shift |
| Chief Magistrate | President / Chief Executive | Reads as judicial to modern audiences; substitute |
| Spanish main | Spanish colonial coast | Period term no longer current even for specialist audience |
| enormities | outrages | Modern scholarly audience reads "enormities" as scale not moral horror |
| economy (18c sense) | fiscal prudence | 18th-century sense of frugality/efficient management of resources; "fiscal prudence" accepted |
| infallibly | unfailingly | Accepted; both preserve the logical-necessity force |

### Structural conventions

- **Preserve original capitalization** — WORD, UNION, PLUNDER, PARCHMENT, DESPERATE DEBTOR, FORMIDABLE ONLY TO EACH OTHER, etc. These are the authors' own emphasis and often doing rhetorical work.
- **Preserve anaphora and rhetorical structures** — "As a nation... as a nation... as a nation"; the "Let England... let Scotland..." sequence; rhetorical question chains. These are load-bearing.
- **Do not split periodic sentences** — Hamilton and Jay use long subordinate-clause sentences where structure does argumentative work. The model sometimes breaks these into shorter units, dissolving rhetorical pressure. Flag when this happens.
- **Preserve ironic quotation marks** — e.g., Jay's "joined in affection" and "interests" in Federalist 5. Removing them erases deliberate rhetorical distance.
- **Preserve deliberate incompleteness** — e.g., "declare--!" in Federalist 6 paragraph 19. Aposiopesis is intentional; do not complete the sentence.
- **Preserve self-corrections** — e.g., "or rather the avarice" in Federalist 6. Hamilton's mid-phrase upgrades to more damning words are rhetorical gestures, not errors.
- **Preserve personification constructions** — e.g., "PLUNDER and devastation ever march in the train of irregulars." The procession/ceremonial framing is doing work; "follow in the wake of" is a flat substitution. "Ever" (invariably, as a matter of law) should not be softened to "always."
- **Preserve Latin phrases untranslated** — e.g., "Divide et impera." Hamilton leaves these in Latin deliberately; translating them strips the sense of invoking an axiomatic principle of statecraft universally known among the educated.

### Preserve sonic texture where it does rhetorical work

Alliteration, assonance, and other sound patterns must be preserved when they are doing argumentative work — when the sound reinforces or enacts the rhetorical move, not merely when they happen to appear incidentally.

Established case: **"as true as it is trite" (Federalist 7 ¶8)** — the alliteration makes the observation feel proverbial and inevitable, which reinforces Hamilton's ironic point that a universally known truth is being ignored. "As true as it is well-worn" loses both the sonic texture and the dismissive edge. Flag type: RHETORIC (sonic texture is a subcategory of rhetorical function, not a separate flag kind).

**Implication for review:** when a RHETORIC flag identifies a phrase with alliteration or other sonic patterning, check not just whether the argumentative move survived but whether the sound did. These are not always separable.

---

## Truncation problem — critical

The batch run has a systematic truncation issue. Across 75 positions, at least 6 truncations were caught:

- Federalist 1 paragraph 5: three incomplete sentences (missing "stale bait," "specious mask," "obsequious court")
- Federalist 1 paragraph 6: dropped sentence ("I affect not reserves which I do not feel")
- Federalist 5 paragraph 6: "invidious jealousies" dropped from final clause
- Federalist 6 paragraph 13: "implacable" dropped, broken syntax
- Federalist 6 paragraph 18: two truncations in one paragraph ("reveries," "empire")
- Federalist 7 paragraph 6 (position 68): "odious to our neighbors, and, in their opinion, so oppressive" dropped

**Pattern:** dropped words tend to be the flagged terms themselves, appearing late in clauses. Strong evidence that the batch pipeline hit a max_tokens limit mid-generation on longer paragraphs. The retry pass must set a higher token ceiling and include a syntactic completeness check before writing.

**Implication for review:** always read the plain English rendering against the original before deciding. Truncations produce no flag — the flagging model only sees what's there, not what's missing. Broken syntax (dangling "so ?", "more quickly than and", etc.) is the tell.

---

## Flag type conventions

- **WORD flags** — mostly fast decisions. Check whether the substitution was correct. If the original word is still current and the substitution is weaker, consider `f`. If the flag noted a risk that didn't materialize (original word preserved), `a` immediately.
- **RHETORIC flags** — slow down. These identify argumentative structure, irony, rhetorical force — including sonic texture (alliteration, assonance) where it is doing rhetorical work. Check whether the rendering preserved the specific word or construction the flag identifies. If not, `f`.
- **AMBIGUOUS flags** — rarest (10 total). Genuinely uncertain passages. Read carefully, consider `m` note to record interpretive reasoning before `a`.

False-alarm flags (flag noted substitution risk, rendering preserved original word) = fast `a`. These are common and don't require deliberation.

---

## Noted interpretive decisions

- **"very unanimous" (Federalist 2, paragraph 10):** rendered as "nearly unanimous." Interpretive choice — Jay likely knew the Convention was not fully unanimous (Gerry, Mason, Randolph refused to sign). Rendering leans toward qualified reading over emphatic reading. Note recorded in annotations.
- **"international law" preference:** owner prefers "international law" as consistent modern rendering for "laws of nations" throughout. Note recorded in annotations at Federalist 3 paragraph 9.

---

## What comes next — retry pass

The owner has decided to run the retry pass now (at 75/901 reviewed) rather than waiting for the full pass to close. The next Claude Code session should:

1. Read all `flagged_for_rewrite` paragraphs and their `editorial_note` fields from `federalist-annotations.json`
2. Use this handoff document as the source of editorial preferences
3. Synthesize both into a refined retry system prompt
4. Show the owner the synthesized prompt for approval before running anything
5. Only after approval: run the retry batch against flagged paragraphs only

The review pass (this CLI session) continues after the retry pass — the retry pass does not close the review pass.

---

## Resuming the Federalist review pass

```
node --experimental-strip-types scripts/review-annotations.ts
g next
```

---

---

# TOCQUEVILLE TRANSLATION REVIEW

## Current position

**Volume I review pass: COMPLETE.**

- **CLI command:** `node --experimental-strip-types scripts/review-annotations.ts --corpus tocqueville`
- **Reviewed:** 378/378 flagged units (paragraphs + footnotes combined)
- **Accepted:** 296
- **Flagged for rewrite:** 82
- **Unreviewed:** 0
- **Volume II:** not yet started; no CLI work done

Next steps for Tocqueville before indexing: run pending batch fixes (see below), then retry pass against 82 flagged-for-rewrite units.

---

## Standing translation policies

### Period vocabulary — render accurately, never soften

The translation standard is accurate period rendering. The generation pass has a demonstrated tendency to soften period racial and ethnic vocabulary. This is a known failure mode that must be actively resisted during review. **Do not accept a rendering that softens, modernizes, or euphemizes Tocqueville's period vocabulary.** If the translation has "Africans" where Tocqueville wrote *nègres*, or "indigenous peoples" where he wrote *sauvages*, that is a mistranslation requiring a rewrite flag.

| French term | Rendering | Policy |
|---|---|---|
| *sauvages* (noun) | savages | Established ch1 ¶31; Tocqueville's technical-descriptive category, not purely pejorative |
| *sauvages* (adj.) | savage / wild | Context-dependent |
| *nègres* | Negroes | Established ch1 ¶31; accurate period rendering required |
| *moeurs* | mores | Standing policy; italicized throughout |
| *commune* | township | Established ch5 ¶5; will require policy pass |
| *buffles* | buffalo | Period register over taxonomic precision (not "bison") |
| *patrie* | fatherland | Preserves civic/emotional charge (not "country") |
| *liberté* | liberty | Not "freedom"; Tocqueville's key analytical term |
| *néant* | nothingness | Philosophical register (not "nullity") — established ch3 ¶44 |
| *élan* | surge (when kinetic) | Preserves momentum and forward force (not "impulse") |
| *cité* | city (in "spirit of the city") | Preserves classical *civitas* echo (not "civic spirit") |
| *peuplade* | tribe | "Community" too neutral; loses ethnographic register; standing policy Vols I and II |
| *métis* | mixed-bloods | Not "half-breeds" (pejorative) or "mestizos" (too regionally specific) |

### Untranslated terms (French retained, italicized)

Terms where the English cognate has drifted from Tocqueville's meaning, or where no adequate English equivalent exists:

| French | Policy | Rationale |
|---|---|---|
| *raison d'État* | Untranslated, italicized | "Reason of state" has drifted to political expediency; French preserves the philosophical sense of the state's justifying principle |
| *Ancien Régime* | Untranslated, italicized | Conventional in English historiography; "old regime" loses specificity |
| *bourgeois* / *bourgeoisie* | Untranslated | "Middle class" loses the specific social-legal meaning |
| *arrondissement* | Untranslated, italicized | When Tocqueville draws the explicit comparison himself; direct English equivalent would require a footnote |

### Established term renderings (non-negotiable)

These are settled decisions that override the generation pass defaults:

| French | Rendering | Notes |
|---|---|---|
| *principe générateur* | generative principle | Preserves quasi-biological force |
| *loi de la représentation* | principle of representation | *Loi* here is general rule, not statute |
| *corps constituant* | constituent body | Standard constitutional vocabulary |
| *cens* | property qualification | Standard historical English term |
| *administrés* | administered subjects | Best available; *administrés* is coined in French too |
| *enseveli* | entombed | Stronger funereal register; fits theological metaphor ch4 ¶1 |
| *intrigants* | intriguers | Courtly-political flavor preserved |
| *attributions* | functions | Scope of role, not legal competence |
| *en attendant* | until further notice | Cold administrative irony, ch5 ¶45 |
| *usufruit* | temporary use rights | Avoids technical term without losing legal argument |
| *platane* (American context) | sycamore | *Platanus occidentalis*, not European plane tree |
| *peuplier de Virginie* | tulip tree | *Liriodendron tulipifera*; "tulip poplar" is informal |
| *mélèze* | larch | *Larix*; confirmed |
| *chêne vert* | live oak | *Quercus virginiana*; confirmed |
| *état social* | social condition | Not "social order" — Tocqueville's master term encompasses equality of conditions, manners, institutions; "social order" implies hierarchy and stability that distorts the sense |
| *intérêt d'individualité* | interest of particularity | Captures state's distinct corporate existence without personal-psychological overtones of "individuality" |
| *jurisprudence* (French civil-law sense) | judicial decisions | French *jurisprudence* = case law/body of decisions, not legal scholarship as in English |
| *supplice* | act of torture / torture-death | Specifically death by torture, not mere execution; "execution" loses the cruelty |
| *sans foi politique* | without political faith | *Foi* carries religious register; contrast is between genuine belief and its absence, not strong vs. weak conviction |
| *factieux* | faction leaders | Implies deliberate stirring of factional trouble, not mere agitation; critical for contrast with *conspirateurs* (secret conspirators) |
| *corps secondaires* | intermediate bodies | Standard scholarly rendering for institutions standing between individual and sovereign |
| *colléges électoraux* (Tocqueville's usage) | delegating bodies | Not "electoral colleges" — misleads into U.S. Electoral College; Tocqueville means organized bodies formed to select and send delegates |
| *esprit légiste* | legal spirit | Broader than "lawyers' spirit"; includes judges and legal scholars |
| *légistes* | lawyers | Broader than *avocats*; "jurist" would narrow to scholars only |
| *symbole* (political/party sense) | creed | *Symbole de foi* sense; "platform" too modern, "canon" too literary |
| *capacité* (civic sense) | qualification / capacity | Technical civic sense: legal eligibility, not mental ability |
| *avènement* | advent | Not "arrival"; preserves quasi-messianic register Tocqueville intends (batch fix pending) |
| *démocratie* (when capitalized in French) | Democracy | Tocqueville's capitalization signals Democracy as historical force; must match French source (scan pending) |
| *entail* (for *substitution*, legal) | entail | French *substitution* = English entail (*fee tail* / *estate tail*); Tocqueville himself provides English term in parentheses |
| *pâture journalière* | daily diet | Not "daily fodder"; owner preference |
| *lumières* | context-dependent | "Learning" (when referring to cultivation/education), "knowledge" (ch3 ¶25 specific instance); never "Enlightenment" (false historical association) |
| *supplice* | torture / torture-death | ch notes D ¶2–3: death by torture specifically |
| *détrompeur* | illusions | "Cast aside his illusions" — stripping away of false beliefs, not mental pathology |
| *les ressorts du gouvernement* | the springs of government | Mechanical metaphor load-bearing; not "workings" |
| *promenant la torche* | carrying the torch | Owner preference (not "brandishing") |

### Spelling standardizations

All instances in translation corrected silently; translator's note added once where appropriate:

| Tocqueville spelling | Correct English | Note |
|---|---|---|
| Meaupou | Maupeou | René Nicolas de Maupeou (1714–1792) |
| Hecwelder | Heckewelder | John Heckewelder (1743–1823) |
| Blakstone | Blackstone | *Commentaries on the Laws of England* |
| Francklin | Franklin | Benjamin/James Franklin; translator's note added once |
| Geiberger | [pending verification] | Likely David Zeisberger (1721–1808); do not correct without APS Memoirs vol. 3 confirmation |

### Restore English originals for English-language sources

**Standing policy — non-negotiable.** When Tocqueville quotes an English-language source in French translation, restore the original English text verbatim. Do not back-translate. Flag the passage for rewrite with a note identifying the source.

Established sources requiring restoration (flagged for rewrite during Volume I pass):

- **Jefferson, *Notes on the State of Virginia*, Query VI** (Footnote [18]) — second quotation confirmed; first quotation (Iroquois/Rome comparison) located but exact wording not yet verified
- **Mayflower Compact** (ch1 ¶36) — restore from Avalon Project (Yale Law); Tocqueville's excerpt only
- **Jefferson to Madison, 28 August 1789** (Note K ¶4) — locate via Founders Online; substitute verbatim
- **Kent, *Commentaries on American Law*** (Note G ¶2, ¶3, ¶5) — multiple passages; locate and substitute
- **New York *Revised Statutes*, vol. 3, Appendix, p. 51** (Note G ¶7) — statutory language
- **Massachusetts General Assembly committee report on *New England Courant*** (Note A ¶3) — locate source document
- **U.S. Constitution, Preamble** (Note O ¶5) — verbatim: "We the People of the United States, in Order to form a more perfect Union..."
- **U.S. Constitution, Article I, Section 1** (Note O ¶8) — verbatim
- **U.S. Constitution, First Amendment** (Note O ¶130) — verbatim
- **U.S. Constitution, Fifth Amendment** (Note O ¶264) — verbatim
- **U.S. Constitution, Tenth Amendment** (Note O ¶148) — verbatim
- **U.S. Constitution, Article II, Section 4** (ch7 ¶31) — "Treason, Bribery, or other high Crimes and Misdemeanors"
- **State constitutions** (Notes N ¶5–9): Massachusetts, North Carolina, Virginia, New Hampshire, South Carolina, Kentucky, Tennessee, Ohio, Louisiana, Mississippi, Alabama, Pennsylvania — locate original statutory language for each
- **Federalist No. 51 (Madison)** (ch7 ¶100–101) — restore verbatim from Federalist Papers
- **Jefferson quotation (unspecified letter)** (ch7 ¶102) — locate via Founders Online; footnote [28] may identify source
- **Blackstone, *Commentaries*, Book I, ch. 2** (Note M ¶3) — restore verbatim; Tocqueville's French is a translation
- **Story, *Commentaries on the Constitution*, Book III, ch. XXXVIII** (Note D footnote [31]) — verify quotation and correct *searcely* → *scarcely*
- **Delolme, Book I, ch. X, p. 77** (Note M ¶1) — quotation already in English in Tocqueville; verify against source and retain original orthography ("every thing")
- **State constitutional provisions** (Note O ¶258, ¶266, ¶267) — identify source constitution and substitute exact statutory language

### No inline translator's notes

The audience is constitutional scholars and does not need glosses on *mores*, *usufruct*, "constituent body," "universal suffrage," "body politic," or standard constitutional and legal vocabulary. If a note is needed at all, it goes once in the translator's preface — not inline. Remove any inline notes the generation pass added; flag for rewrite when found.

### Preserve Tocqueville's italics

Tocqueville's own italicized words carry polemical or self-conscious register weight and must be preserved in the English translation. This includes words he borrows self-consciously from legal discourse (*considérants*, *dispositif*), words he emphasizes analytically (*directement*, *tous les ans*), and phrases he quotes from others.

### Do not over-specify where Tocqueville is vague

- *Monticules élevés par la main de l'homme* → "earthen mounds" (not "burial mounds" — Tocqueville does not specify funerary function)
- Do not add modifiers, explanatory content, or interpretive glosses not present in the French

### Preserve oxymorons, irony, and uncomfortable period assessments

- *Sauvages vertus* → "savage virtues" — deliberate oxymoron; do not smooth
- *Un mal désormais inévitable* → "an evil that had by now become inevitable"
- Dry irony rendered straight, no marking added — e.g., "tranquilly, legally, philanthropically" (ch10 ¶104); "a happy distinction that escaped the old casuists" (ch10 ¶42)
- Do not modernize or soften Tocqueville's ethnological assessments

### Ellipsis standardization

Use editorial form `[…]` for selective quotation, not Tocqueville's string of dots (e.g., `«.........»`).

---

## Annotation quality issues

- **Misattributed flag:** TEXTURE flag for *sauvages vertus* misfired on ch1 ¶40. Watch for similar misattributed flags from adjacent or thematically related paragraphs.
- **Misfired *moeurs* flags:** Some flags describe policy as "leave in French" rather than "render as mores." Inert for accepted units; verify retry filter logic handles these correctly.
- **Misfired *moeurs* flagged_for_rewrite on paragraphs without *moeurs*:** ch6 ¶41 was flagged for *moeurs* but the word doesn't appear in that paragraph. Cleared with `u` command. Watch for similar annotation errors.
- **Silent softening by generation pass:** Demonstrated at ch1 ¶31 (*nègres* → "Africans"). Always check the French against the translation before accepting paragraphs involving racial categories, ethnic descriptions, or period social assessments.
- **Inline translator's notes:** The generation pass sometimes adds inline glosses. Remove these; flag for rewrite when found.
- **Translation expansions:** The generation pass sometimes adds words not in the French. Check for additions that smooth the English at the cost of introducing content Tocqueville did not write.
- **Chapter heading *moeurs*:** The chapter heading "DE L'INFLUENCE DES MOEURS..." was rendered with untranslated *moeurs* rather than *mores*. Flagged for rewrite. Check all chapter headings for this error in the batch fix pass.

---

## Pending batch fixes — do before retry pass

These standing conventions have not yet been applied via batch script. Handle in a Claude Code session before the retry pass runs (plan → count → owner approval → script → verify → commit):

1. ***avènement* → "advent"** — generation pass rendered *avènement* as "arrival" in some units. Batch find-and-replace across all Volume I translation units.
2. **"democracy" / "Democracy" capitalization scan** — must match Tocqueville's French source exactly. Where he wrote *la Démocratie* (capitalized), the translation reads "Democracy"; where *la démocratie* (lowercase), "democracy." Not a blanket find-and-replace — requires case-by-case check against the French source.
3. ***commune* → "township" policy pass** — find-and-replace across all Volume I units; build alongside the *avènement* pipeline.
4. ***moeurs* italics pass** — many accepted units have "mores" without italics. Needs a pass to add italics consistently. Build alongside the other batch fixes.
5. **Chapter heading *moeurs* → *mores*** — at least one chapter heading ("DE L'INFLUENCE DES MOEURS...") was rendered with untranslated *moeurs*. Scan all chapter headings.

---

## Open items requiring research or follow-up

- ***(H)* appendix note** at ch4 ¶17: locate and translate authorial note in Pagnerre edition; decide inline vs. appendix placement
- ***Fonctionnaire prévaricateur*** at ch6 ¶3: accepted as "corrupt official" but flag correctly identified this as imprecise — consider revisiting; "an official guilty of misconduct" or "a delinquent official" is more accurate
- **Jefferson footnote [18], first quotation:** second quotation confirmed; first quotation (Iroquois/Rome comparison) located in Query VI but exact wording not yet verified
- **"Geiberger"** (Note C ¶13): likely David Zeisberger but do not correct without APS Memoirs vol. 3 confirmation
- **"M. Varden"** (Note F ¶63): identity uncertain; verify before finalizing
- **Paragraph 48–49, ch3** (de la liberté de la presse): apparent placement anomaly — referents of *l'un* and *l'autre* unclear; verify placement in Pagnerre edition against earlier editions
- **Footnote [245], ch3**: *conviction réfléchie et maîtresse d'elle* — possible truncation of *maîtresse d'elle-même*; verify against Pagnerre edition
- **Duponceau/Heckewelder phonetic transcriptions** (Note C ¶7): verify spellings against APS Memoirs vol. 1, pp. 356–464
- **"R. Cotton Mather"** (Note F ¶24): "R." almost certainly = *Révérend*; render as "Rev. Cotton Mather"; add translator's note
- **Translation system prompt update needed:** add standing instruction that English-language quotations should be flagged for source restoration rather than translated; add *sauvages* → savages, *nègres* → Negroes, *peuplade* → tribe, *raison d'État* → untranslated as standing decisions

---

## Resuming Tocqueville work

Volume I review pass is complete. Next steps in order:

1. **Batch fix pass** (Claude Code): run the five batch fixes listed above
2. **Retry pass** (Claude Code): run against 82 flagged-for-rewrite units with a system prompt synthesized from this handoff document and the `f` notes in `tocqueville-annotations.json`; show owner the synthesized prompt before running
3. **Volume II**: begin Phase 4 Volume II generation (not yet started)
