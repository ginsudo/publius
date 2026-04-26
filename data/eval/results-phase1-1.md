# Phase 1.1 retrieval test — results

Generated 2026-04-26 against `data/eval/index.sqlite` using voyage-4-large, top-K=10.

Pass criterion is **qualitative owner sign-off**, not an automated metric. The "must-include" check below is a sanity signal — a probe whose must-include items don't appear in top-K is a yellow flag, but a probe with all must-include items present can still fail if the surrounding hits are wrong, and a probe with missing must-include items can still pass if the actual top hits answer the question well. Read the hits, judge them, fill in the "Owner judgment" line.

Skipped (`phase_5_only: true`, recorded for design intent): P14, P15, P16.

---

## P01 — body_substance

**Question:** What is Madison's argument for why a large republic better controls the effects of faction than a small one?

**Must include:**

- federalist:10 — ✓ rank 1, score 0.572

**Top 10:**

1. **score 0.572** — `federalist:10` paragraph 21 — Madison
   > Hence, it clearly appears, that the same advantage which a republic has over a democracy, in controlling the effects of faction, is enjoyed by a large over a small republic,--is enjoyed by the Union over the States composing it. Does the advantage consist in the substitution of representatives whose enlightened views a…
2. **score 0.553** — `federalist:10` paragraph 16 — Madison
   > The effect of the first difference is, on the one hand, to refine and enlarge the public views, by passing them through the medium of a chosen body of citizens, whose wisdom may best discern the true interest of their country, and whose patriotism and love of justice will be least likely to sacrifice it to temporary or…
3. **score 0.543** — `federalist:10` paragraph 20 — Madison
   > The other point of difference is, the greater number of citizens and extent of territory which may be brought within the compass of republican than of democratic government; and it is this circumstance principally which renders factious combinations less to be dreaded in the former than in the latter. The smaller the s…
4. **score 0.541** — `federalist:10` paragraph 17 — Madison
   > In the first place, it is to be remarked that, however small the republic may be, the representatives must be raised to a certain number, in order to guard against the cabals of a few; and that, however large it may be, they must be limited to a certain number, in order to guard against the confusion of a multitude. He…
5. **score 0.534** — `federalist:10` paragraph 18 — Madison
   > In the next place, as each representative will be chosen by a greater number of citizens in the large than in the small republic, it will be more difficult for unworthy candidates to practice with success the vicious arts by which elections are too often carried; and the suffrages of the people being more free, will be…
6. **score 0.508** — `federalist:63` paragraph 8 — Madison _[disputed]_
   > It may be suggested, that a people spread over an extensive region cannot, like the crowded inhabitants of a small district, be subject to the infection of violent passions, or to the danger of combining in pursuit of unjust measures. I am far from denying that this is a distinction of peculiar importance. I have, on t…
7. **score 0.482** — `federalist:51` paragraph 10 — Madison _[disputed]_
   > Second. It is of great importance in a republic not only to guard the society against the oppression of its rulers, but to guard one part of the society against the injustice of the other part. Different interests necessarily exist in different classes of citizens. If a majority be united by a common interest, the righ…
8. **score 0.479** — `federalist:10` paragraph 19 — Madison
   > It must be confessed that in this, as in most other cases, there is a mean, on both sides of which inconveniences will be found to lie. By enlarging too much the number of electors, you render the representatives too little acquainted with all their local circumstances and lesser interests; as by reducing it too much, …
9. **score 0.479** — `federalist:10` paragraph 1 — Madison
   > AMONG the numerous advantages promised by a well constructed Union, none deserves to be more accurately developed than its tendency to break and control the violence of faction. The friend of popular governments never finds himself so much alarmed for their character and fate, as when he contemplates their propensity t…
10. **score 0.476** — `federalist:10` paragraph 15 — Madison
   > The two great points of difference between a democracy and a republic are: first, the delegation of the government, in the latter, to a small number of citizens elected by the rest; secondly, the greater number of citizens, and greater sphere of country, over which the latter may be extended.

**Rationale (probe design):** Federalist 10's central thesis. Canonical retrieval baseline — if top-K doesn't include paper 10, retrieval is broken.

**Owner judgment:** pass

**Notes:** 

---

## P02 — body_substance

**Question:** Why does Madison argue that 'ambition must be made to counteract ambition' in the structure of government?

**Must include:**

- federalist:51 — ✓ rank 1, score 0.586

**Top 10:**

1. **score 0.586** — `federalist:51` paragraph 4 — Madison _[disputed]_
   > But the great security against a gradual concentration of the several powers in the same department, consists in giving to those who administer each department the necessary constitutional means and personal motives to resist encroachments of the others. The provision for defense must in this, as in all other cases, be…
2. **score 0.503** — `federalist:51` paragraph 5 — Madison _[disputed]_
   > This policy of supplying, by opposite and rival interests, the defect of better motives, might be traced through the whole system of human affairs, private as well as public. We see it particularly displayed in all the subordinate distributions of power, where the constant aim is to divide and arrange the several offic…
3. **score 0.481** — `federalist:51` paragraph 1 — Madison _[disputed]_
   > TO WHAT expedient, then, shall we finally resort, for maintaining in practice the necessary partition of power among the several departments, as laid down in the Constitution? The only answer that can be given is, that as all these exterior provisions are found to be inadequate, the defect must be supplied, by so contr…
4. **score 0.465** — `federalist:51` paragraph 10 — Madison _[disputed]_
   > Second. It is of great importance in a republic not only to guard the society against the oppression of its rulers, but to guard one part of the society against the injustice of the other part. Different interests necessarily exist in different classes of citizens. If a majority be united by a common interest, the righ…
5. **score 0.460** — `federalist:48` paragraph 5 — Madison
   > In a government where numerous and extensive prerogatives are placed in the hands of an hereditary monarch, the executive department is very justly regarded as the source of danger, and watched with all the jealousy which a zeal for liberty ought to inspire. In a democracy, where a multitude of people exercise in perso…
6. **score 0.450** — `federalist:51` paragraph 2 — Madison _[disputed]_
   > In order to lay a due foundation for that separate and distinct exercise of the different powers of government, which to a certain extent is admitted on all hands to be essential to the preservation of liberty, it is evident that each department should have a will of its own; and consequently should be so constituted t…
