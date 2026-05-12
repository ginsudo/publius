# Tocqueville translation — gate-1 sample results

Generated: 2026-05-12T02:22:44.838Z
Model: claude-opus-4-7
System prompt: prompts/tocqueville-translation-system.md (v1.1)
Sample size: 3 item slices

Each section shows: coverage note, item header, French source, English translation,
any postprocess warnings, and any READING / TEXTURE / TERM flags emitted by the model.

**Owner review checklist (gate-1 for Phase 4):**

- [ ] Register matches the brief (Orwell/Didion/Wilson/Walzer/Baldwin, formal but not academic)
- [ ] No abstraction floats free — every abstract claim has a concrete anchor
- [ ] Tocqueville's analytical detachment preserved; irony dry, not marked
- [ ] Periodic sentences kept where the English can sustain them
- [ ] No verbatim French-clause gloss — meaning rendered as English prose
- [ ] Standing terms: *moeurs* italicized + first-occurrence translator's note; *liberté* → liberty; *association* → association
- [ ] Inline footnote markers ([1], [A], [163], etc.) preserved at equivalent points
- [ ] Flags surface genuine decisions, not routine word choices
- [ ] No editorialization, no smoothing, no added explanatory material outside translator's notes

---

## tocqueville:vol1.introduction

**Coverage:** Introduction — opening five paragraphs (sets the conceptual frame: equality of conditions)
**Title:** Introduction
**Kind:** introduction | **Tome:** 1 | **Part:** null | **Chapter:** null
**Paragraphs translated:** 5 (indices 0, 1, 2, 3, 4)
**Footnotes translated:** 0

### Paragraph 0

**Source (French):**

> Parmi les objets nouveaux qui, pendant mon séjour aux États-Unis, ont attiré mon attention, aucun n'a plus vivement frappé mes regards que l'égalité des conditions. Je découvris sans peine l'influence prodigieuse qu'exerce ce premier fait sur la marche de la société; il donne à l'esprit public une certaine direction, un certain tour aux lois; aux gouvernants des maximes nouvelles, et des habitudes particulières aux gouvernés.

**Translation:**

> Among the new things that caught my attention during my stay in the United States, none struck me more forcefully than the equality of conditions. I had no trouble seeing the prodigious influence that this primary fact exerts on the course of society: it gives public opinion a certain direction and a certain cast to the laws; it gives those who govern new maxims, and those who are governed habits peculiar to themselves.

**Flags:**

- *READING* — l'égalité des conditions — kept as "equality of conditions" rather than "equality of social conditions" or "equality of status"; this is Tocqueville's recurring technical phrase and must remain identifiable across the work.
- *TEXTURE* — il donne à l'esprit public une certaine direction, un certain tour aux lois; aux gouvernants des maximes nouvelles, et des habitudes particulières aux gouvernés — a four-part parallelism built on the single verb *donne*, with the verb elided in the last three clauses. English requires "it gives" twice to stay legible; the tight chiastic compression of the French is approximated, not preserved.

### Paragraph 1

**Source (French):**

> Bientôt je reconnus que ce même fait étend son influence fort au-delà des moeurs politiques et des lois, et qu'il n'obtient pas moins d'empire sur la société civile que sur le gouvernement: il crée des opinions, fait naître des sentiments, suggère des usages et modifie tout ce qu'il ne produit pas.

**Translation:**

> I soon recognized that this same fact extends its influence far beyond political *moeurs* [Translator's note: *moeurs* — Tocqueville's term for the habits, dispositions, and moral character of a people; no English equivalent captures its full range.] and laws, and that it holds no less sway over civil society than over government: it creates opinions, gives rise to sentiments, suggests customs, and modifies whatever it does not itself produce.

**Flags:** none

### Paragraph 2

**Source (French):**

> Ainsi donc, à mesure que j'étudiais la société américaine, je voyais de plus en plus, dans l'égalité des conditions, le fait générateur dont chaque fait particulier semblait descendre, et je le retrouvais sans cesse devant moi comme un point central où toutes mes observations venaient aboutir.

