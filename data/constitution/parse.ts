import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const RAW_BODY = join(here, 'raw', 'constitution-body.txt');
const RAW_BOR = join(here, 'raw', 'bill-of-rights.txt');
const RAW_AMEND = join(here, 'raw', 'amendments-11-27.txt');
const OUT_PATH = join(here, 'constitution.json');

const BODY_URL = 'https://www.archives.gov/founding-docs/constitution-transcript';
const BOR_URL = 'https://www.archives.gov/founding-docs/bill-of-rights-transcript';
const AMEND_URL = 'https://www.archives.gov/founding-docs/amendments-11-27';
const FETCHED = '2026-05-18';

const RATIFICATION_BODY = '1788-06-21';
const RATIFICATION_BOR = '1791-12-15';
const FRAMERS = ['Framers'];
const BOR_AUTHORS = ['1st Congress'];

type Kind = 'preamble' | 'body_clause' | 'amendment_clause';

type ConstitutionExt = {
  kind: Kind;
  article: number | null;
  section: number | null;
  clause: number | null;
  amendment: number | null;
  short_names: string[];
  superseded_by: string[];
};

type Item = {
  id: string;
  corpus: 'constitution';
  title: string;
  authors: string[];
  date: string;
  language: 'en';
  paragraphs: string[];
  footnotes: never[];
  plain_english: null;
  constitutional_section: null;
  topic_tags: string[];
  constitution: ConstitutionExt;
};

function bodyClause(opts: {
  locator: string;
  article: number;
  section: number | null;
  clause: number | null;
  title: string;
  shortNames?: string[];
  text: string | string[];
  supersededBy?: string[];
}): Item {
  return {
    id: `constitution:${opts.locator}`,
    corpus: 'constitution',
    title: opts.title,
    authors: FRAMERS,
    date: RATIFICATION_BODY,
    language: 'en',
    paragraphs: typeof opts.text === 'string' ? [opts.text] : opts.text,
    footnotes: [],
    plain_english: null,
    constitutional_section: null,
    topic_tags: [],
    constitution: {
      kind: 'body_clause',
      article: opts.article,
      section: opts.section,
      clause: opts.clause,
      amendment: null,
      short_names: opts.shortNames ?? [],
      superseded_by: opts.supersededBy ?? [],
    },
  };
}

function amendmentClause(opts: {
  locator: string;
  amendment: number;
  section: number | null;
  clause: number | null;
  title: string;
  authors: string[];
  date: string;
  shortNames?: string[];
  text: string | string[];
  supersededBy?: string[];
}): Item {
  return {
    id: `constitution:${opts.locator}`,
    corpus: 'constitution',
    title: opts.title,
    authors: opts.authors,
    date: opts.date,
    language: 'en',
    paragraphs: typeof opts.text === 'string' ? [opts.text] : opts.text,
    footnotes: [],
    plain_english: null,
    constitutional_section: null,
    topic_tags: [],
    constitution: {
      kind: 'amendment_clause',
      article: null,
      section: opts.section,
      clause: opts.clause,
      amendment: opts.amendment,
      short_names: opts.shortNames ?? [],
      superseded_by: opts.supersededBy ?? [],
    },
  };
}

// Bracketed prefix used to make Article I §8 clauses 2–18 independently readable.
// Each carries the elided antecedent "[The Congress shall have Power]". The
// verification step strips bracketed segments before substring-checking the
// clause text against the raw source.
const ELIDE = '[The Congress shall have Power] ';

// --- Preamble ---------------------------------------------------------------

const preamble: Item = {
  id: 'constitution:preamble',
  corpus: 'constitution',
  title: 'Preamble',
  authors: FRAMERS,
  date: RATIFICATION_BODY,
  language: 'en',
  paragraphs: [
    'We the People of the United States, in Order to form a more perfect Union, establish Justice, insure domestic Tranquility, provide for the common defence, promote the general Welfare, and secure the Blessings of Liberty to ourselves and our Posterity, do ordain and establish this Constitution for the United States of America.',
  ],
  footnotes: [],
  plain_english: null,
  constitutional_section: null,
  topic_tags: [],
  constitution: {
    kind: 'preamble',
    article: null,
    section: null,
    clause: null,
    amendment: null,
    short_names: ['Preamble'],
    superseded_by: [],
  },
};

// --- Article I --------------------------------------------------------------