7. **score 0.445** — `federalist:62` paragraph 8 — Madison _[disputed]_
   > First. It is a misfortune incident to republican government, though in a less degree than to other governments, that those who administer it may forget their obligations to their constituents, and prove unfaithful to their important trust. In this point of view, a senate, as a second branch of the legislative assembly,…
8. **score 0.436** — `federalist:51` paragraph 9 — Madison _[disputed]_
   > First. In a single republic, all the power surrendered by the people is submitted to the administration of a single government; and the usurpations are guarded against by a division of the government into distinct and separate departments. In the compound republic of America, the power surrendered by the people is firs…
9. **score 0.436** — `federalist:51` paragraph 6 — Madison _[disputed]_
   > But it is not possible to give to each department an equal power of self-defense. In republican government, the legislative authority necessarily predominates. The remedy for this inconveniency is to divide the legislature into different branches; and to render them, by different modes of election and different princip…
10. **score 0.436** — `federalist:51` paragraph 8 — Madison _[disputed]_
   > There are, moreover, two considerations particularly applicable to the federal system of America, which place that system in a very interesting point of view.

**Rationale (probe design):** The phrase is unique to Federalist 51. Tests phrase-level semantic retrieval, not just topical.

**Owner judgment:** pass

**Notes:** 

---

## P03 — body_substance

**Question:** What argument does Hamilton make for the power of courts to declare acts of the legislature void when they conflict with the Constitution?

**Must include:**

- federalist:78 — ✓ rank 1, score 0.525

**Top 10:**

1. **score 0.525** — `federalist:78` paragraph 9 — Hamilton
   > The complete independence of the courts of justice is peculiarly essential in a limited Constitution. By a limited Constitution, I understand one which contains certain specified exceptions to the legislative authority; such, for instance, as that it shall pass no bills of attainder, no ex post facto laws, and the like…
2. **score 0.525** — `federalist:78` paragraph 10 — Hamilton
   > Some perplexity respecting the rights of the courts to pronounce legislative acts void, because contrary to the Constitution, has arisen from an imagination that the doctrine would imply a superiority of the judiciary to the legislative power. It is urged that the authority which can declare the acts of another void, m…
3. **score 0.514** — `federalist:78` paragraph 12 — Hamilton
   > If it be said that the legislative body are themselves the constitutional judges of their own powers, and that the construction they put upon them is conclusive upon the other departments, it may be answered, that this cannot be the natural presumption, where it is not to be collected from any particular provisions in …
4. **score 0.490** — `federalist:78` paragraph 11 — Hamilton
   > There is no position which depends on clearer principles, than that every act of a delegated authority, contrary to the tenor of the commission under which it is exercised, is void. No legislative act, therefore, contrary to the Constitution, can be valid. To deny this, would be to affirm, that the deputy is greater th…
5. **score 0.473** — `federalist:80` paragraph 3 — Hamilton
   > The first point depends upon this obvious consideration, that there ought always to be a constitutional method of giving efficacy to constitutional provisions. What, for instance, would avail restrictions on the authority of the State legislatures, without some constitutional mode of enforcing the observance of them? T…
6. **score 0.471** — `federalist:81` paragraph 5 — Hamilton
   > In the first place, there is not a syllable in the plan under consideration which directly empowers the national courts to construe the laws according to the spirit of the Constitution, or which gives them any greater latitude in this respect than may be claimed by the courts of every State. I admit, however, that the …
7. **score 0.462** — `federalist:78` paragraph 16 — Hamilton
   > It can be of no weight to say that the courts, on the pretense of a repugnancy, may substitute their own pleasure to the constitutional intentions of the legislature. This might as well happen in the case of two contradictory statutes; or it might as well happen in every adjudication upon any single statute. The courts…
8. **score 0.461** — `federalist:78` paragraph 15 — Hamilton
   > But in regard to the interfering acts of a superior and subordinate authority, of an original and derivative power, the nature and reason of the thing indicate the converse of that rule as proper to be followed. They teach us that the prior act of a superior ought to be preferred to the subsequent act of an inferior an…
9. **score 0.460** — `federalist:78` paragraph 13 — Hamilton
   > Nor does this conclusion by any means suppose a superiority of the judicial to the legislative power. It only supposes that the power of the people is superior to both; and that where the will of the legislature, declared in its statutes, stands in opposition to that of the people, declared in the Constitution, the jud…
10. **score 0.450** — `federalist:16` paragraph 10 — Hamilton
   > But if the execution of the laws of the national government should not require the intervention of the State legislatures, if they were to pass into immediate operation upon the citizens themselves, the particular governments could not interrupt their progress without an open and violent exertion of an unconstitutional…

**Rationale (probe design):** Federalist 78 is the canonical pre-Marbury text on judicial review. Tests retrieval of constitutional doctrine framed in pre-modern terminology.

**Owner judgment:** pass

**Notes:** 

---

## P04 — body_substance

**Question:** Why does Hamilton argue that adding a Bill of Rights to the Constitution is unnecessary or even dangerous?

**Must include:**

- federalist:84 — ✓ rank 1, score 0.667

**Top 10:**

1. **score 0.667** — `federalist:84` paragraph 10 — Hamilton
   > I go further, and affirm that bills of rights, in the sense and to the extent in which they are contended for, are not only unnecessary in the proposed Constitution, but would even be dangerous. They would contain various exceptions to powers not granted; and, on this very account, would afford a colorable pretext to c…
2. **score 0.520** — `federalist:84` paragraph 12 — Hamilton
   > There remains but one other view of this matter to conclude the point. The truth is, after all the declamations we have heard, that the Constitution is itself, in every rational sense, and to every useful purpose, A BILL OF RIGHTS. The several bills of rights in Great Britain form its Constitution, and conversely the c…
3. **score 0.506** — `federalist:84` paragraph 2 — Hamilton
   > The most considerable of the remaining objections is that the plan of the convention contains no bill of rights. Among other answers given to this, it has been upon different occasions remarked that the constitutions of several of the States are in a similar predicament. I add that New York is of the number. And yet th…
