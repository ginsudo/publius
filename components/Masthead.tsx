import Link from 'next/link';

export function Masthead() {
  return (
    <header className="masthead">
      <Link href="/ask" className="masthead-wordmark">
        Publius
      </Link>
      <nav className="masthead-nav" aria-label="Primary">
        <Link href="/ask">Ask</Link>
      </nav>
    </header>
  );
}