const articleI: Item[] = [
  bodyClause({
    locator: 'art1.sec1',
    article: 1, section: 1, clause: null,
    title: 'Article I, Section 1',
    shortNames: ['Legislative Vesting Clause'],
    text: 'All legislative Powers herein granted shall be vested in a Congress of the United States, which shall consist of a Senate and House of Representatives.',
  }),
  bodyClause({
    locator: 'art1.sec2.cl1',
    article: 1, section: 2, clause: 1,
    title: 'Article I, Section 2, Clause 1',
    text: 'The House of Representatives shall be composed of Members chosen every second Year by the People of the several States, and the Electors in each State shall have the Qualifications requisite for Electors of the most numerous Branch of the State Legislature.',
  }),
  bodyClause({
    locator: 'art1.sec2.cl2',
    article: 1, section: 2, clause: 2,
    title: 'Article I, Section 2, Clause 2',
    shortNames: ['House Qualifications Clause'],
    text: 'No Person shall be a Representative who shall not have attained to the Age of twenty five Years, and been seven Years a Citizen of the United States, and who shall not, when elected, be an Inhabitant of that State in which he shall be chosen.',
  }),
  bodyClause({
    locator: 'art1.sec2.cl3',
    article: 1, section: 2, clause: 3,
    title: 'Article I, Section 2, Clause 3',
    shortNames: ['Apportionment Clause', 'Three-Fifths Clause'],
    text: 'Representatives and direct Taxes shall be apportioned among the several States which may be included within this Union, according to their respective Numbers, which shall be determined by adding to the whole Number of free Persons, including those bound to Service for a Term of Years, and excluding Indians not taxed, three fifths of all other Persons. The actual Enumeration shall be made within three Years after the first Meeting of the Congress of the United States, and within every subsequent Term of ten Years, in such Manner as they shall by Law direct. The Number of Representatives shall not exceed one for every thirty Thousand, but each State shall have at Least one Representative; and until such enumeration shall be made, the State of New Hampshire shall be entitled to chuse three, Massachusetts eight, Rhode-Island and Providence Plantations one, Connecticut five, New-York six, New Jersey four, Pennsylvania eight, Delaware one, Maryland six, Virginia ten, North Carolina five, South Carolina five, and Georgia three.',
    supersededBy: ['constitution:amdt14.sec2'],
  }),
  bodyClause({
    locator: 'art1.sec2.cl4',
    article: 1, section: 2, clause: 4,
    title: 'Article I, Section 2, Clause 4',
    text: 'When vacancies happen in the Representation from any State, the Executive Authority thereof shall issue Writs of Election to fill such Vacancies.',
  }),
  bodyClause({
    locator: 'art1.sec2.cl5',
    article: 1, section: 2, clause: 5,
    title: 'Article I, Section 2, Clause 5',
    shortNames: ['House Impeachment Clause'],
    text: 'The House of Representatives shall chuse their Speaker and other Officers; and shall have the sole Power of Impeachment.',
  }),
  bodyClause({
    locator: 'art1.sec3.cl1',
    article: 1, section: 3, clause: 1,
    title: 'Article I, Section 3, Clause 1',
    text: 'The Senate of the United States shall be composed of two Senators from each State, chosen by the Legislature thereof, for six Years; and each Senator shall have one Vote.',
    supersededBy: ['constitution:amdt17.cl1'],
  }),
  bodyClause({
    locator: 'art1.sec3.cl2',
    article: 1, section: 3, clause: 2,
    title: 'Article I, Section 3, Clause 2',
    text: 'Immediately after they shall be assembled in Consequence of the first Election, they shall be divided as equally as may be into three Classes. The Seats of the Senators of the first Class shall be vacated at the Expiration of the second Year, of the second Class at the Expiration of the fourth Year, and of the third Class at the Expiration of the sixth Year, so that one third may be chosen every second Year; and if Vacancies happen by Resignation, or otherwise, during the Recess of the Legislature of any State, the Executive thereof may make temporary Appointments until the next Meeting of the Legislature, which shall then fill such Vacancies.',
    supersededBy: ['constitution:amdt17.cl2'],
  }),
  bodyClause({
    locator: 'art1.sec3.cl3',
    article: 1, section: 3, clause: 3,
    title: 'Article I, Section 3, Clause 3',
    shortNames: ['Senate Qualifications Clause'],
    text: 'No Person shall be a Senator who shall not have attained to the Age of thirty Years, and been nine Years a Citizen of the United States, and who shall not, when elected, be an Inhabitant of that State for which he shall be chosen.',
  }),
  bodyClause({
    locator: 'art1.sec3.cl4',
    article: 1, section: 3, clause: 4,
    title: 'Article I, Section 3, Clause 4',
    text: 'The Vice President of the United States shall be President of the Senate, but shall have no Vote, unless they be equally divided.',
  }),
  bodyClause({
    locator: 'art1.sec3.cl5',
    article: 1, section: 3, clause: 5,
    title: 'Article I, Section 3, Clause 5',
    text: 'The Senate shall chuse their other Officers, and also a President pro tempore, in the Absence of the Vice President, or when he shall exercise the Office of President of the United States.',
  }),
  bodyClause({
    locator: 'art1.sec3.cl6',
    article: 1, section: 3, clause: 6,
    title: 'Article I, Section 3, Clause 6',
    shortNames: ['Impeachment Trial Clause'],
    text: 'The Senate shall have the sole Power to try all Impeachments. When sitting for that Purpose, they shall be on Oath or Affirmation. When the President of the United States is tried, the Chief Justice shall preside: And no Person shall be convicted without the Concurrence of two thirds of the Members present.',
  }),
  bodyClause({
    locator: 'art1.sec3.cl7',
    article: 1, section: 3, clause: 7,
    title: 'Article I, Section 3, Clause 7',
    text: 'Judgment in Cases of Impeachment shall not extend further than to removal from Office, and disqualification to hold and enjoy any Office of honor, Trust or Profit under the United States: but the Party convicted shall nevertheless be liable and subject to Indictment, Trial, Judgment and Punishment, according to Law.',
  }),
  bodyClause({
    locator: 'art1.sec4.cl1',
    article: 1, section: 4, clause: 1,
    title: 'Article I, Section 4, Clause 1',
    shortNames: ['Elections Clause'],
    text: 'The Times, Places and Manner of holding Elections for Senators and Representatives, shall be prescribed in each State by the Legislature thereof; but the Congress may at any time by Law make or alter such Regulations, except as to the Places of chusing Senators.',
  }),
  bodyClause({
    locator: 'art1.sec4.cl2',
    article: 1, section: 4, clause: 2,
    title: 'Article I, Section 4, Clause 2',
    text: 'The Congress shall assemble at least once in every Year, and such Meeting shall be on the first Monday in December, unless they shall by Law appoint a different Day.',
    supersededBy: ['constitution:amdt20.sec2'],
  }),
  bodyClause({
    locator: 'art1.sec5.cl1',
    article: 1, section: 5, clause: 1,
    title: 'Article I, Section 5, Clause 1',
    shortNames: ['Quorum Clause'],
    text: 'Each House shall be the Judge of the Elections, Returns and Qualifications of its own Members, and a Majority of each shall constitute a Quorum to do Business; but a smaller Number may adjourn from day to day, and may be authorized to compel the Attendance of absent Members, in such Manner, and under such Penalties as each House may provide.',
  }),
  bodyClause({
    locator: 'art1.sec5.cl2',
    article: 1, section: 5, clause: 2,
    title: 'Article I, Section 5, Clause 2',
    shortNames: ['Rules of Proceedings Clause', 'Expulsion Clause'],
    text: 'Each House may determine the Rules of its Proceedings, punish its Members for disorderly Behaviour, and, with the Concurrence of two thirds, expel a Member.',
  }),
  bodyClause({
    locator: 'art1.sec5.cl3',
    article: 1, section: 5, clause: 3,
    title: 'Article I, Section 5, Clause 3',
    shortNames: ['Journal Clause'],
    text: 'Each House shall keep a Journal of its Proceedings, and from time to time publish the same, excepting such Parts as may in their Judgment require Secrecy; and the Yeas and Nays of the Members of either House on any question shall, at the Desire of one fifth of those Present, be entered on the Journal.',
  }),
  bodyClause({
    locator: 'art1.sec5.cl4',
    article: 1, section: 5, clause: 4,
    title: 'Article I, Section 5, Clause 4',
    shortNames: ['Adjournments Clause'],
    text: 'Neither House, during the Session of Congress, shall, without the Consent of the other, adjourn for more than three days, nor to any other Place than that in which the two Houses shall be sitting.',
  }),
  bodyClause({
    locator: 'art1.sec6.cl1',
    article: 1, section: 6, clause: 1,
    title: 'Article I, Section 6, Clause 1',
    shortNames: ['Compensation Clause', 'Privilege from Arrest Clause', 'Speech and Debate Clause'],
    text: 'The Senators and Representatives shall receive a Compensation for their Services, to be ascertained by Law, and paid out of the Treasury of the United States. They shall in all Cases, except Treason, Felony and Breach of the Peace, be privileged from Arrest during their Attendance at the Session of their respective Houses, and in going to and returning from the same; and for any Speech or Debate in either House, they shall not be questioned in any other Place.',
    supersededBy: ['constitution:amdt27'],
  }),
  bodyClause({
    locator: 'art1.sec6.cl2',
    article: 1, section: 6, clause: 2,
    title: 'Article I, Section 6, Clause 2',
    shortNames: ['Incompatibility Clause', 'Ineligibility Clause', 'Emoluments Clause'],
    text: 'No Senator or Representative shall, during the Time for which he was elected, be appointed to any civil Office under the Authority of the United States, which shall have been created, or the Emoluments whereof shall have been encreased during such time; and no Person holding any Office under the United States, shall be a Member of either House during his Continuance in Office.',
  }),
  bodyClause({
    locator: 'art1.sec7.cl1',
    article: 1, section: 7, clause: 1,
    title: 'Article I, Section 7, Clause 1',
    shortNames: ['Origination Clause'],
    text: 'All Bills for raising Revenue shall originate in the House of Representatives; but the Senate may propose or concur with Amendments as on other Bills.',
  }),
  bodyClause({
    locator: 'art1.sec7.cl2',
    article: 1, section: 7, clause: 2,
    title: 'Article I, Section 7, Clause 2',
    shortNames: ['Presentment Clause'],
    text: 'Every Bill which shall have passed the House of Representatives and the Senate, shall, before it become a Law, be presented to the President of the United States; If he approve he shall sign it, but if not he shall return it, with his Objections to that House in which it shall have originated, who shall enter the Objections at large on their Journal, and proceed to reconsider it. If after such Reconsideration two thirds of that House shall agree to pass the Bill, it shall be sent, together with the Objections, to the other House, by which it shall likewise be reconsidered, and if approved by two thirds of that House, it shall become a Law. But in all such Cases the Votes of both Houses shall be determined by yeas and Nays, and the Names of the Persons voting for and against the Bill shall be entered on the Journal of each House respectively. If any Bill shall not be returned by the President within ten Days (Sundays excepted) after it shall have been presented to him, the Same shall be a Law, in like Manner as if he had signed it, unless the Congress by their Adjournment prevent its Return, in which Case it shall not be a Law.',
  }),
  bodyClause({
    locator: 'art1.sec7.cl3',
    article: 1, section: 7, clause: 3,
    title: 'Article I, Section 7, Clause 3',
    shortNames: ['Orders, Resolutions, and Votes Clause'],
    text: 'Every Order, Resolution, or Vote to which the Concurrence of the Senate and House of Representatives may be necessary (except on a question of Adjournment) shall be presented to the President of the United States; and before the Same shall take Effect, shall be approved by him, or being disapproved by him, shall be repassed by two thirds of the Senate and House of Representatives, according to the Rules and Limitations prescribed in the Case of a Bill.',
  }),
  bodyClause({
    locator: 'art1.sec8.cl1',
    article: 1, section: 8, clause: 1,
    title: 'Article I, Section 8, Clause 1',
    shortNames: ['Taxing and Spending Clause', 'General Welfare Clause', 'Uniformity Clause'],
    text: 'The Congress shall have Power To lay and collect Taxes, Duties, Imposts and Excises, to pay the Debts and provide for the common Defence and general Welfare of the United States; but all Duties, Imposts and Excises shall be uniform throughout the United States;',
  }),
  bodyClause({
    locator: 'art1.sec8.cl2',
    article: 1, section: 8, clause: 2,
    title: 'Article I, Section 8, Clause 2',
    shortNames: ['Borrowing Clause'],
    text: ELIDE + 'To borrow Money on the credit of the United States;',
  }),
  bodyClause({
    locator: 'art1.sec8.cl3',
    article: 1, section: 8, clause: 3,
    title: 'Article I, Section 8, Clause 3',
    shortNames: ['Commerce Clause'],
    text: ELIDE + 'To regulate Commerce with foreign Nations, and among the several States, and with the Indian Tribes;',
  }),
  bodyClause({
    locator: 'art1.sec8.cl4',
    article: 1, section: 8, clause: 4,
    title: 'Article I, Section 8, Clause 4',
    shortNames: ['Naturalization Clause', 'Bankruptcy Clause'],
    text: ELIDE + 'To establish an uniform Rule of Naturalization, and uniform Laws on the subject of Bankruptcies throughout the United States;',
  }),
  bodyClause({
    locator: 'art1.sec8.cl5',
    article: 1, section: 8, clause: 5,
    title: 'Article I, Section 8, Clause 5',
    shortNames: ['Coinage Clause', 'Weights and Measures Clause'],
    text: ELIDE + 'To coin Money, regulate the Value thereof, and of foreign Coin, and fix the Standard of Weights and Measures;',
  }),
  bodyClause({
    locator: 'art1.sec8.cl6',
    article: 1, section: 8, clause: 6,
    title: 'Article I, Section 8, Clause 6',
    shortNames: ['Counterfeiting Clause'],
    text: ELIDE + 'To provide for the Punishment of counterfeiting the Securities and current Coin of the United States;',
  }),
  bodyClause({
    locator: 'art1.sec8.cl7',
    article: 1, section: 8, clause: 7,
    title: 'Article I, Section 8, Clause 7',
    shortNames: ['Postal Clause'],
    text: ELIDE + 'To establish Post Offices and post Roads;',
  }),
  bodyClause({
    locator: 'art1.sec8.cl8',
    article: 1, section: 8, clause: 8,
    title: 'Article I, Section 8, Clause 8',
    shortNames: ['Copyright Clause', 'Patent Clause', 'Intellectual Property Clause'],
    text: ELIDE + 'To promote the Progress of Science and useful Arts, by securing for limited Times to Authors and Inventors the exclusive Right to their respective Writings and Discoveries;',
  }),
  bodyClause({
    locator: 'art1.sec8.cl9',
    article: 1, section: 8, clause: 9,
    title: 'Article I, Section 8, Clause 9',
    shortNames: ['Inferior Tribunals Clause'],
    text: ELIDE + 'To constitute Tribunals inferior to the supreme Court;',
  }),
  bodyClause({
    locator: 'art1.sec8.cl10',
    article: 1, section: 8, clause: 10,
    title: 'Article I, Section 8, Clause 10',
    shortNames: ['Piracy Clause', 'Offences Against the Law of Nations Clause', 'Define and Punish Clause'],
    text: ELIDE + 'To define and punish Piracies and Felonies committed on the high Seas, and Offences against the Law of Nations;',
  }),
  bodyClause({
    locator: 'art1.sec8.cl11',
    article: 1, section: 8, clause: 11,
    title: 'Article I, Section 8, Clause 11',
    shortNames: ['Declare War Clause', 'Marque and Reprisal Clause', 'Captures Clause'],
    text: ELIDE + 'To declare War, grant Letters of Marque and Reprisal, and make Rules concerning Captures on Land and Water;',
  }),
  bodyClause({
    locator: 'art1.sec8.cl12',
    article: 1, section: 8, clause: 12,
    title: 'Article I, Section 8, Clause 12',
    shortNames: ['Army Clause'],
    text: ELIDE + 'To raise and support Armies, but no Appropriation of Money to that Use shall be for a longer Term than two Years;',
  }),
  bodyClause({
    locator: 'art1.sec8.cl13',
    article: 1, section: 8, clause: 13,
    title: 'Article I, Section 8, Clause 13',
    shortNames: ['Navy Clause'],
    text: ELIDE + 'To provide and maintain a Navy;',
  }),
  bodyClause({
    locator: 'art1.sec8.cl14',
    article: 1, section: 8, clause: 14,
    title: 'Article I, Section 8, Clause 14',
    shortNames: ['Government and Regulation Clause', 'Military Regulations Clause'],
    text: ELIDE + 'To make Rules for the Government and Regulation of the land and naval Forces;',
  }),
  bodyClause({
    locator: 'art1.sec8.cl15',
    article: 1, section: 8, clause: 15,
    title: 'Article I, Section 8, Clause 15',
    shortNames: ['Calling Forth Clause', 'Militia Calling Forth Clause'],
    text: ELIDE + 'To provide for calling forth the Militia to execute the Laws of the Union, suppress Insurrections and repel Invasions;',
  }),
  bodyClause({
    locator: 'art1.sec8.cl16',
    article: 1, section: 8, clause: 16,
    title: 'Article I, Section 8, Clause 16',
    shortNames: ['Militia Organizing Clause'],
    text: ELIDE + 'To provide for organizing, arming, and disciplining, the Militia, and for governing such Part of them as may be employed in the Service of the United States, reserving to the States respectively, the Appointment of the Officers, and the Authority of training the Militia according to the discipline prescribed by Congress;',
  }),
  bodyClause({
    locator: 'art1.sec8.cl17',
    article: 1, section: 8, clause: 17,
    title: 'Article I, Section 8, Clause 17',
    shortNames: ['Enclave Clause', 'District Clause', 'Seat of Government Clause'],
    text: ELIDE + 'To exercise exclusive Legislation in all Cases whatsoever, over such District (not exceeding ten Miles square) as may, by Cession of particular States, and the Acceptance of Congress, become the Seat of the Government of the United States, and to exercise like Authority over all Places purchased by the Consent of the Legislature of the State in which the Same shall be, for the Erection of Forts, Magazines, Arsenals, dock-Yards, and other needful Buildings;—And',
  }),
  bodyClause({
    locator: 'art1.sec8.cl18',
    article: 1, section: 8, clause: 18,
    title: 'Article I, Section 8, Clause 18',
    shortNames: ['Necessary and Proper Clause', 'Elastic Clause', 'Sweeping Clause', 'Coefficient Clause'],
    text: ELIDE + 'To make all Laws which shall be necessary and proper for carrying into Execution the foregoing Powers, and all other Powers vested by this Constitution in the Government of the United States, or in any Department or Officer thereof.',
  }),
  bodyClause({
    locator: 'art1.sec9.cl1',
    article: 1, section: 9, clause: 1,
    title: 'Article I, Section 9, Clause 1',
    shortNames: ['Migration or Importation Clause', 'Slave Trade Clause'],
    text: 'The Migration or Importation of such Persons as any of the States now existing shall think proper to admit, shall not be prohibited by the Congress prior to the Year one thousand eight hundred and eight, but a Tax or duty may be imposed on such Importation, not exceeding ten dollars for each Person.',
  }),
  bodyClause({
    locator: 'art1.sec9.cl2',
    article: 1, section: 9, clause: 2,
    title: 'Article I, Section 9, Clause 2',
    shortNames: ['Habeas Corpus Suspension Clause', 'Suspension Clause'],
    text: 'The Privilege of the Writ of Habeas Corpus shall not be suspended, unless when in Cases of Rebellion or Invasion the public Safety may require it.',
  }),
  bodyClause({
    locator: 'art1.sec9.cl3',
    article: 1, section: 9, clause: 3,
    title: 'Article I, Section 9, Clause 3',
    shortNames: ['Bill of Attainder Clause', 'Ex Post Facto Clause'],
    text: 'No Bill of Attainder or ex post facto Law shall be passed.',
  }),
  bodyClause({
    locator: 'art1.sec9.cl4',
    article: 1, section: 9, clause: 4,
    title: 'Article I, Section 9, Clause 4',
    shortNames: ['Direct Tax Clause', 'Capitation Clause'],
    text: 'No Capitation, or other direct, Tax shall be laid, unless in Proportion to the Census or enumeration herein before directed to be taken.',
    supersededBy: ['constitution:amdt16'],
  }),
  bodyClause({
    locator: 'art1.sec9.cl5',
    article: 1, section: 9, clause: 5,
    title: 'Article I, Section 9, Clause 5',
    shortNames: ['Export Clause'],
    text: 'No Tax or Duty shall be laid on Articles exported from any State.',
  }),
  bodyClause({
    locator: 'art1.sec9.cl6',
    article: 1, section: 9, clause: 6,
    title: 'Article I, Section 9, Clause 6',
    shortNames: ['Port Preference Clause'],
    text: 'No Preference shall be given by any Regulation of Commerce or Revenue to the Ports of one State over those of another: nor shall Vessels bound to, or from, one State, be obliged to enter, clear, or pay Duties in another.',
  }),
  bodyClause({
    locator: 'art1.sec9.cl7',
    article: 1, section: 9, clause: 7,
    title: 'Article I, Section 9, Clause 7',
    shortNames: ['Appropriations Clause', 'Statement and Account Clause'],
    text: 'No Money shall be drawn from the Treasury, but in Consequence of Appropriations made by Law; and a regular Statement and Account of the Receipts and Expenditures of all public Money shall be published from time to time.',
  }),
  bodyClause({
    locator: 'art1.sec9.cl8',
    article: 1, section: 9, clause: 8,
    title: 'Article I, Section 9, Clause 8',
    shortNames: ['Title of Nobility Clause', 'Foreign Emoluments Clause'],
    text: 'No Title of Nobility shall be granted by the United States: And no Person holding any Office of Profit or Trust under them, shall, without the Consent of the Congress, accept of any present, Emolument, Office, or Title, of any kind whatever, from any King, Prince, or foreign State.',
  }),
  bodyClause({
    locator: 'art1.sec10.cl1',
    article: 1, section: 10, clause: 1,
    title: 'Article I, Section 10, Clause 1',
    shortNames: ['Contracts Clause', 'Contract Clause', 'State Bills of Credit Clause'],
    text: 'No State shall enter into any Treaty, Alliance, or Confederation; grant Letters of Marque and Reprisal; coin Money; emit Bills of Credit; make any Thing but gold and silver Coin a Tender in Payment of Debts; pass any Bill of Attainder, ex post facto Law, or Law impairing the Obligation of Contracts, or grant any Title of Nobility.',
  }),
  bodyClause({
    locator: 'art1.sec10.cl2',
    article: 1, section: 10, clause: 2,
    title: 'Article I, Section 10, Clause 2',
    shortNames: ['Import-Export Clause'],
    text: "No State shall, without the Consent of the Congress, lay any Imposts or Duties on Imports or Exports, except what may be absolutely necessary for executing it's inspection Laws: and the net Produce of all Duties and Imposts, laid by any State on Imports or Exports, shall be for the Use of the Treasury of the United States; and all such Laws shall be subject to the Revision and Controul of the Congress.",
  }),
  bodyClause({
    locator: 'art1.sec10.cl3',
    article: 1, section: 10, clause: 3,
    title: 'Article I, Section 10, Clause 3',
    shortNames: ['Compact Clause', 'Tonnage Clause'],
    text: 'No State shall, without the Consent of Congress, lay any Duty of Tonnage, keep Troops, or Ships of War in time of Peace, enter into any Agreement or Compact with another State, or with a foreign Power, or engage in War, unless actually invaded, or in such imminent Danger as will not admit of delay.',
  }),
];

