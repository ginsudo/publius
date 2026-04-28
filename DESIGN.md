# DESIGN.md — Publius

Design principles, typographic decisions, and interaction patterns for the Publius interface. This is the design counterpart to `CLAUDE.md` — the standing decisions that govern how the product looks and behaves, with reasoning, so future sessions don't re-litigate settled questions.

---

## The design problem Publius actually has

Most web products are competing for attention. Publius is competing for trust. The audience — people who think seriously about constitutional interpretation — is allergic to condescension, suspicious of glossy, and accustomed to working in environments (law reviews, scholarly editions, annotated texts) that signal rigor through restraint. The design must earn trust before it earns admiration.

The interface has two distinct modes with different design demands:

**Reading mode.** The user is in a text — a Federalist Paper, a Tocqueville chapter, a court opinion. This is a sustained reading environment. The design problem is identical to what a well-made critical edition solves: make long text comfortable to read, make the apparatus (footnotes, source information, the original/modern toggle) available without interrupting flow, and stay out of the way.

**Inquiry mode.** The user has typed a question and is reading a response. The design problem here is different: the response is structured — it attributes positions to specific authors, quotes specific passages, notes when authors disagree — and the structure must be legible. Citations must be followable. Disagreement must be surfaced, not smoothed.

Both modes live in the same interface. The design must handle the transition between them without jarring.

---

## Design identity

**The register:** Scholarly edition, not product. The signal is that someone who reads books designed this, not someone who builds apps.

**The differentiator:** Every constitutional tool online either condescends (civics app) or aggregates (legal research database). Publius does neither. The design should make this visible without announcing it. A user who lands on Publius should feel the difference before they read a word of copy.

**What it is not:** Not a dashboard. Not a chat interface. Not a legal research tool with a modern skin. Not an app that happens to contain books.

---

## Typography

Typography is the load-bearing structure of this interface. Every other design decision depends on getting this right.

### Body type

The body typeface must be a text serif — optimized for sustained reading, not display. The criteria:

- Designed or carefully adapted for screen (large x-height, generous apertures, open counters)
- Humanist rather than geometric — warmth matters for scholarly prose
- Enough weights to handle body, footnotes, captions, and emphasis without switching families
- Not overused in legal/academic contexts (avoid: Georgia, Times New Roman, Palatino, Merriweather)

**Recommended options in priority order:**

1. **Freight Text Pro** — exceptional screen serif, warm, literary register, purpose-built for long-form
2. **Spectral** — free (Google Fonts), designed specifically for screen reading of long texts, appropriate weight range
3. **Source Serif 4** — free, Adobe-designed, strong in the weights needed for footnotes and captions
4. **Lora** — free, popular but less overused than Georgia, good x-height

**Do not use:** Georgia (too associated with generic blogs), Times New Roman (prints fine, poor screen rendering), Inter (sans-serif, wrong register entirely), any system font stack for body text.

### Display / heading type

The display face signals the product's identity at a glance. It appears in the masthead, paper titles, section headings, and the Ask interface header.

**The choice to make:** Classical authority vs. modern editorial. Both are defensible; they produce different products.

- **Classical direction:** Something in the tradition of inscriptional or old-style faces — Trajan, Requiem, IM Fell English. Signals: permanence, authority, the weight of history. Risk: can read as period costume rather than deliberate choice.
- **Modern editorial direction:** A contemporary serif with character — Canela, Domaine Display, Cardinal. Signals: the editorial intelligence is present-tense and engaged, not archival. Risk: can date faster.

**Recommendation:** Modern editorial. Publius is not a museum. It is a tool for thinking about the Constitution *now*. The founders' arguments are live, not archived. A display face that reads as contemporary-but-serious is more honest than one that reads as historical.

**Specific recommendation:** **Canela Light** or **Canela Text** for display, paired with Freight Text or Spectral for body. Canela has enough presence at display sizes to anchor the masthead without overpowering body text. It signals editorial seriousness without period-costuming.

