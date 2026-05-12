# Tocqueville translation — gate-1 sample results

Generated: 2026-05-12T01:43:27.205Z
Model: claude-sonnet-4-6
System prompt: prompts/tocqueville-translation-system.md (v1.0)
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

> Among the new things that caught my attention during my stay in the United States, none struck me more forcibly than the equality of conditions. I had no difficulty discovering the prodigious influence this primary fact exerts on the course of society: it gives to public opinion a certain direction, to laws a certain character, to those who govern new maxims, and to those who are governed distinctive habits.
> 
> ---

**Flags:**

- *TERM* — *égalité des conditions* — Tocqueville's central concept. "Equality of conditions" is the established rendering (cf. Lawrence/Mayer). "Equality of social condition" is more explicit but adds a word Tocqueville doesn't use. Flag for owner: retain "equality of conditions" or expand?
- *TERM* — *fait* — used here and throughout in a technical-philosophical sense: a foundational fact or datum, something given and operative. "Fact" works but can feel flat. Flag for owner: "fact," "given," or "datum"?
- *TEXTURE* — *donne … un certain tour aux lois* — literally "gives to laws a certain turn/cast." "Character" loses the sense of motion or inflection. Alternatives: "a certain cast," "a certain tendency." Flag for owner.

### Paragraph 1

**Source (French):**

> Bientôt je reconnus que ce même fait étend son influence fort au-delà des moeurs politiques et des lois, et qu'il n'obtient pas moins d'empire sur la société civile que sur le gouvernement: il crée des opinions, fait naître des sentiments, suggère des usages et modifie tout ce qu'il ne produit pas.

**Translation:**

> I soon recognized that this same fact extends its influence far beyond political customs and laws, and holds no less sway over civil society than over government: it shapes opinions, gives rise to feelings, suggests customs, and modifies everything it does not directly produce.
> 
> ---

**Flags:**

- *TERM* — *moeurs politiques* — "political customs" or "political mores." "Mores" is the standard Tocqueville term in English scholarship but may feel academic. Flag for owner: "customs," "mores," or "habits"?
- *TERM* — *société civile* — "civil society" in the modern sense (as distinct from the state), but Tocqueville may mean simply the social sphere as opposed to the political. Flag for owner.

### Paragraph 2

**Source (French):**

> Ainsi donc, à mesure que j'étudiais la société américaine, je voyais de plus en plus, dans l'égalité des conditions, le fait générateur dont chaque fait particulier semblait descendre, et je le retrouvais sans cesse devant moi comme un point central où toutes mes observations venaient aboutir.

**Translation:**

> Thus, the more I studied American society, the more I came to see in the equality of conditions the generative fact from which every particular fact seemed to derive, and I encountered it constantly before me like a central point toward which all my observations converged.
> 
> ---

**Flags:**

- *TEXTURE* — *fait générateur* — "generative fact" preserves the quasi-scientific register. "Master fact" or "originating fact" are alternatives. Flag for owner.
- *TEXTURE* — *venaient aboutir* — "converged" works; "came to rest" or "arrived" are also possible, with slightly different implication. Flag for owner.

### Paragraph 3

**Source (French):**

> Alors je reportai ma pensée vers notre hémisphère, et il me sembla que j'y distinguais quelque chose d'analogue au spectacle que m'offrait le Nouveau-Monde. Je vis l'égalité des conditions qui, sans y avoir atteint comme aux États-Unis ses limites extrêmes, s'en rapprochait chaque jour davantage; et cette même démocratie, qui régnait sur les sociétés américaines, me parut en Europe s'avancer rapidement vers le pouvoir.

**Translation:**

> I then turned my thoughts toward our own hemisphere, and it seemed to me that I could discern there something analogous to what the New World had shown me. I saw the equality of conditions advancing—without yet having reached, as in the United States, its furthest limits, but drawing closer to them day by day—and that same democracy which reigned over American societies appeared to me to be moving rapidly in Europe toward power.
> 
> ---

**Flags:**

- *TEXTURE* — *je distinguais* — "discern" captures the tentative, effortful quality of the seeing, as opposed to the clearer "discover" of paragraph 0. Flag for owner: worth preserving the contrast.
- *TERM* — *vers le pouvoir* — "toward power" is literal. Could be "toward dominion" or "into power." The sense is that democracy is on the march and will arrive at political control. Flag for owner.