// --- Article II -------------------------------------------------------------

const articleII: Item[] = [
  bodyClause({
    locator: 'art2.sec1.cl1',
    article: 2, section: 1, clause: 1,
    title: 'Article II, Section 1, Clause 1',
    shortNames: ['Executive Vesting Clause'],
    text: 'The executive Power shall be vested in a President of the United States of America. He shall hold his Office during the Term of four Years, and, together with the Vice President, chosen for the same Term, be elected, as follows',
  }),
  bodyClause({
    locator: 'art2.sec1.cl2',
    article: 2, section: 1, clause: 2,
    title: 'Article II, Section 1, Clause 2',
    shortNames: ['Electors Clause', 'Presidential Electors Clause'],
    text: 'Each State shall appoint, in such Manner as the Legislature thereof may direct, a Number of Electors, equal to the whole Number of Senators and Representatives to which the State may be entitled in the Congress: but no Senator or Representative, or Person holding an Office of Trust or Profit under the United States, shall be appointed an Elector.',
  }),
  bodyClause({
    locator: 'art2.sec1.cl3',
    article: 2, section: 1, clause: 3,
    title: 'Article II, Section 1, Clause 3',
    text: 'The Electors shall meet in their respective States, and vote by Ballot for two Persons, of whom one at least shall not be an Inhabitant of the same State with themselves. And they shall make a List of all the Persons voted for, and of the Number of Votes for each; which List they shall sign and certify, and transmit sealed to the Seat of the Government of the United States, directed to the President of the Senate. The President of the Senate shall, in the Presence of the Senate and House of Representatives, open all the Certificates, and the Votes shall then be counted. The Person having the greatest Number of Votes shall be the President, if such Number be a Majority of the whole Number of Electors appointed; and if there be more than one who have such Majority, and have an equal Number of Votes, then the House of Representatives shall immediately chuse by Ballot one of them for President; and if no Person have a Majority, then from the five highest on the List the said House shall in like Manner chuse the President. But in chusing the President, the Votes shall be taken by States, the Representation from each State having one Vote; A quorum for this Purpose shall consist of a Member or Members from two thirds of the States, and a Majority of all the States shall be necessary to a Choice. In every Case, after the Choice of the President, the Person having the greatest Number of Votes of the Electors shall be the Vice President. But if there should remain two or more who have equal Votes, the Senate shall chuse from them by Ballot the Vice President.',
    supersededBy: ['constitution:amdt12'],
  }),
  bodyClause({
    locator: 'art2.sec1.cl4',
    article: 2, section: 1, clause: 4,
    title: 'Article II, Section 1, Clause 4',
    text: 'The Congress may determine the Time of chusing the Electors, and the Day on which they shall give their Votes; which Day shall be the same throughout the United States.',
  }),
  bodyClause({
    locator: 'art2.sec1.cl5',
    article: 2, section: 1, clause: 5,
    title: 'Article II, Section 1, Clause 5',
    shortNames: ['Natural Born Citizen Clause', 'Presidential Eligibility Clause'],
    text: 'No Person except a natural born Citizen, or a Citizen of the United States, at the time of the Adoption of this Constitution, shall be eligible to the Office of President; neither shall any Person be eligible to that Office who shall not have attained to the Age of thirty five Years, and been fourteen Years a Resident within the United States.',
  }),
  bodyClause({
    locator: 'art2.sec1.cl6',
    article: 2, section: 1, clause: 6,
    title: 'Article II, Section 1, Clause 6',
    shortNames: ['Presidential Succession Clause'],
    text: 'In Case of the Removal of the President from Office, or of his Death, Resignation, or Inability to discharge the Powers and Duties of the said Office, the Same shall devolve on the Vice President, and the Congress may by Law provide for the Case of Removal, Death, Resignation or Inability, both of the President and Vice President, declaring what Officer shall then act as President, and such Officer shall act accordingly, until the Disability be removed, or a President shall be elected.',
    supersededBy: ['constitution:amdt25.sec1'],
  }),
  bodyClause({
    locator: 'art2.sec1.cl7',
    article: 2, section: 1, clause: 7,
    title: 'Article II, Section 1, Clause 7',
    shortNames: ['Presidential Compensation Clause', 'Domestic Emoluments Clause'],
    text: 'The President shall, at stated Times, receive for his Services, a Compensation, which shall neither be encreased nor diminished during the Period for which he shall have been elected, and he shall not receive within that Period any other Emolument from the United States, or any of them.',
  }),
  bodyClause({
    locator: 'art2.sec1.cl8',
    article: 2, section: 1, clause: 8,
    title: 'Article II, Section 1, Clause 8',
    shortNames: ['Presidential Oath Clause', 'Oath of Office Clause'],
    text: 'Before he enter on the Execution of his Office, he shall take the following Oath or Affirmation:—"I do solemnly swear (or affirm) that I will faithfully execute the Office of President of the United States, and will to the best of my Ability, preserve, protect and defend the Constitution of the United States."',
  }),
  bodyClause({
    locator: 'art2.sec2.cl1',
    article: 2, section: 2, clause: 1,
    title: 'Article II, Section 2, Clause 1',
    shortNames: ['Commander in Chief Clause', 'Opinion Clause', 'Pardon Clause'],
    text: 'The President shall be Commander in Chief of the Army and Navy of the United States, and of the Militia of the several States, when called into the actual Service of the United States; he may require the Opinion, in writing, of the principal Officer in each of the executive Departments, upon any Subject relating to the Duties of their respective Offices, and he shall have Power to grant Reprieves and Pardons for Offences against the United States, except in Cases of Impeachment.',
  }),
  bodyClause({
    locator: 'art2.sec2.cl2',
    article: 2, section: 2, clause: 2,
    title: 'Article II, Section 2, Clause 2',
    shortNames: ['Treaty Clause', 'Appointments Clause'],
    text: 'He shall have Power, by and with the Advice and Consent of the Senate, to make Treaties, provided two thirds of the Senators present concur; and he shall nominate, and by and with the Advice and Consent of the Senate, shall appoint Ambassadors, other public Ministers and Consuls, Judges of the supreme Court, and all other Officers of the United States, whose Appointments are not herein otherwise provided for, and which shall be established by Law: but the Congress may by Law vest the Appointment of such inferior Officers, as they think proper, in the President alone, in the Courts of Law, or in the Heads of Departments.',
  }),
  bodyClause({
    locator: 'art2.sec2.cl3',
    article: 2, section: 2, clause: 3,
    title: 'Article II, Section 2, Clause 3',
    shortNames: ['Recess Appointments Clause'],
    text: 'The President shall have Power to fill up all Vacancies that may happen during the Recess of the Senate, by granting Commissions which shall expire at the End of their next Session.',
  }),
  bodyClause({
    locator: 'art2.sec3',
    article: 2, section: 3, clause: null,
    title: 'Article II, Section 3',
    shortNames: ['State of the Union Clause', 'Reception Clause', 'Take Care Clause'],
    text: 'He shall from time to time give to the Congress Information of the State of the Union, and recommend to their Consideration such Measures as he shall judge necessary and expedient; he may, on extraordinary Occasions, convene both Houses, or either of them, and in Case of Disagreement between them, with Respect to the Time of Adjournment, he may adjourn them to such Time as he shall think proper; he shall receive Ambassadors and other public Ministers; he shall take Care that the Laws be faithfully executed, and shall Commission all the Officers of the United States.',
  }),
  bodyClause({
    locator: 'art2.sec4',
    article: 2, section: 4, clause: null,
    title: 'Article II, Section 4',
    shortNames: ['Impeachment Clause'],
    text: 'The President, Vice President and all civil Officers of the United States, shall be removed from Office on Impeachment for, and Conviction of, Treason, Bribery, or other high Crimes and Misdemeanors.',
  }),
];

