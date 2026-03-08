import type { Metadata } from 'next';
import '../src/index.css';
import '../src/accessibility.css';

export const metadata: Metadata = {
  title: 'Mission Control',
  description: 'Multi-agent orchestration platform',
  icons: {
    icon: '/agent-profiles/froggo.webp',
    apple: '/agent-profiles/froggo.webp',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