### Paragraph 4

**Source (French):**

> De ce moment j'ai conçu l'idée du livre qu'on va lire.

**Translation:**

> From that moment I conceived the idea of the book the reader is about to read.

**Flags:**

- *TEXTURE* — *qu'on va lire* — the impersonal "on" gives a slight formality. "The reader is about to read" is slightly redundant in English; "the book you are about to read" is more natural but loses the third-person distance. Flag for owner.

<details><summary>Raw model output</summary>

```
### Paragraph 0
Among the new things that caught my attention during my stay in the United States, none struck me more forcibly than the equality of conditions. I had no difficulty discovering the prodigious influence this primary fact exerts on the course of society: it gives to public opinion a certain direction, to laws a certain character, to those who govern new maxims, and to those who are governed distinctive habits.

[TERM: "égalité des conditions" — Tocqueville's central concept. "Equality of conditions" is the established rendering (cf. Lawrence/Mayer). "Equality of social condition" is more explicit but adds a word Tocqueville doesn't use. Flag for owner: retain "equality of conditions" or expand?]
[TERM: "fait" — used here and throughout in a technical-philosophical sense: a foundational fact or datum, something given and operative. "Fact" works but can feel flat. Flag for owner: "fact," "given," or "datum"?]
[TEXTURE: "donne … un certain tour aux lois" — literally "gives to laws a certain turn/cast." "Character" loses the sense of motion or inflection. Alternatives: "a certain cast," "a certain tendency." Flag for owner.]

---

### Paragraph 1
I soon recognized that this same fact extends its influence far beyond political customs and laws, and holds no less sway over civil society than over government: it shapes opinions, gives rise to feelings, suggests customs, and modifies everything it does not directly produce.

[TERM: "moeurs politiques" — "political customs" or "political mores." "Mores" is the standard Tocqueville term in English scholarship but may feel academic. Flag for owner: "customs," "mores," or "habits"?]
[TERM: "société civile" — "civil society" in the modern sense (as distinct from the state), but Tocqueville may mean simply the social sphere as opposed to the political. Flag for owner.]

---

### Paragraph 2
Thus, the more I studied American society, the more I came to see in the equality of conditions the generative fact from which every particular fact seemed to derive, and I encountered it constantly before me like a central point toward which all my observations converged.

[TEXTURE: "fait générateur" — "generative fact" preserves the quasi-scientific register. "Master fact" or "originating fact" are alternatives. Flag for owner.]
[TEXTURE: "venaient aboutir" — "converged" works; "came to rest" or "arrived" are also possible, with slightly different implication. Flag for owner.]

---

### Paragraph 3
I then turned my thoughts toward our own hemisphere, and it seemed to me that I could discern there something analogous to what the New World had shown me. I saw the equality of conditions advancing—without yet having reached, as in the United States, its furthest limits, but drawing closer to them day by day—and that same democracy which reigned over American societies appeared to me to be moving rapidly in Europe toward power.

[TEXTURE: "je distinguais" — "discern" captures the tentative, effortful quality of the seeing, as opposed to the clearer "discover" of paragraph 0. Flag for owner: worth preserving the contrast.]
[TERM: "vers le pouvoir" — "toward power" is literal. Could be "toward dominion" or "into power." The sense is that democracy is on the march and will arrive at political control. Flag for owner.]

---

### Paragraph 4
From that moment I conceived the idea of the book the reader is about to read.

[TEXTURE: "qu'on va lire" — the impersonal "on" gives a slight formality. "The reader is about to read" is slightly redundant in English; "the book you are about to read" is more natural but loses the third-person distance. Flag for owner.]
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

> Before beginning this chapter, I feel the need to remind the reader of something I have already indicated several times in the course of this book.

**Flags:** none

### Paragraph 1

**Source (French):**

> La constitution politique des États-Unis me paraît l'une des formes que la démocratie peut donner à son gouvernement; mais je ne considère pas les institutions américaines comme les seules ni comme les meilleures qu'un peuple démocratique doive adopter.

**Translation:**

> The political constitution of the United States seems to me one of the forms that democracy can give to its government; but I do not regard American institutions as the only ones, nor as the best ones, that a democratic people must adopt.

**Flags:** none

### Paragraph 2

**Source (French):**

> En faisant connaître quels biens les Américains retirent du gouvernement de la démocratie, je suis donc loin de prétendre ni de penser que de pareils avantages ne puissent être obtenus qu'à l'aide des mêmes lois.

**Translation:**

> In describing what benefits the Americans derive from democratic government, I am therefore far from claiming or believing that such advantages can be obtained only by means of the same laws.

**Flags:** none

### Paragraph 3

**Source (French):**

> DE LA TENDANCE GÉNÉRALE DES LOIS SOUS L'EMPIRE DE LA DÉMOCRATIE AMÉRICAINE, ET DE L'INSTINCT DE CEUX QUI LES APPLIQUENT.

**Translation:**

> ON THE GENERAL TENDENCY OF LAWS UNDER THE SWAY OF AMERICAN DEMOCRACY, AND THE INSTINCT OF THOSE WHO APPLY THEM.

**Flags:**

- *TERM* — *empire* — Tocqueville uses *empire* here in its older sense of "dominion" or "sway" rather than as a political empire. The rendering "sway" is one option; "rule," "reign," or "dominion" are alternatives. Flag for owner.

<details><summary>Raw model output</summary>

```
### Paragraph 0
Before beginning this chapter, I feel the need to remind the reader of something I have already indicated several times in the course of this book.