// --- Article III -----------------------------------------------------------

const articleIII: Item[] = [
  bodyClause({
    locator: 'art3.sec1',
    article: 3, section: 1, clause: null,
    title: 'Article III, Section 1',
    shortNames: ['Judicial Vesting Clause', 'Good Behaviour Clause', 'Judicial Compensation Clause'],
    text: 'The judicial Power of the United States, shall be vested in one supreme Court, and in such inferior Courts as the Congress may from time to time ordain and establish. The Judges, both of the supreme and inferior Courts, shall hold their Offices during good Behaviour, and shall, at stated Times, receive for their Services, a Compensation, which shall not be diminished during their Continuance in Office.',
  }),
  bodyClause({
    locator: 'art3.sec2.cl1',
    article: 3, section: 2, clause: 1,
    title: 'Article III, Section 2, Clause 1',
    shortNames: ['Cases or Controversies Clause', 'Judicial Power Clause', 'Diversity Clause'],
    text: 'The judicial Power shall extend to all Cases, in Law and Equity, arising under this Constitution, the Laws of the United States, and Treaties made, or which shall be made, under their Authority;—to all Cases affecting Ambassadors, other public Ministers and Consuls;—to all Cases of admiralty and maritime Jurisdiction;—to Controversies to which the United States shall be a Party;—to Controversies between two or more States;— between a State and Citizens of another State,—between Citizens of different States,—between Citizens of the same State claiming Lands under Grants of different States, and between a State, or the Citizens thereof, and foreign States, Citizens or Subjects.',
    supersededBy: ['constitution:amdt11'],
  }),
  bodyClause({
    locator: 'art3.sec2.cl2',
    article: 3, section: 2, clause: 2,
    title: 'Article III, Section 2, Clause 2',
    shortNames: ['Original Jurisdiction Clause', 'Appellate Jurisdiction Clause', 'Exceptions Clause'],
    text: 'In all Cases affecting Ambassadors, other public Ministers and Consuls, and those in which a State shall be Party, the supreme Court shall have original Jurisdiction. In all the other Cases before mentioned, the supreme Court shall have appellate Jurisdiction, both as to Law and Fact, with such Exceptions, and under such Regulations as the Congress shall make.',
  }),
  bodyClause({
    locator: 'art3.sec2.cl3',
    article: 3, section: 2, clause: 3,
    title: 'Article III, Section 2, Clause 3',
    shortNames: ['Criminal Jury Trial Clause', 'Trial by Jury Clause'],
    text: 'The Trial of all Crimes, except in Cases of Impeachment, shall be by Jury; and such Trial shall be held in the State where the said Crimes shall have been committed; but when not committed within any State, the Trial shall be at such Place or Places as the Congress may by Law have directed.',
  }),
  bodyClause({
    locator: 'art3.sec3.cl1',
    article: 3, section: 3, clause: 1,
    title: 'Article III, Section 3, Clause 1',
    shortNames: ['Treason Clause'],
    text: 'Treason against the United States, shall consist only in levying War against them, or in adhering to their Enemies, giving them Aid and Comfort. No Person shall be convicted of Treason unless on the Testimony of two Witnesses to the same overt Act, or on Confession in open Court.',
  }),
  bodyClause({
    locator: 'art3.sec3.cl2',
    article: 3, section: 3, clause: 2,
    title: 'Article III, Section 3, Clause 2',
    shortNames: ['Punishment of Treason Clause', 'Corruption of Blood Clause'],
    text: 'The Congress shall have Power to declare the Punishment of Treason, but no Attainder of Treason shall work Corruption of Blood, or Forfeiture except during the Life of the Person attainted.',
  }),
];

// --- Article IV ------------------------------------------------------------

const articleIV: Item[] = [
  bodyClause({
    locator: 'art4.sec1',
    article: 4, section: 1, clause: null,
    title: 'Article IV, Section 1',
    shortNames: ['Full Faith and Credit Clause'],
    text: 'Full Faith and Credit shall be given in each State to the public Acts, Records, and judicial Proceedings of every other State. And the Congress may by general Laws prescribe the Manner in which such Acts, Records and Proceedings shall be proved, and the Effect thereof.',
  }),
  bodyClause({
    locator: 'art4.sec2.cl1',
    article: 4, section: 2, clause: 1,
    title: 'Article IV, Section 2, Clause 1',
    shortNames: ['Privileges and Immunities Clause', 'Comity Clause'],
    text: 'The Citizens of each State shall be entitled to all Privileges and Immunities of Citizens in the several States.',
  }),
  bodyClause({
    locator: 'art4.sec2.cl2',
    article: 4, section: 2, clause: 2,
    title: 'Article IV, Section 2, Clause 2',
    shortNames: ['Extradition Clause', 'Fugitives from Justice Clause'],
    text: 'A Person charged in any State with Treason, Felony, or other Crime, who shall flee from Justice, and be found in another State, shall on Demand of the executive Authority of the State from which he fled, be delivered up, to be removed to the State having Jurisdiction of the Crime.',
  }),
  bodyClause({
    locator: 'art4.sec2.cl3',
    article: 4, section: 2, clause: 3,
    title: 'Article IV, Section 2, Clause 3',
    shortNames: ['Fugitive Slave Clause'],
    text: 'No Person held to Service or Labour in one State, under the Laws thereof, escaping into another, shall, in Consequence of any Law or Regulation therein, be discharged from such Service or Labour, but shall be delivered up on Claim of the Party to whom such Service or Labour may be due.',
    supersededBy: ['constitution:amdt13.sec1'],
  }),
  bodyClause({
    locator: 'art4.sec3.cl1',
    article: 4, section: 3, clause: 1,
    title: 'Article IV, Section 3, Clause 1',
    shortNames: ['Admissions Clause', 'New States Clause'],
    text: 'New States may be admitted by the Congress into this Union; but no new State shall be formed or erected within the Jurisdiction of any other State; nor any State be formed by the Junction of two or more States, or Parts of States, without the Consent of the Legislatures of the States concerned as well as of the Congress.',
  }),
  bodyClause({
    locator: 'art4.sec3.cl2',
    article: 4, section: 3, clause: 2,
    title: 'Article IV, Section 3, Clause 2',
    shortNames: ['Property Clause', 'Territory Clause'],
    text: 'The Congress shall have Power to dispose of and make all needful Rules and Regulations respecting the Territory or other Property belonging to the United States; and nothing in this Constitution shall be so construed as to Prejudice any Claims of the United States, or of any particular State.',
  }),
  bodyClause({
    locator: 'art4.sec4',
    article: 4, section: 4, clause: null,
    title: 'Article IV, Section 4',
    shortNames: ['Guarantee Clause', 'Republican Form of Government Clause'],
    text: 'The United States shall guarantee to every State in this Union a Republican Form of Government, and shall protect each of them against Invasion; and on Application of the Legislature, or of the Executive (when the Legislature cannot be convened) against domestic Violence.',
  }),
];

