import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Spectral, Playfair_Display } from 'next/font/google';

import { Masthead } from '@/components/Masthead';

import './globals.css';

const spectral = Spectral({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-spectral',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-playfair',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Publius',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${spectral.variable} ${playfair.variable}`}>
      <body>
        <Masthead />
        {children}
      </body>
    </html>
  );
}
