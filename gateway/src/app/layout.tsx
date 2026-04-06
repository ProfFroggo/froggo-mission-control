import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import './globals.css';

export const metadata: Metadata = {
  title: 'Froggo Mission Control',
  description: 'AI agent platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider appearance={{ baseTheme: dark }}>
      <html lang="en" className="dark">
        <body className="min-h-screen bg-surface text-white antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