// --- Article V -------------------------------------------------------------

const articleV: Item[] = [
  bodyClause({
    locator: 'art5',
    article: 5, section: null, clause: null,
    title: 'Article V',
    shortNames: ['Amendment Process Clause'],
    text: 'The Congress, whenever two thirds of both Houses shall deem it necessary, shall propose Amendments to this Constitution, or, on the Application of the Legislatures of two thirds of the several States, shall call a Convention for proposing Amendments, which, in either Case, shall be valid to all Intents and Purposes, as Part of this Constitution, when ratified by the Legislatures of three fourths of the several States, or by Conventions in three fourths thereof, as the one or the other Mode of Ratification may be proposed by the Congress; Provided that no Amendment which may be made prior to the Year One thousand eight hundred and eight shall in any Manner affect the first and fourth Clauses in the Ninth Section of the first Article; and that no State, without its Consent, shall be deprived of its equal Suffrage in the Senate.',
  }),
];

// --- Article VI ------------------------------------------------------------

const articleVI: Item[] = [
  bodyClause({
    locator: 'art6.cl1',
    article: 6, section: null, clause: 1,
    title: 'Article VI, Clause 1',
    shortNames: ['Debts Clause', 'Engagements Clause'],
    text: 'All Debts contracted and Engagements entered into, before the Adoption of this Constitution, shall be as valid against the United States under this Constitution, as under the Confederation.',
  }),
  bodyClause({
    locator: 'art6.cl2',
    article: 6, section: null, clause: 2,
    title: 'Article VI, Clause 2',
    shortNames: ['Supremacy Clause'],
    text: 'This Constitution, and the Laws of the United States which shall be made in Pursuance thereof; and all Treaties made, or which shall be made, under the Authority of the United States, shall be the supreme Law of the Land; and the Judges in every State shall be bound thereby, any Thing in the Constitution or Laws of any State to the Contrary notwithstanding.',
  }),
  bodyClause({
    locator: 'art6.cl3',
    article: 6, section: null, clause: 3,
    title: 'Article VI, Clause 3',
    shortNames: ['Oath Clause', 'No Religious Test Clause'],
    text: 'The Senators and Representatives before mentioned, and the Members of the several State Legislatures, and all executive and judicial Officers, both of the United States and of the several States, shall be bound by Oath or Affirmation, to support this Constitution; but no religious Test shall ever be required as a Qualification to any Office or public Trust under the United States.',
  }),
];

// --- Article VII -----------------------------------------------------------

const articleVII: Item[] = [
  bodyClause({
    locator: 'art7',
    article: 7, section: null, clause: null,
    title: 'Article VII',
    shortNames: ['Ratification Clause'],
    text: 'The Ratification of the Conventions of nine States, shall be sufficient for the Establishment of this Constitution between the States so ratifying the Same.',
  }),
];

// --- Bill of Rights (Amendments I–X) ---------------------------------------

const billOfRights: Item[] = [
  amendmentClause({
    locator: 'amdt1.cl1', amendment: 1, section: null, clause: 1,
    title: 'First Amendment, Clause 1',
    authors: BOR_AUTHORS, date: RATIFICATION_BOR,
    shortNames: ['Establishment Clause'],
    text: 'Congress shall make no law respecting an establishment of religion,',
  }),
  amendmentClause({
    locator: 'amdt1.cl2', amendment: 1, section: null, clause: 2,
    title: 'First Amendment, Clause 2',
    authors: BOR_AUTHORS, date: RATIFICATION_BOR,
    shortNames: ['Free Exercise Clause'],
    text: 'or prohibiting the free exercise thereof;',
  }),
  amendmentClause({
    locator: 'amdt1.cl3', amendment: 1, section: null, clause: 3,
    title: 'First Amendment, Clause 3',
    authors: BOR_AUTHORS, date: RATIFICATION_BOR,
    shortNames: ['Free Speech Clause'],
    text: 'or abridging the freedom of speech,',
  }),
  amendmentClause({
    locator: 'amdt1.cl4', amendment: 1, section: null, clause: 4,
    title: 'First Amendment, Clause 4',
    authors: BOR_AUTHORS, date: RATIFICATION_BOR,
    shortNames: ['Free Press Clause'],
    text: 'or of the press;',
  }),
  amendmentClause({
    locator: 'amdt1.cl5', amendment: 1, section: null, clause: 5,
    title: 'First Amendment, Clause 5',
    authors: BOR_AUTHORS, date: RATIFICATION_BOR,
    shortNames: ['Assembly Clause', 'Right of Assembly Clause'],
    text: 'or the right of the people peaceably to assemble,',
  }),
  amendmentClause({
    locator: 'amdt1.cl6', amendment: 1, section: null, clause: 6,
    title: 'First Amendment, Clause 6',
    authors: BOR_AUTHORS, date: RATIFICATION_BOR,
    shortNames: ['Petition Clause', 'Right to Petition Clause'],
    text: 'and to petition the Government for a redress of grievances.',
  }),
  amendmentClause({
    locator: 'amdt2', amendment: 2, section: null, clause: null,
    title: 'Second Amendment',
    authors: BOR_AUTHORS, date: RATIFICATION_BOR,
    shortNames: ['Right to Keep and Bear Arms Clause'],
    text: 'A well regulated Militia, being necessary to the security of a free State, the right of the people to keep and bear Arms, shall not be infringed.',
  }),
  amendmentClause({
    locator: 'amdt3', amendment: 3, section: null, clause: null,
    title: 'Third Amendment',
    authors: BOR_AUTHORS, date: RATIFICATION_BOR,
    shortNames: ['Quartering Clause'],
    text: 'No Soldier shall, in time of peace be quartered in any house, without the consent of the Owner, nor in time of war, but in a manner to be prescribed by law.',
  }),
  amendmentClause({
    locator: 'amdt4.cl1', amendment: 4, section: null, clause: 1,
    title: 'Fourth Amendment, Clause 1',
    authors: BOR_AUTHORS, date: RATIFICATION_BOR,
    shortNames: ['Unreasonable Search and Seizure Clause'],
    text: 'The right of the people to be secure in their persons, houses, papers, and effects, against unreasonable searches and seizures, shall not be violated,',
  }),
  amendmentClause({
    locator: 'amdt4.cl2', amendment: 4, section: null, clause: 2,
    title: 'Fourth Amendment, Clause 2',
    authors: BOR_AUTHORS, date: RATIFICATION_BOR,
    shortNames: ['Warrant Clause'],
    text: 'and no Warrants shall issue, but upon probable cause, supported by Oath or affirmation, and particularly describing the place to be searched, and the persons or things to be seized.',
  }),
  amendmentClause({
    locator: 'amdt5.cl1', amendment: 5, section: null, clause: 1,
    title: 'Fifth Amendment, Clause 1',
    authors: BOR_AUTHORS, date: RATIFICATION_BOR,
    shortNames: ['Grand Jury Clause'],
    text: 'No person shall be held to answer for a capital, or otherwise infamous crime, unless on a presentment or indictment of a Grand Jury, except in cases arising in the land or naval forces, or in the Militia, when in actual service in time of War or public danger;',
  }),
  amendmentClause({
    locator: 'amdt5.cl2', amendment: 5, section: null, clause: 2,
    title: 'Fifth Amendment, Clause 2',
    authors: BOR_AUTHORS, date: RATIFICATION_BOR,
    shortNames: ['Double Jeopardy Clause'],
    text: 'nor shall any person be subject for the same offence to be twice put in jeopardy of life or limb;',
  }),
  amendmentClause({
    locator: 'amdt5.cl3', amendment: 5, section: null, clause: 3,
    title: 'Fifth Amendment, Clause 3',
    authors: BOR_AUTHORS, date: RATIFICATION_BOR,
    shortNames: ['Self-Incrimination Clause'],
    text: 'nor shall be compelled in any criminal case to be a witness against himself,',
  }),
  amendmentClause({
    locator: 'amdt5.cl4', amendment: 5, section: null, clause: 4,
    title: 'Fifth Amendment, Clause 4',
    authors: BOR_AUTHORS, date: RATIFICATION_BOR,
    shortNames: ['Due Process Clause'],
    text: 'nor be deprived of life, liberty, or property, without due process of law;',
  }),
  amendmentClause({
    locator: 'amdt5.cl5', amendment: 5, section: null, clause: 5,
    title: 'Fifth Amendment, Clause 5',
    authors: BOR_AUTHORS, date: RATIFICATION_BOR,
    shortNames: ['Takings Clause', 'Just Compensation Clause'],
    text: 'nor shall private property be taken for public use, without just compensation.',
  }),
  amendmentClause({
    locator: 'amdt6', amendment: 6, section: null, clause: null,
    title: 'Sixth Amendment',
    authors: BOR_AUTHORS, date: RATIFICATION_BOR,
    shortNames: [
      'Speedy Trial Clause',
      'Public Trial Clause',
      'Impartial Jury Clause',
      'Vicinage Clause',
      'Notice Clause',
      'Confrontation Clause',
      'Compulsory Process Clause',
      'Assistance of Counsel Clause',
    ],
    text: 'In all criminal prosecutions, the accused shall enjoy the right to a speedy and public trial, by an impartial jury of the State and district wherein the crime shall have been committed, which district shall have been previously ascertained by law, and to be informed of the nature and cause of the accusation; to be confronted with the witnesses against him; to have compulsory process for obtaining witnesses in his favor, and to have the Assistance of Counsel for his defence.',
  }),
  amendmentClause({
    locator: 'amdt7.cl1', amendment: 7, section: null, clause: 1,
    title: 'Seventh Amendment, Clause 1',
    authors: BOR_AUTHORS, date: RATIFICATION_BOR,
    shortNames: ['Civil Jury Trial Clause'],
    text: 'In Suits at common law, where the value in controversy shall exceed twenty dollars, the right of trial by jury shall be preserved,',
  }),
  amendmentClause({
    locator: 'amdt7.cl2', amendment: 7, section: null, clause: 2,
    title: 'Seventh Amendment, Clause 2',
    authors: BOR_AUTHORS, date: RATIFICATION_BOR,
    shortNames: ['Re-examination Clause'],
    text: 'and no fact tried by a jury, shall be otherwise re-examined in any Court of the United States, than according to the rules of the common law.',
  }),
  amendmentClause({
    locator: 'amdt8.cl1', amendment: 8, section: null, clause: 1,
    title: 'Eighth Amendment, Clause 1',
    authors: BOR_AUTHORS, date: RATIFICATION_BOR,
    shortNames: ['Excessive Bail Clause'],
    text: 'Excessive bail shall not be required,',
  }),
  amendmentClause({
    locator: 'amdt8.cl2', amendment: 8, section: null, clause: 2,
    title: 'Eighth Amendment, Clause 2',
    authors: BOR_AUTHORS, date: RATIFICATION_BOR,
    shortNames: ['Excessive Fines Clause'],
    text: 'nor excessive fines imposed,',
  }),
  amendmentClause({
    locator: 'amdt8.cl3', amendment: 8, section: null, clause: 3,
    title: 'Eighth Amendment, Clause 3',
    authors: BOR_AUTHORS, date: RATIFICATION_BOR,
    shortNames: ['Cruel and Unusual Punishments Clause'],
    text: 'nor cruel and unusual punishments inflicted.',
  }),
  amendmentClause({
    locator: 'amdt9', amendment: 9, section: null, clause: null,
    title: 'Ninth Amendment',
    authors: BOR_AUTHORS, date: RATIFICATION_BOR,
    shortNames: ['Unenumerated Rights Clause'],
    text: 'The enumeration in the Constitution, of certain rights, shall not be construed to deny or disparage others retained by the people.',
  }),
  amendmentClause({
    locator: 'amdt10', amendment: 10, section: null, clause: null,
    title: 'Tenth Amendment',
    authors: BOR_AUTHORS, date: RATIFICATION_BOR,
    shortNames: ['Reserved Powers Clause'],
    text: 'The powers not delegated to the United States by the Constitution, nor prohibited by it to the States, are reserved to the States respectively, or to the people.',
  }),
];

