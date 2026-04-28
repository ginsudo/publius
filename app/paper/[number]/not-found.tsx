import Link from 'next/link';

export default function NotFound() {
  return (
    <main>
      <h1 className="paper-notfound__heading">Paper not found</h1>
      <p className="paper-notfound__body">
        The Federalist Papers are numbered 1–85.{' '}
        <Link href="/browse">Browse the index</Link>.
      </p>
    </main>
  );
}
