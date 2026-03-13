// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import type { Metadata } from 'next';
import '../../src/components/frog-landing/frog-landing.css';

export const metadata: Metadata = {
  title: 'The Extraordinary World of Frogs',
  description:
    'Discover 7,000+ species of frogs — from the Amazon rainforest to the wetlands of Madagascar. Learn about their habitats, biology, and how to protect them.',
};

export default function FrogLandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
