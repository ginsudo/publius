import Link from 'next/link';

import constitutionData from '@/data/constitution/constitution.json';

type ConstitutionItem = {
  id: string;
  title: string;
  constitution: {
    kind: 'preamble' | 'body_clause' | 'amendment_clause';
    article: number | null;
    section: number | null;
    clause: number | null;
    amendment: number | null;
  };
};

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

const ARTICLE_SUBTITLES: Record<number, string> = {
  1: 'The Legislative Branch',
  2: 'The Executive Branch',
  3: 'The Judicial Branch',
  4: 'The States',
  5: 'The Amendment Process',
  6: 'Supremacy',
  7: 'Ratification',
};

export default function ConstitutionBrowsePage() {
  const items = constitutionData.items as ConstitutionItem[];

  const clauseCounts = new Map<number, number>();
  for (const it of items) {
    if (it.constitution.kind === 'body_clause' && it.constitution.article != null) {
      const n = it.constitution.article;
      clauseCounts.set(n, (clauseCounts.get(n) ?? 0) + 1);
    }
  }
  const articleNumbers = [...clauseCounts.keys()].sort((a, b) => a - b);

  return (
    <main>
      <nav className="browse-breadcrumb" aria-label="Breadcrumb">
        <Link href="/browse">Browse</Link>
        <span className="browse-breadcrumb__sep" aria-hidden="true">›</span>
        <span aria-current="page">Constitution</span>
      </nav>
      <h1 className="browse-heading">The United States Constitution</h1>
      <p className="browse-subtitle">
        Primary text · 1787 · 7 articles · 27 amendments · 153 clauses
      </p>

      <ol className="browse-list browse-list--const">
        <li className="browse-row-const">
          <Link href="/constitution/preamble" className="browse-row-const__link">
            <span className="browse-row-const__locator">Preamble</span>
            <span className="browse-row-const__title">&nbsp;</span>
            <span className="browse-row-const__meta">1788 · 1 paragraph</span>
          </Link>
        </li>
        {articleNumbers.map((n) => {
          const count = clauseCounts.get(n) ?? 0;
          return (
            <li key={`art-${n}`} className="browse-row-const">
              <Link
                href={`/constitution/article-${n}`}
                className="browse-row-const__link"
              >
                <span className="browse-row-const__locator">
                  Article {ROMAN[n]}
                </span>
                <span className="browse-row-const__title">
                  {ARTICLE_SUBTITLES[n] ?? ''}
                </span>
                <span className="browse-row-const__meta">
                  {count} {count === 1 ? 'clause' : 'clauses'}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>

      <div className="browse-volume-divider">Amendments</div>

      <ol className="browse-list browse-list--const">
        <li className="browse-row-const">
          <Link
            href="/constitution/bill-of-rights"
            className="browse-row-const__link"
          >
            <span className="browse-row-const__locator">Amendments I–X</span>
            <span className="browse-row-const__title">The Bill of Rights</span>
            <span className="browse-row-const__meta">1791 · 10 amendments</span>
          </Link>
        </li>
        <li className="browse-row-const">
          <Link
            href="/constitution/amendments-11-27"
            className="browse-row-const__link"
          >
            <span className="browse-row-const__locator">Amendments XI–XXVII</span>
            <span className="browse-row-const__title">Subsequent Amendments</span>
            <span className="browse-row-const__meta">
              1795–1992 · 17 amendments
            </span>
          </Link>
        </li>
      </ol>
    </main>
  );
}
