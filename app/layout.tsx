import type { Metadata } from 'next';
import '../src/index.css';
import '../src/accessibility.css';

export const metadata: Metadata = {
  title: 'Mission Control Dashboard',
  description: 'Multi-agent orchestration platform',
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