4. **score 0.503** — `federalist:84` paragraph 8 — Hamilton
   > It has been several times truly remarked that bills of rights are, in their origin, stipulations between kings and their subjects, abridgements of prerogative in favor of privilege, reservations of rights not surrendered to the prince. Such was MAGNA CHARTA, obtained by the barons, sword in hand, from King John. Such w…
5. **score 0.478** — `federalist:26` paragraph 6 — Hamilton
   > From the same source, the people of America may be said to have derived an hereditary impression of danger to liberty, from standing armies in time of peace. The circumstances of a revolution quickened the public sensibility on every point connected with the security of popular rights, and in some instances raise the w…
6. **score 0.465** — `federalist:24` footnote (1) — Hamilton
   > This statement of the matter is taken from the printed collection of State constitutions. Pennsylvania and North Carolina are the two which contain the interdiction in these words: "As standing armies in time of peace are dangerous to liberty, THEY OUGHT NOT to be kept up." This is, in truth, rather a CAUTION than a PR…
7. **score 0.447** — `federalist:84` paragraph 9 — Hamilton
   > But a minute detail of particular rights is certainly far less applicable to a Constitution like that under consideration, which is merely intended to regulate the general political interests of the nation, than to a constitution which has the regulation of every species of personal and private concerns. If, therefore,…
8. **score 0.447** — `federalist:84` paragraph 5 — Hamilton
   > It may well be a question, whether these are not, upon the whole, of equal importance with any which are to be found in the constitution of this State. The establishment of the writ of habeas corpus, the prohibition of ex post facto laws, and of TITLES OF NOBILITY, to which we have no corresponding provision in our Con…
9. **score 0.447** — `federalist:84` paragraph 7 — Hamilton
   > To the second that is, to the pretended establishment of the common and state law by the Constitution, I answer, that they are expressly made subject "to such alterations and provisions as the legislature shall from time to time make concerning the same." They are therefore at any moment liable to repeal by the ordinar…
10. **score 0.442** — `federalist:84` paragraph 11 — Hamilton
   > On the subject of the liberty of the press, as much as has been said, I cannot forbear adding a remark or two: in the first place, I observe, that there is not a syllable concerning it in the constitution of this State; in the next, I contend, that whatever has been said about it in that of any other State, amounts to …

**Rationale (probe design):** Federalist 84 is Hamilton's principal argument against a Bill of Rights. Tests retrieval can find a position the founders explicitly opposed — the body of the corpus is not pro-rights-enumeration.

**Owner judgment:** pass

**Notes:** 

---

## P05 — footnote

**Question:** Which state constitutions in 1788 explicitly addressed standing armies in peacetime, and what did they actually say about whether such armies could be kept?

**Must include:**

- federalist:24 footnote (1) — ✓ rank 1, score 0.593

**Top 10:**

1. **score 0.593** — `federalist:24` footnote (1) — Hamilton
   > This statement of the matter is taken from the printed collection of State constitutions. Pennsylvania and North Carolina are the two which contain the interdiction in these words: "As standing armies in time of peace are dangerous to liberty, THEY OUGHT NOT to be kept up." This is, in truth, rather a CAUTION than a PR…
2. **score 0.579** — `federalist:24` paragraph 6 — Hamilton
   > If, under this impression, he proceeded to pass in review the several State constitutions, how great would be his disappointment to find that TWO ONLY of them(1) contained an interdiction of standing armies in time of peace; that the other eleven had either observed a profound silence on the subject, or had in express …
3. **score 0.528** — `federalist:26` paragraph 6 — Hamilton
   > From the same source, the people of America may be said to have derived an hereditary impression of danger to liberty, from standing armies in time of peace. The circumstances of a revolution quickened the public sensibility on every point connected with the security of popular rights, and in some instances raise the w…
4. **score 0.521** — `federalist:25` paragraph 9 — Hamilton
   > All violent policy, as it is contrary to the natural and experienced course of human affairs, defeats itself. Pennsylvania, at this instant, affords an example of the truth of this remark. The Bill of Rights of that State declares that standing armies are dangerous to liberty, and ought not to be kept up in time of pea…
5. **score 0.498** — `federalist:26` paragraph 7 — Hamilton
   > It is remarkable, that even in the two States which seem to have meditated an interdiction of military establishments in time of peace, the mode of expression made use of is rather cautionary than prohibitory. It is not said, that standing armies SHALL NOT BE kept up, but that they OUGHT NOT to be kept up, in time of p…
6. **score 0.437** — `federalist:25` paragraph 5 — Hamilton
   > There are other lights besides those already taken notice of, in which the impropriety of restraints on the discretion of the national legislature will be equally manifest. The design of the objection, which has been mentioned, is to preclude standing armies in time of peace, though we have never been informed how far …
7. **score 0.413** — `federalist:41` paragraph 18 — Madison
   > A bad cause seldom fails to betray itself. Of this truth, the management of the opposition to the federal government is an unvaried exemplification. But among all the blunders which have been committed, none is more striking than the attempt to enlist on that side the prudent jealousy entertained by the people, of stan…
8. **score 0.413** — `federalist:24` paragraph 11 — Hamilton
   > Previous to the Revolution, and ever since the peace, there has been a constant necessity for keeping small garrisons on our Western frontier. No person can doubt that these will continue to be indispensable, if it should only be against the ravages and depredations of the Indians. These garrisons must either be furnis…
9. **score 0.411** — `federalist:8` paragraph 9 — Hamilton
   > There is a wide difference, also, between military establishments in a country seldom exposed by its situation to internal invasions, and in one which is often subject to them, and always apprehensive of them. The rulers of the former can have no good pretext, if they are even so inclined, to keep on foot armies so num…
10. **score 0.409** — `federalist:24` paragraph 2 — Hamilton
   > It has indeed been brought forward in the most vague and general form, supported only by bold assertions, without the appearance of argument; without even the sanction of theoretical opinions; in contradiction to the practice of other free nations, and to the general sense of America, as expressed in most of the existi…

