'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/browse', label: 'Browse' },
  { href: '/ask', label: 'Ask' },
];

export function Masthead() {
  const pathname = usePathname();
  return (
    <header className="masthead">
      <Link href="/ask" className="masthead-wordmark">
        Publius
      </Link>
      <nav className="masthead-nav" aria-label="Primary">
        {NAV.map((item) => {
          const active =
            pathname === item.href || pathname?.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