**Alternative if budget is a constraint:** **Playfair Display** (free) is less distinctive than Canela but readable and appropriate.

### Type scale

```
Display (masthead, hero):     40–52px / line-height 1.15
H1 (paper title, main head):  28–32px / line-height 1.25
H2 (section, author):         20–24px / line-height 1.3
H3 (subsection, label):       16–18px / line-height 1.4
Body (reading text):          18–20px / line-height 1.65–1.7
Footnote / caption:           14–15px / line-height 1.55
UI label / nav:               13–14px / line-height 1.4
```

18–20px body text is not a luxury — it is the threshold at which readers can lean back rather than lean forward. Below 17px, long-form scholarly prose requires effort. The CSS-Tricks guidance is explicit on this: larger body text signals that the user is invited to settle in.

Line height of 1.65–1.7 for body text is deliberately generous. Dense scholarly prose benefits from breathing room between lines. This is not "airy" design — it is the correct leading for comfortable sustained reading.

### Measure (line length)

**Target:** 65–72 characters per line for body text. This is the typographic sweet spot for reading comfort — narrow enough to avoid fatiguing eye travel back to the left margin, wide enough to maintain reading rhythm.

Implementation: `max-width: 68ch` on reading containers. Do not use `max-width: 700px` or similar pixel-based measures — `ch` units track with font size and remain correct when users adjust text size.

Do not fill the viewport with text. Wide viewports get generous margins; the reading column stays constrained. This is non-negotiable.

### Footnotes and sidenotes

This is the highest-leverage typography decision for Publius specifically, because the Federalist Papers have substantive footnotes and the scholarly reading convention is to follow them.

**The gwern.net approach, adapted for Publius:**

- On viewports wider than ~1100px: render footnotes as **sidenotes** — positioned in the right margin, vertically adjacent to their reference point in the text. The reader never loses their place. This is how printed critical editions work when they have the page width to do it.
- On narrower viewports: render footnotes as **expandable inline notes** — clicking the superscript expands the footnote text immediately below its reference, then collapses when dismissed. Never scroll-to-bottom.
- Never use the browser default scroll-to-anchor behavior for footnotes. It breaks reading flow.

The inline marker style: superscript numbers in the body text, styled as small-caps or reduced-size numerals — not the browser default superscript which is often too large and too high.

### Small caps and emphasis

Small caps for: author attributions, paper numbers, section labels, the corpus tag (FEDERALIST / TOCQUEVILLE / COURT). This is the typographic convention of scholarly editions and signals that the interface was designed by someone who knows the tradition.

Em dashes, not double hyphens. Proper quotation marks (`"` not `"`). These are not aesthetic preferences — they are correctness signals to the audience.

---

## Color

### Palette

**Primary:** Warm off-white background, not pure white. `#F7F4EE` or similar parchment tone. Pure white (`#FFFFFF`) is harsher than it seems on high-contrast screens; a slight warm shift reduces fatigue over long reading sessions.

**Text:** Near-black, warm-tinted. `#1A1714` rather than `#000000`. The slight warmth matches the background and reduces perceived contrast to a comfortable level without sacrificing legibility.

**Accent:** A single, carefully chosen accent color used sparingly. Options:

- **Verdigris / deep teal:** `#2A5F5F` or similar. Associates with aged bronze, scholarship, the patina of serious objects. Works well on the parchment background.
- **Constitutional blue:** A desaturated navy, `#1C3A5C`. Associations are obvious (flag, founding era) but not cheap if used sparingly and in combination with the right type.
- **Ochre / gold:** `#8B6914`. Warm, non-aggressive, pairs naturally with parchment background. Signals without shouting.

**Recommendation:** Verdigris as the primary accent. It's distinctive, not obviously "legal" or "historical," and reads as earned rather than imposed.

**Use the accent for:** Active states, citation highlights, the corpus tag color, hover on linked paper titles. Not for decorative elements.