**Translation:**

> And so, as I studied American society, I came to see in the equality of conditions, more and more clearly, the generative fact from which every particular fact seemed to descend, and I kept finding it before me as a central point at which all my observations converged.

**Flags:**

- *READING* — le fait générateur — rendered "the generative fact" rather than "the originating fact" or "the source"; *générateur* in Tocqueville carries the sense of an active, continuously producing cause, not merely a historical origin.

### Paragraph 3

**Source (French):**

> Alors je reportai ma pensée vers notre hémisphère, et il me sembla que j'y distinguais quelque chose d'analogue au spectacle que m'offrait le Nouveau-Monde. Je vis l'égalité des conditions qui, sans y avoir atteint comme aux États-Unis ses limites extrêmes, s'en rapprochait chaque jour davantage; et cette même démocratie, qui régnait sur les sociétés américaines, me parut en Europe s'avancer rapidement vers le pouvoir.

**Translation:**

> I then turned my mind back toward our own hemisphere, and it seemed to me that I could make out something there analogous to the spectacle the New World had offered me. I saw the equality of conditions which, without having reached its extreme limits as in the United States, was drawing nearer to them every day; and that same democracy which reigned over American societies seemed to me, in Europe, to be advancing rapidly toward power.

**Flags:** none

### Paragraph 4

**Source (French):**

> De ce moment j'ai conçu l'idée du livre qu'on va lire.

**Translation:**

> From that moment I conceived the idea of the book one is about to read.

**Flags:**

- *TEXTURE* — qu'on va lire — the impersonal pronoun preserves Tocqueville's formal distance from the reader; "one is about to read" keeps this, where "the reader is about to read" or "you are about to read" would not.

<details><summary>Raw model output</summary>

```
### Paragraph 0
Among the new things that caught my attention during my stay in the United States, none struck me more forcefully than the equality of conditions. I had no trouble seeing the prodigious influence that this primary fact exerts on the course of society: it gives public opinion a certain direction and a certain cast to the laws; it gives those who govern new maxims, and those who are governed habits peculiar to themselves.
[READING: l'égalité des conditions — kept as "equality of conditions" rather than "equality of social conditions" or "equality of status"; this is Tocqueville's recurring technical phrase and must remain identifiable across the work.]
[TEXTURE: il donne à l'esprit public une certaine direction, un certain tour aux lois; aux gouvernants des maximes nouvelles, et des habitudes particulières aux gouvernés — a four-part parallelism built on the single verb *donne*, with the verb elided in the last three clauses. English requires "it gives" twice to stay legible; the tight chiastic compression of the French is approximated, not preserved.]

### Paragraph 1
I soon recognized that this same fact extends its influence far beyond political *moeurs* [Translator's note: *moeurs* — Tocqueville's term for the habits, dispositions, and moral character of a people; no English equivalent captures its full range.] and laws, and that it holds no less sway over civil society than over government: it creates opinions, gives rise to sentiments, suggests customs, and modifies whatever it does not itself produce.

### Paragraph 2
And so, as I studied American society, I came to see in the equality of conditions, more and more clearly, the generative fact from which every particular fact seemed to descend, and I kept finding it before me as a central point at which all my observations converged.
[READING: le fait générateur — rendered "the generative fact" rather than "the originating fact" or "the source"; *générateur* in Tocqueville carries the sense of an active, continuously producing cause, not merely a historical origin.]

### Paragraph 3
I then turned my mind back toward our own hemisphere, and it seemed to me that I could make out something there analogous to the spectacle the New World had offered me. I saw the equality of conditions which, without having reached its extreme limits as in the United States, was drawing nearer to them every day; and that same democracy which reigned over American societies seemed to me, in Europe, to be advancing rapidly toward power.

### Paragraph 4
From that moment I conceived the idea of the book one is about to read.
[TEXTURE: qu'on va lire — the impersonal pronoun preserves Tocqueville's formal distance from the reader; "one is about to read" keeps this, where "the reader is about to read" or "you are about to read" would not.]
```