**Rationale (probe design):** The literal quoted text from Pennsylvania, North Carolina, New Hampshire, Massachusetts, Delaware, and Maryland constitutions lives in paper 24's footnote 1. The body of paper 24 argues against the standing-army objection abstractly and never names specific states. Pass: the footnote chunk appears in top-5; ideally ranks above the body chunks of the same paper that argue the topic abstractly. This is the probe that most directly tests whether footnote-as-chunk is doing real work.

**Owner judgment:** pass

**Notes:** 

---

## P06 — footnote

**Question:** How does Hamilton respond to the argument that the federal government's power of taxation could be used to suppress freedom of the press?

**Must include:**

- federalist:84 footnote (3) — ✓ rank 1, score 0.599

**Top 10:**

1. **score 0.599** — `federalist:84` footnote (3) — Hamilton
   > To show that there is a power in the Constitution by which the liberty of the press may be affected, recourse has been had to the power of taxation. It is said that duties may be laid upon the publications so high as to amount to a prohibition. I know not by what logic it could be maintained, that the declarations in t…
2. **score 0.482** — `federalist:84` paragraph 10 — Hamilton
   > I go further, and affirm that bills of rights, in the sense and to the extent in which they are contended for, are not only unnecessary in the proposed Constitution, but would even be dangerous. They would contain various exceptions to powers not granted; and, on this very account, would afford a colorable pretext to c…