**Gray scale:** A warm gray family derived from the primary colors, not a cool neutral gray. `#6B6460` for secondary text, `#9B9490` for tertiary labels and footnote numbers.

### Dark mode

Dark mode is a reading preference, not a trend feature. A segment of the target audience reads in low-light conditions and expects it.

**Dark palette:** Near-black background `#141210`, warm cream text `#E8E3DB`, accent color adjusted for dark — verdigris lightens to `#4A9F9F` on dark backgrounds. The parchment-ink pairing inverts to ink-on-dark-paper rather than screen-on-white.

Implement with CSS custom properties from day one so dark mode is a variable swap, not a rewrite.

---

## Layout and spatial composition

### Page structure

**Reading layout (paper/chapter view):**

```
[Narrow left margin: corpus tag, paper number]
[Reading column: ~68ch wide, centered or slightly left-of-center]
[Right margin: sidenotes at wide viewport, empty at narrow]
```

The reading column is never full-width. Even on wide monitors, text does not span the viewport. This is the most important single layout decision.

**Browse layout (paper list, search results):**

A constrained list, not a card grid. Card grids are for products. This is a catalog. Each entry: paper number + title + author + date, possibly a one-line summary. Dense, not spacious. The browse view signals that there are 85 papers and invites navigation, not consumption.

**Ask layout (inquiry interface):**

The question input is prominent but not the hero. The response area is the hero. When an answer is present, the question recedes and the answer comes forward — visually and spatially.

Citations within answers are inline, with hover-to-preview behavior so the reader can see what a citation points to without leaving the answer. See the Interaction section.

### Whitespace

Generous — but not undifferentiated. Whitespace should be doing structural work: separating the reading column from the margin, the question from the answer, the original text from the plain-English rendering. Whitespace that is just air is a failure mode; whitespace that creates hierarchy is a design decision.

**Specific guidance:** The space between the end of a paper title block and the start of body text is an intentional pause — 48–64px, enough to signal "you are now in the text." The space between paragraphs in body text is standard paragraph spacing (1em), not the double-space blog convention.

### The original/modern toggle

This is the most design-sensitive element in the reading view because it signals something about the product's relationship to the reader.

**What to avoid:** A toggle that reads as an accessibility feature ("simplified mode"). The modern rendering is not a simplification — it is a parallel version made by a scholar. The visual treatment should signal parity, not hierarchy.

**Recommended treatment:** A small, quiet toggle positioned in the reading column header, styled as a typographic element rather than a button. Consider: `ORIGINAL  ·  MODERN ENGLISH` as a small-caps label pair, with the active mode in the accent color and the inactive mode in the tertiary gray. No icons. No toggle switch metaphor. Just two labels, one active, one not.

When toggling, the text should crossfade (150ms opacity transition) rather than snap. The position in the document should be preserved across the toggle — the reader stays at the same paragraph.

---

## Interaction patterns

### Footnote/sidenote behavior

- Wide viewport: sidenotes appear on hover over the inline marker and persist on click. The active sidenote is highlighted in the margin.
- Narrow viewport: click on inline marker expands the note inline, below the paragraph. Second click collapses.
- Never: scroll-jump to a footnotes section at the bottom of the page.

### Citation hover (Ask interface)

When the model's answer cites a specific paper and paragraph, each citation is a link. Hovering the citation shows a tooltip/popup containing:

- Paper number and title (small caps)
- Author and date
- The relevant paragraph text (truncated to 3–4 sentences if long)
- A "Go to paper" link

This is the gwern.net popup pattern adapted to the citation context. The reader can evaluate the citation without navigating away from the answer.

Implementation note: the tooltip must not appear instantly on hover — a 300ms delay prevents accidental activation while moving the cursor across the page. It should appear above the citation, not below (to avoid being obscured by the answer text that follows).

### Ask interface behavior

The question input:

- Plain text input, no chat-bubble aesthetic. This is not a chat product.
- Placeholder text that signals the expected register: something like "What does Hamilton argue about judicial independence?" rather than "Ask anything."
- Submit on Enter (with Shift+Enter for newline, if multi-line input is permitted).