</details>

---

## tocqueville:vol1.part2.ch6

**Coverage:** Part II, Chapter 6 — opening four paragraphs (Tocqueville on what democratic government actually delivers)
**Title:** QUELS SONT LES AVANTAGES RÉELS QUE LA SOCIÉTÉ AMÉRICAINE RETIRE DU GOUVERNEMENT DE LA DÉMOCRATIE
**Kind:** chapter | **Tome:** 2 | **Part:** 2 | **Chapter:** 6
**Paragraphs translated:** 4 (indices 0, 1, 2, 3)
**Footnotes translated:** 0

### Paragraph 0

**Source (French):**

> Avant de commencer le présent chapitre, je sens le besoin de rappeler au lecteur ce que j'ai déjà indiqué plusieurs fois dans le cours de ce livre.

**Translation:**

> Before beginning the present chapter, I feel the need to remind the reader of what I have already pointed out several times in the course of this book.

**Flags:** none

### Paragraph 1

**Source (French):**

> La constitution politique des États-Unis me paraît l'une des formes que la démocratie peut donner à son gouvernement; mais je ne considère pas les institutions américaines comme les seules ni comme les meilleures qu'un peuple démocratique doive adopter.

**Translation:**

> The political constitution of the United States appears to me one of the forms that democracy can give to its government; but I do not regard American institutions as the only ones, nor as the best, that a democratic people ought to adopt.

**Flags:** none

### Paragraph 2

**Source (French):**

> En faisant connaître quels biens les Américains retirent du gouvernement de la démocratie, je suis donc loin de prétendre ni de penser que de pareils avantages ne puissent être obtenus qu'à l'aide des mêmes lois.

**Translation:**

> In making known what benefits the Americans draw from the government of democracy, I am therefore far from claiming, or even thinking, that such advantages can be obtained only by means of the same laws.

**Flags:** none

### Paragraph 3

**Source (French):**

> DE LA TENDANCE GÉNÉRALE DES LOIS SOUS L'EMPIRE DE LA DÉMOCRATIE AMÉRICAINE, ET DE L'INSTINCT DE CEUX QUI LES APPLIQUENT.

**Translation:**

> ON THE GENERAL TENDENCY OF THE LAWS UNDER THE RULE OF AMERICAN DEMOCRACY, AND ON THE INSTINCT OF THOSE WHO APPLY THEM.

**Flags:**

- *READING* — l'empire de la démocratie américaine — rendered as "the rule of American democracy"; "sway" or "dominion" would carry more weight but read as archaic. "Empire" in the literal sense is avoided to prevent confusion with the political form.

<details><summary>Raw model output</summary>

```
### Paragraph 0
Before beginning the present chapter, I feel the need to remind the reader of what I have already pointed out several times in the course of this book.

### Paragraph 1
The political constitution of the United States appears to me one of the forms that democracy can give to its government; but I do not regard American institutions as the only ones, nor as the best, that a democratic people ought to adopt.

### Paragraph 2
In making known what benefits the Americans draw from the government of democracy, I am therefore far from claiming, or even thinking, that such advantages can be obtained only by means of the same laws.

### Paragraph 3
ON THE GENERAL TENDENCY OF THE LAWS UNDER THE RULE OF AMERICAN DEMOCRACY, AND ON THE INSTINCT OF THOSE WHO APPLY THEM.

[READING: l'empire de la démocratie américaine — rendered as "the rule of American democracy"; "sway" or "dominion" would carry more weight but read as archaic. "Empire" in the literal sense is avoided to prevent confusion with the political form.]
```

</details>

---

## tocqueville:vol1.t1.notes.A

**Coverage:** Tome 1 end-note A — full note (includes inline footnote marker [163])
**Title:** Note A (page 31)
**Kind:** end_note | **Tome:** 1 | **Part:** null | **Chapter:** null
**Paragraphs translated:** 4 (all)
**Footnotes translated:** 1 (markers: [163])

### Paragraph 0

**Source (French):**

