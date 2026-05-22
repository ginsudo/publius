import Link from 'next/link';

export default function NotFound() {
  return (
    <main>
      <h1 className="paper-notfound__heading">Section not found</h1>
      <p className="paper-notfound__body">
        That part of the Constitution isn&apos;t a known section.{' '}
        <Link href="/browse/constitution">Browse the Constitution</Link>.
      </p>
    </main>
  );
}
