import Link from 'next/link';

export default function NotFound() {
  return (
    <main>
      <h1 className="paper-notfound__heading">Item not found</h1>
      <p className="paper-notfound__body">
        No Tocqueville item matches that identifier.{' '}
        <Link href="/browse">Browse the index</Link>.
      </p>
    </main>
  );
}
