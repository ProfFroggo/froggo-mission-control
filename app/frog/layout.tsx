// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Froggo - Your Cozy AI Command Center',
  description:
    'A cozy little AI command center. Meet Froggo, the friendliest mission control mascot in the garden.',
  openGraph: {
    title: 'Froggo - Your Cozy AI Command Center',
    description:
      'A cozy little AI command center. Meet Froggo, the friendliest mission control mascot in the garden.',
    type: 'website',
  },
};

export default function FrogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
