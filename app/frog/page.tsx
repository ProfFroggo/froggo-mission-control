// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import type { Metadata } from 'next';
import FrogHero from './components/FrogHero';
import FeatureCards from './components/FeatureCards';
import FrogFacts from './components/FrogFacts';
import FrogWisdom from './components/FrogWisdom';
import VibeSection from './components/VibeSection';
import ShareCTA from './components/ShareCTA';
import FrogFooter from './components/FrogFooter';
import './frog.css';

export const metadata: Metadata = {
  title: 'Froggo - Your Cozy AI Command Center',
  description: 'A cozy little AI command center. Meet Froggo, the friendliest mission control mascot in the garden.',
  openGraph: {
    title: 'Froggo - Your Cozy AI Command Center',
    description: 'A cozy little AI command center, where agents feel at home. Pure cottagecore vibes.',
    type: 'website',
    siteName: 'Froggo',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Froggo - Your Cozy AI Command Center',
    description: 'A cozy little AI command center, where agents feel at home. Pure cottagecore vibes.',
  },
};

export default function FrogPage() {
  return (
    <div className="frog-page">
      <FrogHero />
      <FeatureCards />
      <FrogFacts />
      <FrogWisdom />
      <VibeSection />
      <ShareCTA />
      <FrogFooter />
    </div>
  );
}