// --- Amendments XI–XXVII ---------------------------------------------------

const laterAmendments: Item[] = [
  amendmentClause({
    locator: 'amdt11', amendment: 11, section: null, clause: null,
    title: 'Eleventh Amendment',
    authors: ['3rd Congress'], date: '1795-02-07',
    shortNames: ['State Sovereign Immunity Clause'],
    text: 'The Judicial power of the United States shall not be construed to extend to any suit in law or equity, commenced or prosecuted against one of the United States by Citizens of another State, or by Citizens or Subjects of any Foreign State.',
  }),
  amendmentClause({
    locator: 'amdt12', amendment: 12, section: null, clause: null,
    title: 'Twelfth Amendment',
    authors: ['8th Congress'], date: '1804-06-15',
    shortNames: ['Electoral College Clause'],
    text: 'The Electors shall meet in their respective states and vote by ballot for President and Vice-President, one of whom, at least, shall not be an inhabitant of the same state with themselves; they shall name in their ballots the person voted for as President, and in distinct ballots the person voted for as Vice-President, and they shall make distinct lists of all persons voted for as President, and of all persons voted for as Vice-President, and of the number of votes for each, which lists they shall sign and certify, and transmit sealed to the seat of the government of the United States, directed to the President of the Senate; -- the President of the Senate shall, in the presence of the Senate and House of Representatives, open all the certificates and the votes shall then be counted; -- The person having the greatest number of votes for President, shall be the President, if such number be a majority of the whole number of Electors appointed; and if no person have such majority, then from the persons having the highest numbers not exceeding three on the list of those voted for as President, the House of Representatives shall choose immediately, by ballot, the President. But in choosing the President, the votes shall be taken by states, the representation from each state having one vote; a quorum for this purpose shall consist of a member or members from two-thirds of the states, and a majority of all the states shall be necessary to a choice. [And if the House of Representatives shall not choose a President whenever the right of choice shall devolve upon them, before the fourth day of March next following, then the Vice-President shall act as President, as in the case of the death or other constitutional disability of the President. --]* The person having the greatest number of votes as Vice-President, shall be the Vice-President, if such number be a majority of the whole number of Electors appointed, and if no person have a majority, then from the two highest numbers on the list, the Senate shall choose the Vice-President; a quorum for the purpose shall consist of two-thirds of the whole number of Senators, and a majority of the whole number shall be necessary to a choice. But no person constitutionally ineligible to the office of President shall be eligible to that of Vice-President of the United States.',
    supersededBy: ['constitution:amdt20.sec3'],
  }),
  amendmentClause({
    locator: 'amdt13.sec1', amendment: 13, section: 1, clause: null,
    title: 'Thirteenth Amendment, Section 1',
    authors: ['38th Congress'], date: '1865-12-06',
    shortNames: ['Abolition of Slavery Clause'],
    text: 'Neither slavery nor involuntary servitude, except as a punishment for crime whereof the party shall have been duly convicted, shall exist within the United States, or any place subject to their jurisdiction.',
  }),
  amendmentClause({
    locator: 'amdt13.sec2', amendment: 13, section: 2, clause: null,
    title: 'Thirteenth Amendment, Section 2',
    authors: ['38th Congress'], date: '1865-12-06',
    shortNames: ['Thirteenth Amendment Enforcement Clause'],
    text: 'Congress shall have power to enforce this article by appropriate legislation.',
  }),
  amendmentClause({
    locator: 'amdt14.sec1.cl1', amendment: 14, section: 1, clause: 1,
    title: 'Fourteenth Amendment, Section 1, Clause 1',
    authors: ['39th Congress'], date: '1868-07-09',
    shortNames: ['Citizenship Clause'],
    text: 'All persons born or naturalized in the United States, and subject to the jurisdiction thereof, are citizens of the United States and of the State wherein they reside.',
  }),
  amendmentClause({
    locator: 'amdt14.sec1.cl2', amendment: 14, section: 1, clause: 2,
    title: 'Fourteenth Amendment, Section 1, Clause 2',
    authors: ['39th Congress'], date: '1868-07-09',
    shortNames: ['Privileges or Immunities Clause'],
    text: 'No State shall make or enforce any law which shall abridge the privileges or immunities of citizens of the United States;',
  }),
  amendmentClause({
    locator: 'amdt14.sec1.cl3', amendment: 14, section: 1, clause: 3,
    title: 'Fourteenth Amendment, Section 1, Clause 3',
    authors: ['39th Congress'], date: '1868-07-09',
    shortNames: ['Due Process Clause'],
    text: 'nor shall any State deprive any person of life, liberty, or property, without due process of law;',
  }),
  amendmentClause({
    locator: 'amdt14.sec1.cl4', amendment: 14, section: 1, clause: 4,
    title: 'Fourteenth Amendment, Section 1, Clause 4',
    authors: ['39th Congress'], date: '1868-07-09',
    shortNames: ['Equal Protection Clause'],
    text: 'nor deny to any person within its jurisdiction the equal protection of the laws.',
  }),
  amendmentClause({
    locator: 'amdt14.sec2', amendment: 14, section: 2, clause: null,
    title: 'Fourteenth Amendment, Section 2',
    authors: ['39th Congress'], date: '1868-07-09',
    shortNames: ['Apportionment of Representatives Clause'],
    text: 'Representatives shall be apportioned among the several States according to their respective numbers, counting the whole number of persons in each State, excluding Indians not taxed. But when the right to vote at any election for the choice of electors for President and Vice-President of the United States, Representatives in Congress, the Executive and Judicial officers of a State, or the members of the Legislature thereof, is denied to any of the male inhabitants of such State, being twenty-one years of age, and citizens of the United States, or in any way abridged, except for participation in rebellion, or other crime, the basis of representation therein shall be reduced in the proportion which the number of such male citizens shall bear to the whole number of male citizens twenty-one years of age in such State.',
    supersededBy: ['constitution:amdt26.sec1'],
  }),
  amendmentClause({
    locator: 'amdt14.sec3', amendment: 14, section: 3, clause: null,
    title: 'Fourteenth Amendment, Section 3',
    authors: ['39th Congress'], date: '1868-07-09',
    shortNames: ['Disqualification Clause', 'Insurrection Clause'],
    text: 'No person shall be a Senator or Representative in Congress, or elector of President and Vice-President, or hold any office, civil or military, under the United States, or under any State, who, having previously taken an oath, as a member of Congress, or as an officer of the United States, or as a member of any State legislature, or as an executive or judicial officer of any State, to support the Constitution of the United States, shall have engaged in insurrection or rebellion against the same, or given aid or comfort to the enemies thereof. But Congress may by a vote of two-thirds of each House, remove such disability.',
  }),
  amendmentClause({
    locator: 'amdt14.sec4', amendment: 14, section: 4, clause: null,
    title: 'Fourteenth Amendment, Section 4',
    authors: ['39th Congress'], date: '1868-07-09',
    shortNames: ['Public Debt Clause'],
    text: 'The validity of the public debt of the United States, authorized by law, including debts incurred for payment of pensions and bounties for services in suppressing insurrection or rebellion, shall not be questioned. But neither the United States nor any State shall assume or pay any debt or obligation incurred in aid of insurrection or rebellion against the United States, or any claim for the loss or emancipation of any slave; but all such debts, obligations and claims shall be held illegal and void.',
  }),
  amendmentClause({
    locator: 'amdt14.sec5', amendment: 14, section: 5, clause: null,
    title: 'Fourteenth Amendment, Section 5',
    authors: ['39th Congress'], date: '1868-07-09',
    shortNames: ['Fourteenth Amendment Enforcement Clause'],
    text: 'The Congress shall have power to enforce, by appropriate legislation, the provisions of this article.',
  }),
  amendmentClause({
    locator: 'amdt15.sec1', amendment: 15, section: 1, clause: null,
    title: 'Fifteenth Amendment, Section 1',
    authors: ['40th Congress'], date: '1870-02-03',
    shortNames: ['Race-Based Voting Rights Clause'],
    text: 'The right of citizens of the United States to vote shall not be denied or abridged by the United States or by any State on account of race, color, or previous condition of servitude--',
  }),
  amendmentClause({
    locator: 'amdt15.sec2', amendment: 15, section: 2, clause: null,
    title: 'Fifteenth Amendment, Section 2',
    authors: ['40th Congress'], date: '1870-02-03',
    shortNames: ['Fifteenth Amendment Enforcement Clause'],
    text: 'The Congress shall have power to enforce this article by appropriate legislation.',
  }),
  amendmentClause({
    locator: 'amdt16', amendment: 16, section: null, clause: null,
    title: 'Sixteenth Amendment',
    authors: ['61st Congress'], date: '1913-02-03',
    shortNames: ['Income Tax Clause'],
    text: 'The Congress shall have power to lay and collect taxes on incomes, from whatever source derived, without apportionment among the several States, and without regard to any census or enumeration.',
  }),
  amendmentClause({
    locator: 'amdt17.cl1', amendment: 17, section: null, clause: 1,
    title: 'Seventeenth Amendment, Clause 1',
    authors: ['62nd Congress'], date: '1913-04-08',
    shortNames: ['Direct Election of Senators Clause'],
    text: 'The Senate of the United States shall be composed of two Senators from each State, elected by the people thereof, for six years; and each Senator shall have one vote. The electors in each State shall have the qualifications requisite for electors of the most numerous branch of the State legislatures.',
  }),
  amendmentClause({
    locator: 'amdt17.cl2', amendment: 17, section: null, clause: 2,
    title: 'Seventeenth Amendment, Clause 2',
    authors: ['62nd Congress'], date: '1913-04-08',
    shortNames: ['Senate Vacancies Clause'],
    text: 'When vacancies happen in the representation of any State in the Senate, the executive authority of such State shall issue writs of election to fill such vacancies: Provided, That the legislature of any State may empower the executive thereof to make temporary appointments until the people fill the vacancies by election as the legislature may direct.',
  }),
  amendmentClause({
    locator: 'amdt17.cl3', amendment: 17, section: null, clause: 3,
    title: 'Seventeenth Amendment, Clause 3',
    authors: ['62nd Congress'], date: '1913-04-08',
    text: 'This amendment shall not be so construed as to affect the election or term of any Senator chosen before it becomes valid as part of the Constitution.',
  }),
  amendmentClause({
    locator: 'amdt18.sec1', amendment: 18, section: 1, clause: null,
    title: 'Eighteenth Amendment, Section 1',
    authors: ['65th Congress'], date: '1919-01-16',
    shortNames: ['Prohibition Clause'],
    text: 'After one year from the ratification of this article the manufacture, sale, or transportation of intoxicating liquors within, the importation thereof into, or the exportation thereof from the United States and all territory subject to the jurisdiction thereof for beverage purposes is hereby prohibited.',
    supersededBy: ['constitution:amdt21.sec1'],
  }),
  amendmentClause({
    locator: 'amdt18.sec2', amendment: 18, section: 2, clause: null,
    title: 'Eighteenth Amendment, Section 2',
    authors: ['65th Congress'], date: '1919-01-16',
    text: 'The Congress and the several States shall have concurrent power to enforce this article by appropriate legislation.',
    supersededBy: ['constitution:amdt21.sec1'],
  }),
  amendmentClause({
    locator: 'amdt18.sec3', amendment: 18, section: 3, clause: null,
    title: 'Eighteenth Amendment, Section 3',
    authors: ['65th Congress'], date: '1919-01-16',
    text: 'This article shall be inoperative unless it shall have been ratified as an amendment to the Constitution by the legislatures of the several States, as provided in the Constitution, within seven years from the date of the submission hereof to the States by the Congress.',
    supersededBy: ['constitution:amdt21.sec1'],
  }),
  amendmentClause({
    locator: 'amdt19.cl1', amendment: 19, section: null, clause: 1,
    title: 'Nineteenth Amendment, Clause 1',
    authors: ['66th Congress'], date: '1920-08-18',
    shortNames: ["Women's Suffrage Clause"],
    text: 'The right of citizens of the United States to vote shall not be denied or abridged by the United States or by any State on account of sex.',
  }),
  amendmentClause({
    locator: 'amdt19.cl2', amendment: 19, section: null, clause: 2,
    title: 'Nineteenth Amendment, Clause 2',
    authors: ['66th Congress'], date: '1920-08-18',
    shortNames: ['Nineteenth Amendment Enforcement Clause'],
    text: 'Congress shall have power to enforce this article by appropriate legislation.',
  }),
  amendmentClause({
    locator: 'amdt20.sec1', amendment: 20, section: 1, clause: null,
    title: 'Twentieth Amendment, Section 1',
    authors: ['72nd Congress'], date: '1933-01-23',
    shortNames: ['Commencement of Terms Clause'],
    text: 'The terms of the President and Vice President shall end at noon on the 20th day of January, and the terms of Senators and Representatives at noon on the 3d day of January, of the years in which such terms would have ended if this article had not been ratified; and the terms of their successors shall then begin.',
  }),
  amendmentClause({
    locator: 'amdt20.sec2', amendment: 20, section: 2, clause: null,
    title: 'Twentieth Amendment, Section 2',
    authors: ['72nd Congress'], date: '1933-01-23',
    shortNames: ['Annual Meeting of Congress Clause'],
    text: 'The Congress shall assemble at least once in every year, and such meeting shall begin at noon on the 3d day of January, unless they shall by law appoint a different day.',
  }),
  amendmentClause({
    locator: 'amdt20.sec3', amendment: 20, section: 3, clause: null,
    title: 'Twentieth Amendment, Section 3',
    authors: ['72nd Congress'], date: '1933-01-23',
    shortNames: ['Presidential Succession (Pre-Inauguration) Clause'],
    text: 'If, at the time fixed for the beginning of the term of the President, the President elect shall have died, the Vice President elect shall become President. If a President shall not have been chosen before the time fixed for the beginning of his term, or if the President elect shall have failed to qualify, then the Vice President elect shall act as President until a President shall have qualified; and the Congress may by law provide for the case wherein neither a President elect nor a Vice President elect shall have qualified, declaring who shall then act as President, or the manner in which one who is to act shall be selected, and such person shall act accordingly until a President or Vice President shall have qualified.',
  }),
  amendmentClause({
    locator: 'amdt20.sec4', amendment: 20, section: 4, clause: null,
    title: 'Twentieth Amendment, Section 4',
    authors: ['72nd Congress'], date: '1933-01-23',
    text: 'The Congress may by law provide for the case of the death of any of the persons from whom the House of Representatives may choose a President whenever the right of choice shall have devolved upon them, and for the case of the death of any of the persons from whom the Senate may choose a Vice President whenever the right of choice shall have devolved upon them.',
  }),
  amendmentClause({
    locator: 'amdt20.sec5', amendment: 20, section: 5, clause: null,
    title: 'Twentieth Amendment, Section 5',
    authors: ['72nd Congress'], date: '1933-01-23',
    text: 'Sections 1 and 2 shall take effect on the 15th day of October following the ratification of this article.',
  }),
  amendmentClause({
    locator: 'amdt20.sec6', amendment: 20, section: 6, clause: null,
    title: 'Twentieth Amendment, Section 6',
    authors: ['72nd Congress'], date: '1933-01-23',
    text: 'This article shall be inoperative unless it shall have been ratified as an amendment to the Constitution by the legislatures of three-fourths of the several States within seven years from the date of its submission.',
  }),
  amendmentClause({
    locator: 'amdt21.sec1', amendment: 21, section: 1, clause: null,
    title: 'Twenty-first Amendment, Section 1',
    authors: ['72nd Congress'], date: '1933-12-05',
    shortNames: ['Repeal of Prohibition Clause'],
    text: 'The eighteenth article of amendment to the Constitution of the United States is hereby repealed.',
  }),
  amendmentClause({
    locator: 'amdt21.sec2', amendment: 21, section: 2, clause: null,
    title: 'Twenty-first Amendment, Section 2',
    authors: ['72nd Congress'], date: '1933-12-05',
    shortNames: ['State Liquor Importation Clause'],
    text: 'The transportation or importation into any State, Territory, or possession of the United States for delivery or use therein of intoxicating liquors, in violation of the laws thereof, is hereby prohibited.',
  }),
  amendmentClause({
    locator: 'amdt21.sec3', amendment: 21, section: 3, clause: null,
    title: 'Twenty-first Amendment, Section 3',
    authors: ['72nd Congress'], date: '1933-12-05',
    text: 'This article shall be inoperative unless it shall have been ratified as an amendment to the Constitution by conventions in the several States, as provided in the Constitution, within seven years from the date of the submission hereof to the States by the Congress.',
  }),
  amendmentClause({
    locator: 'amdt22.sec1', amendment: 22, section: 1, clause: null,
    title: 'Twenty-second Amendment, Section 1',
    authors: ['80th Congress'], date: '1951-02-27',
    shortNames: ['Presidential Term Limits Clause'],
    text: 'No person shall be elected to the office of the President more than twice, and no person who has held the office of President, or acted as President, for more than two years of a term to which some other person was elected President shall be elected to the office of the President more than once. But this Article shall not apply to any person holding the office of President when this Article was proposed by the Congress, and shall not prevent any person who may be holding the office of President, or acting as President, during the term within which this Article becomes operative from holding the office of President or acting as President during the remainder of such term.',
  }),
  amendmentClause({
    locator: 'amdt22.sec2', amendment: 22, section: 2, clause: null,
    title: 'Twenty-second Amendment, Section 2',
    authors: ['80th Congress'], date: '1951-02-27',
    text: 'This article shall be inoperative unless it shall have been ratified as an amendment to the Constitution by the legislatures of three-fourths of the several States within seven years from the date of its submission to the States by the Congress.',
  }),
  amendmentClause({
    locator: 'amdt23.sec1', amendment: 23, section: 1, clause: null,
    title: 'Twenty-third Amendment, Section 1',
    authors: ['86th Congress'], date: '1961-03-29',
    shortNames: ['D.C. Electors Clause'],
    text: 'The District constituting the seat of Government of the United States shall appoint in such manner as the Congress may direct: A number of electors of President and Vice President equal to the whole number of Senators and Representatives in Congress to which the District would be entitled if it were a State, but in no event more than the least populous State; they shall be in addition to those appointed by the States, but they shall be considered, for the purposes of the election of President and Vice President, to be electors appointed by a State; and they shall meet in the District and perform such duties as provided by the twelfth article of amendment.',
  }),
  amendmentClause({
    locator: 'amdt23.sec2', amendment: 23, section: 2, clause: null,
    title: 'Twenty-third Amendment, Section 2',
    authors: ['86th Congress'], date: '1961-03-29',
    shortNames: ['Twenty-third Amendment Enforcement Clause'],
    text: 'The Congress shall have power to enforce this article by appropriate legislation.',
  }),
  amendmentClause({
    locator: 'amdt24.sec1', amendment: 24, section: 1, clause: null,
    title: 'Twenty-fourth Amendment, Section 1',
    authors: ['87th Congress'], date: '1964-01-23',
    shortNames: ['Poll Tax Clause'],
    text: 'The right of citizens of the United States to vote in any primary or other election for President or Vice President, for electors for President or Vice President, or for Senator or Representative in Congress, shall not be denied or abridged by the United States or any State by reason of failure to pay any poll tax or other tax.',
  }),
  amendmentClause({
    locator: 'amdt24.sec2', amendment: 24, section: 2, clause: null,
    title: 'Twenty-fourth Amendment, Section 2',
    authors: ['87th Congress'], date: '1964-01-23',
    shortNames: ['Twenty-fourth Amendment Enforcement Clause'],
    text: 'The Congress shall have power to enforce this article by appropriate legislation.',
  }),
  amendmentClause({
    locator: 'amdt25.sec1', amendment: 25, section: 1, clause: null,
    title: 'Twenty-fifth Amendment, Section 1',
    authors: ['89th Congress'], date: '1967-02-10',
    shortNames: ['Presidential Succession Clause'],
    text: 'In case of the removal of the President from office or of his death or resignation, the Vice President shall become President.',
  }),
  amendmentClause({
    locator: 'amdt25.sec2', amendment: 25, section: 2, clause: null,
    title: 'Twenty-fifth Amendment, Section 2',
    authors: ['89th Congress'], date: '1967-02-10',
    shortNames: ['Vice Presidential Vacancy Clause'],
    text: 'Whenever there is a vacancy in the office of the Vice President, the President shall nominate a Vice President who shall take office upon confirmation by a majority vote of both Houses of Congress.',
  }),
  amendmentClause({
    locator: 'amdt25.sec3', amendment: 25, section: 3, clause: null,
    title: 'Twenty-fifth Amendment, Section 3',
    authors: ['89th Congress'], date: '1967-02-10',
    shortNames: ['Presidential Disability (Voluntary) Clause'],
    text: 'Whenever the President transmits to the President pro tempore of the Senate and the Speaker of the House of Representatives his written declaration that he is unable to discharge the powers and duties of his office, and until he transmits to them a written declaration to the contrary, such powers and duties shall be discharged by the Vice President as Acting President.',
  }),
  amendmentClause({
    locator: 'amdt25.sec4', amendment: 25, section: 4, clause: null,
    title: 'Twenty-fifth Amendment, Section 4',
    authors: ['89th Congress'], date: '1967-02-10',
    shortNames: ['Presidential Disability (Involuntary) Clause'],
    text: [
      'Whenever the Vice President and a majority of either the principal officers of the executive departments or of such other body as Congress may by law provide, transmit to the President pro tempore of the Senate and the Speaker of the House of Representatives their written declaration that the President is unable to discharge the powers and duties of his office, the Vice President shall immediately assume the powers and duties of the office as Acting President.',
      'Thereafter, when the President transmits to the President pro tempore of the Senate and the Speaker of the House of Representatives his written declaration that no inability exists, he shall resume the powers and duties of his office unless the Vice President and a majority of either the principal officers of the executive department or of such other body as Congress may by law provide, transmit within four days to the President pro tempore of the Senate and the Speaker of the House of Representatives their written declaration that the President is unable to discharge the powers and duties of his office. Thereupon Congress shall decide the issue, assembling within forty-eight hours for that purpose if not in session. If the Congress, within twenty-one days after receipt of the latter written declaration, or, if Congress is not in session, within twenty-one days after Congress is required to assemble, determines by two-thirds vote of both Houses that the President is unable to discharge the powers and duties of his office, the Vice President shall continue to discharge the same as Acting President; otherwise, the President shall resume the powers and duties of his office.',
    ],
  }),
  amendmentClause({
    locator: 'amdt26.sec1', amendment: 26, section: 1, clause: null,
    title: 'Twenty-sixth Amendment, Section 1',
    authors: ['92nd Congress'], date: '1971-07-01',
    shortNames: ['Voting Age Clause'],
    text: 'The right of citizens of the United States, who are eighteen years of age or older, to vote shall not be denied or abridged by the United States or by any State on account of age.',
  }),
  amendmentClause({
    locator: 'amdt26.sec2', amendment: 26, section: 2, clause: null,
    title: 'Twenty-sixth Amendment, Section 2',
    authors: ['92nd Congress'], date: '1971-07-01',
    shortNames: ['Twenty-sixth Amendment Enforcement Clause'],
    text: 'The Congress shall have power to enforce this article by appropriate legislation.',
  }),
  amendmentClause({
    locator: 'amdt27', amendment: 27, section: null, clause: null,
    title: 'Twenty-seventh Amendment',
    authors: ['1st Congress'], date: '1992-05-07',
    shortNames: ['Congressional Compensation Clause'],
    text: 'No law, varying the compensation for the services of the Senators and Representatives, shall take effect, until an election of Representatives shall have intervened.',
  }),
];