### Paragraph 1
The political constitution of the United States seems to me one of the forms that democracy can give to its government; but I do not regard American institutions as the only ones, nor as the best ones, that a democratic people must adopt.

### Paragraph 2
In describing what benefits the Americans derive from democratic government, I am therefore far from claiming or believing that such advantages can be obtained only by means of the same laws.

### Paragraph 3
ON THE GENERAL TENDENCY OF LAWS UNDER THE SWAY OF AMERICAN DEMOCRACY, AND THE INSTINCT OF THOSE WHO APPLY THEM.

[TERM: "empire" — Tocqueville uses *empire* here in its older sense of "dominion" or "sway" rather than as a political empire. The rendering "sway" is one option; "rule," "reign," or "dominion" are alternatives. Flag for owner.]
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

> See the two expeditions undertaken by Major Long, at the expense of Congress, concerning all the western territories into which Europeans have not yet penetrated.

**Flags:** none

### Paragraph 1

**Source (French):**

> M. Long dit notamment, à propos du grand désert américain, qu'il faut tirer une ligne à peu près parallèle au 20e degré de longitude (méridien de Washington[163]), partant de la rivière Rouge et aboutissant à la rivière Plate. De cette ligne imaginaire jusqu'aux montagnes Rocheuses, qui bornent la vallée du Mississipi à l'ouest, s'étendent d'immenses plaines, couvertes en général de sable qui se refuse à la culture, ou parsemées de pierres granitiques. Elles sont privées d'eau en été. On n'y rencontre que de grands troupeaux de buffles et de chevaux sauvages. On y voit aussi quelques hordes d'Indiens, mais en petit nombre.

**Translation:**

> Major Long says in particular, regarding the great American desert, that one must draw a line roughly parallel to the 20th degree of longitude (Washington meridian [163]), running from the Red River to the Platte River. From this imaginary line to the Rocky Mountains, which bound the valley of the Mississippi to the west, there stretch immense plains, covered for the most part with sand that resists cultivation, or strewn with granite rocks. They are without water in summer. One encounters there only great herds of buffalo and wild horses. A few bands of Indians are also to be found there, but in small numbers.

**Flags:**

- *READING* — *20e degré de longitude (méridien de Washington)* — Tocqueville is using a Washington meridian; see Footnote 163 for the Paris-meridian conversion. The owner should decide whether to add a clarifying editorial note for modern readers accustomed to Greenwich.
- *TERM* — *grand désert américain* — "great American desert": the standard period term for the semi-arid plains west of the Mississippi. Worth flagging as a historical geographic designation that differs from modern usage.

### Paragraph 2

**Source (French):**

