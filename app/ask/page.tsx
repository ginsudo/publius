import type { Metadata } from 'next';

import { AskForm } from './AskForm';

export const metadata: Metadata = {
  title: 'Ask · Publius',
};

export default function AskPage() {
  return (
    <main>
      <AskForm />
    </main>
  );
}