// --- Assemble items --------------------------------------------------------

const items: Item[] = [
  preamble,
  ...articleI,
  ...articleII,
  ...articleIII,
  ...articleIV,
  ...articleV,
  ...articleVI,
  ...articleVII,
  ...billOfRights,
  ...laterAmendments,
];

// --- Verification ----------------------------------------------------------

function normalize(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function stripAnnotations(s: string): string {
  // Strip bracketed segments (editorial elisions added in the parser, and
  // National Archives source-level brackets marking superseded text in the
  // 12th Amendment), plus footnote asterisks (e.g., amdt14.sec2 raw carries
  // "twenty-one years of age,*"). Applied to both item text and raw text so
  // the substring check is annotation-agnostic.
  return s.replace(/\[[^\]]*\]\s*/g, '').replace(/\*+/g, '');
}

const rawBodyBytes = readFileSync(RAW_BODY);
const rawBorBytes = readFileSync(RAW_BOR);
const rawAmendBytes = readFileSync(RAW_AMEND);

const rawBodySha = createHash('sha256').update(rawBodyBytes).digest('hex');
const rawBorSha = createHash('sha256').update(rawBorBytes).digest('hex');
const rawAmendSha = createHash('sha256').update(rawAmendBytes).digest('hex');

const rawBodyNorm = normalize(stripAnnotations(rawBodyBytes.toString('utf8')));
const rawBorNorm = normalize(stripAnnotations(rawBorBytes.toString('utf8')));
const rawAmendNorm = normalize(stripAnnotations(rawAmendBytes.toString('utf8')));

