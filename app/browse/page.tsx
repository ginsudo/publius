import Link from 'next/link';

type CorpusCard = {
  href: string | null;
  mode: string;
  title: string;
  meta: string;
  authorship: string;
  era: string;
};

const CORPORA: CorpusCard[] = [
  {
    href: '/browse/federalist',
    mode: 'Argument',
    title: 'Federalist Papers',
    meta: '85 papers',
    authorship: 'Hamilton, Madison & Jay',
    era: '1787–88',
  },
  {
    href: '/browse/tocqueville',
    mode: 'Observation',
    title: 'Democracy in America',
    meta: '124 chapters',
    authorship: 'Tocqueville',
    era: '1835 / 1840',
  },
  {
    href: null,
    mode: 'Holding & Reasoning',
    title: 'Supreme Court Opinions',
    meta: 'Curated case list',
    authorship: '',
    era: 'Founding era to present',
  },
];

export default function BrowseLandingPage() {
  return (
    <main className="browse-landing">
      <h1 className="browse-landing__heading">Browse</h1>
      <p className="browse-landing__subtitle">
        The text and three corpora in genuine dialogue — argument, observation,
        holding
      </p>

      <Link href="/browse/constitution" className="browse-landing__primary">
        <div className="browse-landing__primary-left">
          <div className="browse-landing__primary-label">Primary text</div>
          <div className="browse-landing__primary-title">
            The United States Constitution
          </div>
        </div>
        <div className="browse-landing__primary-right">
          <div className="browse-landing__primary-era">1787</div>
          <div className="browse-landing__primary-meta">
            7 articles · 27 amendments
          </div>
        </div>
      </Link>

      <div className="browse-landing__commentary-label">Commentary</div>
      <div className="browse-landing__grid">
        {CORPORA.map((c) => {
          const inner = (
            <>
              <div className="browse-landing__card-mode">{c.mode}</div>
              <div className="browse-landing__card-title">{c.title}</div>
              <div className="browse-landing__card-meta">
                {c.meta}
                {c.authorship && (
                  <>
                    <span aria-hidden="true"> · </span>
                    {c.authorship}
                  </>
                )}
              </div>
              <div className="browse-landing__card-era">{c.era}</div>
              {!c.href && (
                <div className="browse-landing__card-forthcoming">
                  Forthcoming
                </div>
              )}
            </>
          );
          if (c.href) {
            return (
              <Link
                key={c.title}
                href={c.href}
                className="browse-landing__card"
              >
                {inner}
              </Link>
            );
          }
          return (
            <div
              key={c.title}
              className="browse-landing__card browse-landing__card--disabled"
              aria-disabled="true"
            >
              {inner}
            </div>
          );
        })}
      </div>
    </main>
  );
}