3. **score 0.475** — `federalist:36` paragraph 18 — Hamilton
   > (I have now gone through the examination of those powers proposed to be conferred upon the federal government which relate more peculiarly to its energy, and to its efficiency for answering the great and primary objects of union. There are others which, though omitted here, will, in order to render the view of the subj…
4. **score 0.465** — `federalist:36` paragraph 16 — Hamilton
   > As to poll taxes, I, without scruple, confess my disapprobation of them; and though they have prevailed from an early period in those States(1) which have uniformly been the most tenacious of their rights, I should lament to see them introduced into practice under the national government. But does it follow because the…
5. **score 0.464** — `federalist:31` paragraph 11 — Hamilton
   > This mode of reasoning appears sometimes to turn upon the supposition of usurpation in the national government; at other times it seems to be designed only as a deduction from the constitutional operation of its intended powers. It is only in the latter light that it can be admitted to have any pretensions to fairness.…
6. **score 0.457** — `federalist:33` paragraph 2 — Hamilton
   > These two clauses have been the source of much virulent invective and petulant declamation against the proposed Constitution. They have been held up to the people in all the exaggerated colors of misrepresentation as the pernicious engines by which their local governments were to be destroyed and their liberties exterm…
7. **score 0.455** — `federalist:31` paragraph 10 — Hamilton
   > Those of them which have been most labored with that view, seem in substance to amount to this: "It is not true, because the exigencies of the Union may not be susceptible of limitation, that its power of laying taxes ought to be unconfined. Revenue is as requisite to the purposes of the local administrations as to tho…
8. **score 0.451** — `federalist:36` paragraph 14 — Hamilton
   > As to any argument derived from a supposed system of influence, it is a sufficient answer to say that it ought not to be presumed; but the supposition is susceptible of a more precise answer. If such a spirit should infest the councils of the Union, the most certain road to the accomplishment of its aim would be to emp…
9. **score 0.446** — `federalist:35` paragraph 4 — Hamilton
   > So far as these observations tend to inculcate a danger of the import duties being extended to an injurious extreme it may be observed, conformably to a remark made in another part of these papers, that the interest of the revenue itself would be a sufficient guard against such an extreme. I readily admit that this wou…
10. **score 0.444** — `federalist:32` paragraph 1 — Hamilton
   > ALTHOUGH I am of opinion that there would be no real danger of the consequences which seem to be apprehended to the State governments from a power in the Union to control them in the levies of money, because I am persuaded that the sense of the people, the extreme hazard of provoking the resentments of the State govern…

**Rationale (probe design):** Hamilton extends his anti-Bill-of-Rights argument with a specific anti-press-tax response in paper 84's footnote 3 — arguing that state-constitution press-freedom declarations don't prevent press-suppressing taxation, so the federal silence is no worse. The body of paper 84 discusses Bill of Rights more abstractly. Second footnote-as-chunk test.

**Owner judgment:** pass

**Notes:** 

---

## P07 — footnote

**Question:** How does Hamilton respond to the pseudonymous writer 'TAMONY' on the source of the British king's prerogative as commander-in-chief?

**Must include:**

- federalist:69 footnote (1) — ✓ rank 1, score 0.542

**Top 10:**

1. **score 0.542** — `federalist:69` footnote (1) — Hamilton
   > A writer in a Pennsylvania paper, under the signature of TAMONY, has asserted that the king of Great Britain owes his prerogative as commander-in-chief to an annual mutiny bill. The truth is, on the contrary, that his prerogative, in this respect, is immemorial, and was only disputed, "contrary to all reason and preced…
2. **score 0.414** — `federalist:69` paragraph 11 — Hamilton
   > The President of the United States would be an officer elected by the people for four years; the king of Great Britain is a perpetual and hereditary prince. The one would be amenable to personal punishment and disgrace; the person of the other is sacred and inviolable. The one would have a qualified negative upon the a…
3. **score 0.413** — `federalist:67` paragraph 5 — Hamilton
   > In the execution of this task, there is no man who would not find it an arduous effort either to behold with moderation, or to treat with seriousness, the devices, not less weak than wicked, which have been contrived to pervert the public opinion in relation to the subject. They so far exceed the usual though unjustifi…
4. **score 0.405** — `federalist:67` paragraph 3 — Hamilton
   > Here the writers against the Constitution seem to have taken pains to signalize their talent of misrepresentation. Calculating upon the aversion of the people to monarchy, they have endeavored to enlist all their jealousies and apprehensions in opposition to the intended President of the United States; not merely as th…
5. **score 0.400** — `federalist:74` paragraph 0 — Hamilton
   > To the People of the State of New York:
6. **score 0.398** — `federalist:69` paragraph 6 — Hamilton
   > The President is to be the "commander-in-chief of the army and navy of the United States, and of the militia of the several States, when called into the actual service of the United States. He is to have power to grant reprieves and pardons for offenses against the United States, except in cases of impeachment; to reco…
7. **score 0.396** — `federalist:26` paragraph 4 — Hamilton
   > In England, for a long time after the Norman Conquest, the authority of the monarch was almost unlimited. Inroads were gradually made upon the prerogative, in favor of liberty, first by the barons, and afterwards by the people, till the greatest part of its most formidable pretensions became extinct. But it was not til…
8. **score 0.390** — `federalist:69` footnote (3) — Hamilton
   > Candor, however, demands an acknowledgment that I do not think the claim of the governor to a right of nomination well founded. Yet it is always justifiable to reason from the practice of a government, till its propriety has been constitutionally questioned. And independent of this claim, when we take into view the oth…
9. **score 0.388** — `federalist:74` paragraph 1 — Hamilton
   > THE President of the United States is to be "commander-in-chief of the army and navy of the United States, and of the militia of the several States when called into the actual service of the United States." The propriety of this provision is so evident in itself, and it is, at the same time, so consonant to the precede…
10. **score 0.382** — `federalist:69` paragraph 10 — Hamilton
   > Hence it appears that, except as to the concurrent authority of the President in the article of treaties, it would be difficult to determine whether that magistrate would, in the aggregate, possess more or less power than the Governor of New York. And it appears yet more unequivocally, that there is no pretense for the…

**Rationale (probe design):** TAMONY is mentioned only in paper 69's footnote 1, where Hamilton refutes the claim that the king's commander-in-chief prerogative comes from an annual mutiny bill, citing Blackstone and 13 Car. II c. 6. Specific historical/textual probe — TAMONY does not appear anywhere in the body. Third footnote-as-chunk test, narrower than P05/P06.

**Owner judgment:** pass

**Notes:** 

---

## P08 — body_multi

**Question:** What is the scope of the federal government's 'necessary and proper' power, and how is it constrained?

**Must include:**

- federalist:33 — ✓ rank 2, score 0.411
- federalist:44 — ✓ rank 1, score 0.438

**Top 10:**

1. **score 0.438** — `federalist:44` paragraph 10 — Madison
   > 1. Of these the first is, the "power to make all laws which shall be necessary and proper for carrying into execution the foregoing powers, and all other powers vested by this Constitution in the government of the United States, or in any department or officer thereof."
2. **score 0.411** — `federalist:33` paragraph 6 — Hamilton
   > But it may be again asked, Who is to judge of the NECESSITY and PROPRIETY of the laws to be passed for executing the powers of the Union? I answer, first, that this question arises as well and as fully upon the simple grant of those powers as upon the declaratory clause; and I answer, in the second place, that the nati…
3. **score 0.393** — `federalist:44` paragraph 14 — Madison
   > Had the convention attempted a positive enumeration of the powers necessary and proper for carrying their other powers into effect, the attempt would have involved a complete digest of laws on every subject to which the Constitution relates; accommodated too, not only to the existing state of things, but to all the pos…
4. **score 0.390** — `federalist:44` paragraph 12 — Madison
   > There are four other possible methods which the Constitution might have taken on this subject. They might have copied the second article of the existing Confederation, which would have prohibited the exercise of any power not EXPRESSLY delegated; they might have attempted a positive enumeration of the powers comprehend…
5. **score 0.390** — `federalist:44` paragraph 15 — Madison
   > Had they attempted to enumerate the particular powers or means not necessary or proper for carrying the general powers into execution, the task would have been no less chimerical; and would have been liable to this further objection, that every defect in the enumeration would have been equivalent to a positive grant of…
6. **score 0.381** — `federalist:33` paragraph 4 — Hamilton
   > This simple train of inquiry furnishes us at once with a test by which to judge of the true nature of the clause complained of. It conducts us to this palpable truth, that a power to lay and collect taxes must be a power to pass all laws NECESSARY and PROPER for the execution of that power; and what does the unfortunat…
7. **score 0.379** — `federalist:41` paragraph 4 — Madison
   > It cannot have escaped those who have attended with candor to the arguments employed against the extensive powers of the government, that the authors of them have very little considered how far these powers were necessary means of attaining a necessary end. They have chosen rather to dwell on the inconveniences which m…
8. **score 0.359** — `federalist:44` paragraph 13 — Madison
   > Had the convention taken the first method of adopting the second article of Confederation, it is evident that the new Congress would be continually exposed, as their predecessors have been, to the alternative of construing the term "EXPRESSLY" with so much rigor, as to disarm the government of all real authority whatev…
9. **score 0.358** — `federalist:44` paragraph 16 — Madison
   > Had the Constitution been silent on this head, there can be no doubt that all the particular powers requisite as means of executing the general powers would have resulted to the government, by unavoidable implication. No axiom is more clearly established in law, or in reason, than that wherever the end is required, the…
10. **score 0.356** — `federalist:44` paragraph 28 — Madison
   > We have now reviewed, in detail, all the articles composing the sum or quantity of power delegated by the proposed Constitution to the federal government, and are brought to this undeniable conclusion, that no part of the power is unnecessary or improper for accomplishing the necessary objects of the Union. The questio…

**Rationale (probe design):** Hamilton (33) and Madison (44) both defend the necessary-and-proper clause but frame the constraint differently — Hamilton via structural redundancy and the supremacy clause, Madison via interpretive necessity and the alternative drafting choices the convention rejected. Pass: both papers in top-K. The no-flattening discipline is met if the retrieval surfaces both rather than collapsing to one — tests complementary-but-distinct argumentation across authors.

**Owner judgment:** pass

**Notes:** 

---

## P09 — body_substance

**Question:** Why does the Federalist defend a six-year term for senators rather than something shorter?

**Must include:**

- federalist:62 — ✓ rank 7, score 0.549

**Top 10:**

1. **score 0.607** — `federalist:63` paragraph 15 — Madison _[disputed]_
   > In answer to all these arguments, suggested by reason, illustrated by examples, and enforced by our own experience, the jealous adversary of the Constitution will probably content himself with repeating, that a senate appointed not immediately by the people, and for the term of six years, must gradually acquire a dange…
2. **score 0.592** — `federalist:63` paragraph 5 — Madison _[disputed]_
   > Responsibility, in order to be reasonable, must be limited to objects within the power of the responsible party, and in order to be effectual, must relate to operations of that power, of which a ready and proper judgment can be formed by the constituents. The objects of government may be divided into two general classe…
3. **score 0.564** — `federalist:64` paragraph 5 — Jay
   > Although the absolute necessity of system, in the conduct of any business, is universally known and acknowledged, yet the high importance of it in national affairs has not yet become sufficiently impressed on the public mind. They who wish to commit the power under consideration to a popular assembly, composed of membe…
4. **score 0.554** — `federalist:59` paragraph 8 — Hamilton
   > It may be easily discerned also that the national government would run a much greater risk from a power in the State legislatures over the elections of its House of Representatives, than from their power of appointing the members of its Senate. The senators are to be chosen for the period of six years; there is to be a…
5. **score 0.552** — `federalist:63` paragraph 4 — Madison _[disputed]_
   > I add, as a SIXTH defect the want, in some important cases, of a due responsibility in the government to the people, arising from that frequency of elections which in other cases produces this responsibility. This remark will, perhaps, appear not only new, but paradoxical. It must nevertheless be acknowledged, when exp…
6. **score 0.549** — `federalist:63` paragraph 19 — Madison _[disputed]_
   > But if anything could silence the jealousies on this subject, it ought to be the British example. The Senate there instead of being elected for a term of six years, and of being unconfined to particular families or fortunes, is an hereditary assembly of opulent nobles. The House of Representatives, instead of being ele…
7. **score 0.549** — `federalist:62` paragraph 9 — Madison _[disputed]_
   > Second. The necessity of a senate is not less indicated by the propensity of all single and numerous assemblies to yield to the impulse of sudden and violent passions, and to be seduced by factious leaders into intemperate and pernicious resolutions. Examples on this subject might be cited without number; and from proc…
8. **score 0.544** — `federalist:62` paragraph 12 — Madison _[disputed]_
   > Fourth. The mutability in the public councils arising from a rapid succession of new members, however qualified they may be, points out, in the strongest manner, the necessity of some stable institution in the government. Every new election in the States is found to change one half of the representatives. From this cha…
9. **score 0.534** — `federalist:63` paragraph 3 — Madison _[disputed]_
   > Yet however requisite a sense of national character may be, it is evident that it can never be sufficiently possessed by a numerous and changeable body. It can only be found in a number so small that a sensible degree of the praise and blame of public measures may be the portion of each individual; or in an assembly so…
10. **score 0.532** — `federalist:62` paragraph 2 — Madison _[disputed]_
   > I. The qualifications proposed for senators, as distinguished from those of representatives, consist in a more advanced age and a longer period of citizenship. A senator must be thirty years of age at least; as a representative must be twenty-five. And the former must have been a citizen nine years; as seven years are …

**Rationale (probe design):** Senate term length and the role of the Senate as a stabilizing body. Standard body_substance retrieval test — paper 62 in top-K. The disputed-authorship test is carried by P10 alone, not duplicated here.

**Owner judgment:** pass

**Notes:** 

---

## P10 — authorship_edge

**Question:** Why does the Federalist warn against frequent appeals to the people to resolve constitutional disputes between the branches of government?

**Must include:**

- federalist:49 — ✓ rank 1, score 0.501

**Top 10:**

1. **score 0.501** — `federalist:49` paragraph 7 — Madison _[disputed]_
   > The danger of disturbing the public tranquillity by interesting too strongly the public passions, is a still more serious objection against a frequent reference of constitutional questions to the decision of the whole society. Notwithstanding the success which has attended the revisions of our established forms of gove…
2. **score 0.496** — `federalist:49` paragraph 8 — Madison _[disputed]_
   > But the greatest objection of all is, that the decisions which would probably result from such appeals would not answer the purpose of maintaining the constitutional equilibrium of the government. We have seen that the tendency of republican governments is to an aggrandizement of the legislative at the expense of the o…
3. **score 0.496** — `federalist:50` paragraph 2 — Madison _[disputed]_
   > It will be attended to, that in the examination of these expedients, I confine myself to their aptitude for ENFORCING the Constitution, by keeping the several departments of power within their due bounds, without particularly considering them as provisions for ALTERING the Constitution itself. In the first view, appeal…
4. **score 0.476** — `federalist:49` paragraph 10 — Madison _[disputed]_
   > It might, however, sometimes happen, that appeals would be made under circumstances less adverse to the executive and judiciary departments. The usurpations of the legislature might be so flagrant and so sudden, as to admit of no specious coloring. A strong party among themselves might take side with the other branches…
5. **score 0.476** — `federalist:49` paragraph 4 — Madison _[disputed]_
   > There is certainly great force in this reasoning, and it must be allowed to prove that a constitutional road to the decision of the people ought to be marked out and kept open, for certain great and extraordinary occasions. But there appear to be insuperable objections against the proposed recurrence to the people, as …
6. **score 0.475** — `federalist:49` paragraph 6 — Madison _[disputed]_
   > In the next place, it may be considered as an objection inherent in the principle, that as every appeal to the people would carry an implication of some defect in the government, frequent appeals would, in a great measure, deprive the government of that veneration which time bestows on every thing, and without which pe…
7. **score 0.471** — `federalist:49` paragraph 3 — Madison _[disputed]_
   > As the people are the only legitimate fountain of power, and it is from them that the constitutional charter, under which the several branches of government hold their power, is derived, it seems strictly consonant to the republican theory, to recur to the same original authority, not only whenever it may be necessary …
8. **score 0.441** — `federalist:49` paragraph 11 — Madison _[disputed]_
   > We found in the last paper, that mere declarations in the written constitution are not sufficient to restrain the several departments within their legal rights. It appears in this, that occasional appeals to the people would be neither a proper nor an effectual provision for that purpose. How far the provisions of a di…
9. **score 0.420** — `federalist:50` paragraph 1 — Madison _[disputed]_
   > IT MAY be contended, perhaps, that instead of OCCASIONAL appeals to the people, which are liable to the objections urged against them, PERIODICAL appeals are the proper and adequate means of PREVENTING AND CORRECTING INFRACTIONS OF THE CONSTITUTION.
10. **score 0.405** — `federalist:49` paragraph 1 — Madison _[disputed]_
   > THE author of the "Notes on the State of Virginia," quoted in the last paper, has subjoined to that valuable work the draught of a constitution, which had been prepared in order to be laid before a convention, expected to be called in 1783, by the legislature, for the establishment of a constitution for that commonweal…

**Rationale (probe design):** Federalist 49 is the canonical argument against constitutional-revision plebiscites. Disputed-authorship paper, attributed to Madison by Mosteller-Wallace consensus, with Hamilton's historical claim preserved in authorship_note. Tests: (a) retrieval finds it, (b) the row carries authors: ["Madison"] not Hamilton, (c) authorship_status: "disputed" and authorship_note are visible to whatever consumes the result row.

**Owner judgment:** pass

**Notes:** 

---

## P11 — body_substance

**Question:** What objections to a peacetime standing army does the Federalist consider, and how does it answer them at the level of constitutional design rather than by citing existing state constitutions?

**Must include:**

- federalist:24 — ✓ rank 1, score 0.589
- federalist:25 — ✓ rank 3, score 0.566
- federalist:26 — ✓ rank 5, score 0.548

**Top 10:**

1. **score 0.589** — `federalist:24` paragraph 1 — Hamilton
   > TO THE powers proposed to be conferred upon the federal government, in respect to the creation and direction of the national forces, I have met with but one specific objection, which, if I understand it right, is this, that proper provision has not been made against the existence of standing armies in time of peace; an…
2. **score 0.579** — `federalist:24` paragraph 11 — Hamilton
   > Previous to the Revolution, and ever since the peace, there has been a constant necessity for keeping small garrisons on our Western frontier. No person can doubt that these will continue to be indispensable, if it should only be against the ravages and depredations of the Indians. These garrisons must either be furnis…
3. **score 0.566** — `federalist:25` paragraph 5 — Hamilton
   > There are other lights besides those already taken notice of, in which the impropriety of restraints on the discretion of the national legislature will be equally manifest. The design of the objection, which has been mentioned, is to preclude standing armies in time of peace, though we have never been informed how far …
4. **score 0.558** — `federalist:24` paragraph 6 — Hamilton
   > If, under this impression, he proceeded to pass in review the several State constitutions, how great would be his disappointment to find that TWO ONLY of them(1) contained an interdiction of standing armies in time of peace; that the other eleven had either observed a profound silence on the subject, or had in express …
5. **score 0.548** — `federalist:26` paragraph 6 — Hamilton
   > From the same source, the people of America may be said to have derived an hereditary impression of danger to liberty, from standing armies in time of peace. The circumstances of a revolution quickened the public sensibility on every point connected with the security of popular rights, and in some instances raise the w…
6. **score 0.538** — `federalist:41` paragraph 18 — Madison
   > A bad cause seldom fails to betray itself. Of this truth, the management of the opposition to the federal government is an unvaried exemplification. But among all the blunders which have been committed, none is more striking than the attempt to enlist on that side the prudent jealousy entertained by the people, of stan…
7. **score 0.532** — `federalist:24` footnote (1) — Hamilton
   > This statement of the matter is taken from the printed collection of State constitutions. Pennsylvania and North Carolina are the two which contain the interdiction in these words: "As standing armies in time of peace are dangerous to liberty, THEY OUGHT NOT to be kept up." This is, in truth, rather a CAUTION than a PR…
8. **score 0.532** — `federalist:24` paragraph 4 — Hamilton
   > If he came afterwards to peruse the plan itself, he would be surprised to discover, that neither the one nor the other was the case; that the whole power of raising armies was lodged in the LEGISLATURE, not in the EXECUTIVE; that this legislature was to be a popular body, consisting of the representatives of the people…
9. **score 0.529** — `federalist:41` paragraph 16 — Madison
   > Next to the effectual establishment of the Union, the best possible precaution against danger from standing armies is a limitation of the term for which revenue may be appropriated to their support. This precaution the Constitution has prudently added. I will not repeat here the observations which I flatter myself have…
10. **score 0.524** — `federalist:24` paragraph 2 — Hamilton
   > It has indeed been brought forward in the most vague and general form, supported only by bold assertions, without the appearance of argument; without even the sanction of theoretical opinions; in contradiction to the practice of other free nations, and to the general sense of America, as expressed in most of the existi…

**Rationale (probe design):** Counterpoint to P05: this question targets the body-text argument about standing armies, where P05 targets the footnote with state-constitution citations. If both probes return the same chunks, the chunking didn't discriminate. Ideally P11 surfaces body chunks from 24/25/26 and P05 surfaces the paper 24 footnote — the same source material, two different argumentative roles.

**Owner judgment:** pass

**Notes:** 

---

## P12 — body_substance

**Question:** How does the Federalist describe the role of the Senate in approving treaties, and why is the Senate involved rather than the executive alone?

**Must include:**

- federalist:75 — ✓ rank 1, score 0.583

**Top 10:**

1. **score 0.583** — `federalist:75` paragraph 4 — Hamilton
   > To have intrusted the power of making treaties to the Senate alone, would have been to relinquish the benefits of the constitutional agency of the President in the conduct of foreign negotiations. It is true that the Senate would, in that case, have the option of employing him in this capacity, but they would also have…
2. **score 0.557** — `federalist:75` paragraph 7 — Hamilton
   > To require a fixed proportion of the whole body would not, in all probability, contribute to the advantages of a numerous agency, better then merely to require a proportion of the attending members. The former, by making a determinate number at all times requisite to a resolution, diminishes the motives to punctual att…
3. **score 0.556** — `federalist:75` paragraph 2 — Hamilton
   > With regard to the intermixture of powers, I shall rely upon the explanations already given in other places, of the true sense of the rule upon which that objection is founded; and shall take it for granted, as an inference from them, that the union of the Executive with the Senate, in the article of treaties, is no in…
4. **score 0.546** — `federalist:64` paragraph 3 — Jay
   > The power of making treaties is an important one, especially as it relates to war, peace, and commerce; and it should not be delegated but in such a mode, and with such precautions, as will afford the highest security that it will be exercised by men the best qualified for the purpose, and in the manner most conducive …
5. **score 0.545** — `federalist:75` paragraph 1 — Hamilton
   > THE President is to have power, "by and with the advice and consent of the Senate, to make treaties, provided two thirds of the senators present concur." Though this provision has been assailed, on different grounds, with no small degree of vehemence, I scruple not to declare my firm persuasion, that it is one of the b…
6. **score 0.538** — `federalist:75` paragraph 5 — Hamilton
   > The remarks made in a former number, which have been alluded to in another part of this paper, will apply with conclusive force against the admission of the House of Representatives to a share in the formation of treaties. The fluctuating and, taking its future increase into the account, the multitudinous composition o…
7. **score 0.533** — `federalist:66` paragraph 12 — Hamilton
   > The security essentially intended by the Constitution against corruption and treachery in the formation of treaties, is to be sought for in the numbers and characters of those who are to make them. The JOINT AGENCY of the Chief Magistrate of the Union, and of two thirds of the members of a body selected by the collecti…
8. **score 0.525** — `federalist:64` paragraph 4 — Jay
   > As the select assemblies for choosing the President, as well as the State legislatures who appoint the senators, will in general be composed of the most enlightened and respectable citizens, there is reason to presume that their attention and their votes will be directed to those men only who have become the most disti…
9. **score 0.518** — `federalist:69` paragraph 7 — Hamilton
   > The President is to have power, with the advice and consent of the Senate, to make treaties, provided two thirds of the senators present concur. The king of Great Britain is the sole and absolute representative of the nation in all foreign transactions. He can of his own accord make treaties of peace, commerce, allianc…
10. **score 0.518** — `federalist:64` paragraph 5 — Jay
   > Although the absolute necessity of system, in the conduct of any business, is universally known and acknowledged, yet the high importance of it in national affairs has not yet become sufficiently impressed on the public mind. They who wish to commit the power under consideration to a popular assembly, composed of membe…

**Rationale (probe design):** Federalist 75 is Hamilton on the treaty power and the structural reasoning for joint executive-legislative involvement. Tests retrieval of a specific structural-design argument.

**Owner judgment:** pass

**Notes:** 

---

## P13 — negative_space

**Question:** How does the Federalist describe the role of political parties in nominating presidential candidates, and what process governs party nominations under the Constitution?

**Must include:** _(none — qualitative probe)_

**Top 10:**

1. **score 0.373** — `federalist:68` paragraph 5 — Hamilton
   > Nothing was more to be desired than that every practicable obstacle should be opposed to cabal, intrigue, and corruption. These most deadly adversaries of republican government might naturally have been expected to make their approaches from more than one quarter, but chiefly from the desire in foreign powers to gain a…
2. **score 0.365** — `federalist:68` footnote (1) — Hamilton
   > Vide federal farmer.
3. **score 0.357** — `federalist:68` footnote (E1) — Hamilton
   > Some editions substitute "desired" for "wished for".
4. **score 0.354** — `federalist:77` paragraph 6 — Hamilton
   > The reverse of all this characterizes the manner of appointment in this State. The council of appointment consists of from three to five persons, of whom the governor is always one. This small body, shut up in a private apartment, impenetrable to the public eye, proceed to the execution of the trust committed to them. …
5. **score 0.353** — `federalist:68` paragraph 8 — Hamilton
   > The process of election affords a moral certainty, that the office of President will never fall to the lot of any man who is not in an eminent degree endowed with the requisite qualifications. Talents for low intrigue, and the little arts of popularity, may alone suffice to elevate a man to the first honors in a single…
6. **score 0.338** — `federalist:68` paragraph 4 — Hamilton
   > It was also peculiarly desirable to afford as little opportunity as possible to tumult and disorder. This evil was not least to be dreaded in the election of a magistrate, who was to have so important an agency in the administration of the government as the President of the United States. But the precautions which have…
7. **score 0.336** — `federalist:68` paragraph 7 — Hamilton
   > All these advantages will happily combine in the plan devised by the convention; which is, that the people of each State shall choose a number of persons as electors, equal to the number of senators and representatives of such State in the national government, who shall assemble within the State, and vote for some fit …
8. **score 0.332** — `federalist:68` paragraph 10 — Hamilton
   > The Vice-President is to be chosen in the same manner with the President; with this difference, that the Senate is to do, in respect to the former, what is to be done by the House of Representatives, in respect to the latter.
9. **score 0.327** — `federalist:68` paragraph 1 — Hamilton
   > THE mode of appointment of the Chief Magistrate of the United States is almost the only part of the system, of any consequence, which has escaped without severe censure, or which has received the slightest mark of approbation from its opponents. The most plausible of these, who has appeared in print, has even deigned t…
10. **score 0.322** — `federalist:68` paragraph 2 — Hamilton
   > It was desirable that the sense of the people should operate in the choice of the person to whom so important a trust was to be confided. This end will be answered by committing the right of making it, not to any preestablished body, but to men chosen by the people for the special purpose, and at the particular conjunc…

**Rationale (probe design):** Negative-space probe: political parties as nominating institutions are post-Federalist (the modern party system formed during the 1790s; the convention/primary system is 19th- and 20th-century). The Federalist explicitly argues against faction (Madison, 10) but never describes a nomination process, because no such institution existed at ratification. Tempting wrong-answer targets in the corpus: paper 10 (factions are dangerous), 68 (electoral mechanism), 70-72 (executive structure). Pass criteria: top-K similarity scores should be visibly lower than for in-corpus probes — the runner's report should make this score gap legible. If retrieval returns confident-looking high scores on tangential papers, the test has surfaced a calibration issue, not a retrieval bug per se. The signal informs Phase 1.2+ system-prompt work: the Q&A layer must learn to distinguish weak retrieval from real grounding rather than confabulating from tangentially relevant hits. Replaces the prior adversarial 'democratic vs. anti-democratic' probe, which is properly a Q&A-layer test rather than a retrieval-layer test (Phase 3, system prompt design).

**Owner judgment:** pass

**Notes:** 

---