> Le major Long a entendu dire qu'en s'élevant au-dessus de la rivière Plate dans la même direction, on rencontrait toujours à sa gauche le même désert; mais il n'a pas pu vérifier par lui-même l'exactitude de ce rapport. _Long's expedition_, vol. 2, p. 361.

**Translation:**

> Major Long heard it said that, traveling further up the Platte River in the same direction, one would always find the same desert to one's left; but he was not able to verify the accuracy of this report himself. *Long's Expedition*, vol. 2, p. 361.

**Flags:**

- *TEXTURE* — Tocqueville quotes the English-language source title in italics in the original. The owner may wish to keep the title in its original English form and italicize it, as done here.

### Paragraph 3

**Source (French):**

> Quelque confiance que mérite la relation du major Long, il ne faut pas cependant oublier qu'il n'a fait que traverser le pays dont il parle, sans tracer de grands zigzags au-dehors de la ligne qu'il suivait.

**Translation:**

> Whatever confidence Major Long's account deserves, one must not forget that he did no more than cross the country he describes, without making any wide detours beyond the line he was following.

**Flags:**

- *TEXTURE* — *sans tracer de grands zigzags au-dehors de la ligne qu'il suivait* — the phrase is vivid and slightly informal. "Wide detours beyond the line he was following" is close; the owner may prefer something more literal, such as "without striking out in broad zigzags from his route."

### Footnote [163]

**Source (French):**

> Le 20e degré de longitude, suivant le méridien de Washington, se rapporte à peu près au 99e degré suivant le méridien de Paris.

**Translation:**

> The 20th degree of longitude, reckoned from the Washington meridian, corresponds approximately to the 99th degree reckoned from the Paris meridian.

**Flags:**

- *READING* — This note clarifies the coordinate system in use. Modern readers orient by the Greenwich meridian; the owner may wish to add a bracketed editorial gloss converting to Greenwich (approximately 97°W).

<details><summary>Raw model output</summary>

```
### Paragraph 0
See the two expeditions undertaken by Major Long, at the expense of Congress, concerning all the western territories into which Europeans have not yet penetrated.

### Paragraph 1
Major Long says in particular, regarding the great American desert, that one must draw a line roughly parallel to the 20th degree of longitude (Washington meridian [163]), running from the Red River to the Platte River. From this imaginary line to the Rocky Mountains, which bound the valley of the Mississippi to the west, there stretch immense plains, covered for the most part with sand that resists cultivation, or strewn with granite rocks. They are without water in summer. One encounters there only great herds of buffalo and wild horses. A few bands of Indians are also to be found there, but in small numbers.

[READING: "20e degré de longitude (méridien de Washington)" — Tocqueville is using a Washington meridian; see Footnote 163 for the Paris-meridian conversion. The owner should decide whether to add a clarifying editorial note for modern readers accustomed to Greenwich.]
[TERM: "grand désert américain" — "great American desert": the standard period term for the semi-arid plains west of the Mississippi. Worth flagging as a historical geographic designation that differs from modern usage.]

### Paragraph 2
Major Long heard it said that, traveling further up the Platte River in the same direction, one would always find the same desert to one's left; but he was not able to verify the accuracy of this report himself. *Long's Expedition*, vol. 2, p. 361.

[TEXTURE: Tocqueville quotes the English-language source title in italics in the original. The owner may wish to keep the title in its original English form and italicize it, as done here.]

### Paragraph 3
Whatever confidence Major Long's account deserves, one must not forget that he did no more than cross the country he describes, without making any wide detours beyond the line he was following.

[TEXTURE: "sans tracer de grands zigzags au-dehors de la ligne qu'il suivait" — the phrase is vivid and slightly informal. "Wide detours beyond the line he was following" is close; the owner may prefer something more literal, such as "without striking out in broad zigzags from his route."]

### Footnote [163]
The 20th degree of longitude, reckoned from the Washington meridian, corresponds approximately to the 99th degree reckoned from the Paris meridian.

[READING: This note clarifies the coordinate system in use. Modern readers orient by the Greenwich meridian; the owner may wish to add a bracketed editorial gloss converting to Greenwich (approximately 97°W).]
```

</details>

---