function rawFor(item: Item): string {
  if (item.constitution.kind === 'amendment_clause') {
    const n = item.constitution.amendment!;
    return n <= 10 ? rawBorNorm : rawAmendNorm;
  }
  return rawBodyNorm;
}

const errors: string[] = [];

for (const item of items) {
  const joined = normalize(stripAnnotations(item.paragraphs.join(' ')));
  if (!rawFor(item).includes(joined)) {
    errors.push(`text not found in raw for ${item.id}`);
  }
}

const ids = new Set<string>();
for (const item of items) {
  if (ids.has(item.id)) errors.push(`duplicate id: ${item.id}`);
  ids.add(item.id);
}

// Cross-reference: every superseded_by target must be a real ID.
for (const item of items) {
  for (const target of item.constitution.superseded_by) {
    if (!ids.has(target)) {
      errors.push(`${item.id} references missing supersede target ${target}`);
    }
  }
}

const bodyCount = items.filter((i) => i.constitution.kind === 'body_clause').length;
const amdtCount = items.filter((i) => i.constitution.kind === 'amendment_clause').length;
const preambleCount = items.filter((i) => i.constitution.kind === 'preamble').length;

const EXPECTED_BODY = 84;
const EXPECTED_AMDT = 68;
const EXPECTED_PREAMBLE = 1;
if (bodyCount !== EXPECTED_BODY) errors.push(`body count ${bodyCount}, expected ${EXPECTED_BODY}`);
if (amdtCount !== EXPECTED_AMDT) errors.push(`amendment count ${amdtCount}, expected ${EXPECTED_AMDT}`);
if (preambleCount !== EXPECTED_PREAMBLE) errors.push(`preamble count ${preambleCount}, expected ${EXPECTED_PREAMBLE}`);

// Coverage: every article 1–7 and every amendment 1–27 present.
const articlesSeen = new Set<number>();
const amendmentsSeen = new Set<number>();
for (const item of items) {
  if (item.constitution.article !== null) articlesSeen.add(item.constitution.article);
  if (item.constitution.amendment !== null) amendmentsSeen.add(item.constitution.amendment);
}
for (let n = 1; n <= 7; n++) {
  if (!articlesSeen.has(n)) errors.push(`missing Article ${n}`);
}
for (let n = 1; n <= 27; n++) {
  if (!amendmentsSeen.has(n)) errors.push(`missing Amendment ${n}`);
}

if (errors.length) {
  for (const e of errors) console.error(e);
  throw new Error(`verification failed: ${errors.length} issues`);
}

// --- Emit JSON -------------------------------------------------------------

const output = {
  corpus: 'constitution',
  source: {
    edition: 'National Archives transcription of the engrossed Constitution and ratified Amendments',
    url: BODY_URL,
    fetched: FETCHED,
    notes: `Source text drawn from three National Archives transcription pages: ${BODY_URL} (Preamble and Articles I–VII; sha256=${rawBodySha}), ${BOR_URL} (Bill of Rights, Amendments I–X; sha256=${rawBorSha}), and ${AMEND_URL} (Amendments XI–XXVII; sha256=${rawAmendSha}). HTML retrieved via curl and converted to plain text via pandoc; navigation chrome trimmed. Clause boundaries are editorial — the source text marks Articles and Sections but not clauses; clause splits encoded in parse.ts follow conventional legal-treatise practice (each clause is the smallest independently citable unit). Article I §8 clauses 2–18 carry a bracketed elision "[The Congress shall have Power]" to restore the antecedent for standalone readability; the bracketed text is editorial and is stripped during text-in-raw verification. Signatures, the interlineation note, and editorial annotations (e.g., the asterisk and "*Superseded by..." footnotes on Amendments XII, XIV, and XX) appear in the raw transcription but are not addressable items.`,
  },
  count: items.length,
  items,
};

writeFileSync(OUT_PATH, JSON.stringify(output, null, 2) + '\n');

console.log(`wrote ${items.length} items to ${OUT_PATH}`);
console.log(`  preamble: ${preambleCount}`);
console.log(`  body clauses: ${bodyCount}`);
console.log(`  amendment clauses: ${amdtCount}`);