> Voyez, sur tous les pays de l'ouest où les Européens n'ont pas encore pénétré, les deux voyages entrepris par le major Long, aux frais du congrès.

**Translation:**

> On the western lands not yet penetrated by Europeans, see the two expeditions undertaken by Major Long at the expense of Congress.

**Flags:** none

### Paragraph 1

**Source (French):**

> M. Long dit notamment, à propos du grand désert américain, qu'il faut tirer une ligne à peu près parallèle au 20e degré de longitude (méridien de Washington[163]), partant de la rivière Rouge et aboutissant à la rivière Plate. De cette ligne imaginaire jusqu'aux montagnes Rocheuses, qui bornent la vallée du Mississipi à l'ouest, s'étendent d'immenses plaines, couvertes en général de sable qui se refuse à la culture, ou parsemées de pierres granitiques. Elles sont privées d'eau en été. On n'y rencontre que de grands troupeaux de buffles et de chevaux sauvages. On y voit aussi quelques hordes d'Indiens, mais en petit nombre.

**Translation:**

> Mr. Long observes, in particular, concerning the great American desert, that one must draw a line roughly parallel to the 20th degree of longitude (Washington meridian[163]), running from the Red River to the Platte. From this imaginary line to the Rocky Mountains, which bound the Mississippi valley to the west, stretch immense plains, generally covered with sand that resists cultivation, or strewn with blocks of granite. They have no water in summer. One finds there only great herds of buffalo and wild horses. A few bands of Indians are also to be seen, but in small numbers.

**Flags:** none

### Paragraph 2

**Source (French):**

> Le major Long a entendu dire qu'en s'élevant au-dessus de la rivière Plate dans la même direction, on rencontrait toujours à sa gauche le même désert; mais il n'a pas pu vérifier par lui-même l'exactitude de ce rapport. _Long's expedition_, vol. 2, p. 361.

**Translation:**

> Major Long has heard it said that, ascending above the Platte in the same direction, one continues to find the same desert on the left; but he was not able to verify this report himself. *Long's expedition*, vol. 2, p. 361.

**Flags:** none

### Paragraph 3

**Source (French):**

> Quelque confiance que mérite la relation du major Long, il ne faut pas cependant oublier qu'il n'a fait que traverser le pays dont il parle, sans tracer de grands zigzags au-dehors de la ligne qu'il suivait.

**Translation:**

> Whatever confidence Major Long's account deserves, it must not be forgotten that he merely crossed the country he describes, without making any wide detours off the line he was following.

**Flags:** none

### Footnote [163]

**Source (French):**

> Le 20e degré de longitude, suivant le méridien de Washington, se rapporte à peu près au 99e degré suivant le méridien de Paris.

**Translation:**

> The 20th degree of longitude on the Washington meridian corresponds approximately to the 99th degree on the Paris meridian.

**Flags:** none

<details><summary>Raw model output</summary>

```
### Paragraph 0
On the western lands not yet penetrated by Europeans, see the two expeditions undertaken by Major Long at the expense of Congress.

### Paragraph 1
Mr. Long observes, in particular, concerning the great American desert, that one must draw a line roughly parallel to the 20th degree of longitude (Washington meridian[163]), running from the Red River to the Platte. From this imaginary line to the Rocky Mountains, which bound the Mississippi valley to the west, stretch immense plains, generally covered with sand that resists cultivation, or strewn with blocks of granite. They have no water in summer. One finds there only great herds of buffalo and wild horses. A few bands of Indians are also to be seen, but in small numbers.

### Paragraph 2
Major Long has heard it said that, ascending above the Platte in the same direction, one continues to find the same desert on the left; but he was not able to verify this report himself. *Long's expedition*, vol. 2, p. 361.

### Paragraph 3
Whatever confidence Major Long's account deserves, it must not be forgotten that he merely crossed the country he describes, without making any wide detours off the line he was following.

### Footnote [163]
The 20th degree of longitude on the Washington meridian corresponds approximately to the 99th degree on the Paris meridian.
```

</details>

---