While the answer is loading:

- A subtle, non-animated loading state. Not a spinner, not a progress bar. A single period that pulses, or the cursor blinking in the response area. The answer is being thought through, not streamed from a server farm.

The answer:

- Rendered as structured prose, not chat bubbles. The response is a scholarly answer, not a message.
- Author attributions in small caps: `HAMILTON argues...` / `MADISON responds...`
- Citation markers inline, styled distinctively but not aggressively — a slightly elevated numeral or a subtle underline that activates on hover.
- Where authors disagree, the disagreement is surfaced structurally, not in a sidebar or callout. It is in the prose: "Hamilton argues X; Madison disputes this, holding Y."

### Navigation

Minimal. Publius has three top-level destinations: Browse (papers), Read (a paper), Ask (the inquiry interface). The navigation does not need to be more complex than this.

The masthead is present on all views but minimal: the Publius name/wordmark on the left, the three nav items on the right, and nothing else. No utility bar, no user account UI (until there's a reason for one), no search bar in the masthead (search is part of Browse or Ask).

---

## Reader Mode compliance

Publius should look good in browser Reader Mode. This is a quality signal, not a fallback.

Reader Mode works by stripping CSS and relying on semantic HTML. A reading interface that degrades gracefully into plain semantic HTML is one that was built around the text, not around the styling.

Practical implications:

- Use `<article>` for paper bodies
- Use `<aside>` for sidenotes
- Use `<footer>` within articles for footnotes
- Use heading tags (`h1`–`h3`) with real hierarchy, not for visual styling
- Do not use `<div>` for structural semantic elements

This also has implications for the Q&A response rendering: the model's answer should be rendered as semantic HTML (with `<p>`, `<blockquote>` for direct quotes, `<cite>` for attribution), not as a div soup styled to look like prose.

---

## What this design should not do

**Not do:** Announce itself. The interface should recede behind the content. If a reader is thinking about the design while reading Federalist 51, the design has failed.

**Not do:** Perform historicity. No aged-paper textures, no quill-pen flourishes, no Trajan-Roman-Empire-meets-parchment aesthetics. The founders are not ancient artifacts. Their arguments are live.

**Not do:** Simulate conversation. The Ask interface is not a chatbot. It is a query interface that returns a scholarly answer. The visual language should not evoke messaging apps.

**Not do:** Optimize for engagement. No related papers sidebar, no "you might also like" feature, no reading time estimates. The user came to read or to ask. Let them.

---

## Open decisions (to be made before implementation)

| Question | Options | Notes |
|---|---|---|
| Display typeface | Canela vs. Playfair Display vs. other | Budget and licensing question |
| Body typeface | Freight Text vs. Spectral vs. Source Serif 4 | Free vs. paid |
| Primary accent color | Verdigris vs. constitutional blue vs. ochre | Test against parchment background |
| Dark mode at launch | Yes / post-launch | If yes, wire CSS variables from day one |
| Sidenote library | Build custom vs. use existing (e.g., Tufte CSS sidenotes) | Existing libraries are well-tested |
| Citation popup | Build custom vs. adapt gwern.net approach | gwern's implementation is open source |

---

## References

**gwern.net design document:** https://gwern.net/design — the most thorough treatment of reading-oriented web design available. Sidenotes, popup system, progressive enhancement principles, and "semantic zoom" are all applicable.

**CSS-Tricks: Designing for Long-Form Articles** — practical mechanics: line length (`68ch`), body size (18–20px), line height (1.65+), underline positioning (`text-underline-position: under`), Reader Mode as quality signal.

**Robert Bringhurst, *The Elements of Typographic Style*** — the canonical authority on typographic decisions. Measure, leading, type scale, small caps usage.

**Tufte CSS** (https://edwardtufte.github.io/tufte-css/) — CSS implementation of Edward Tufte's print design principles adapted for web. Sidenote implementation is a direct reference.
