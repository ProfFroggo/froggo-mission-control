// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.

/**
 * Frog Landing Page — main route.
 *
 * A standalone educational landing page celebrating frog biodiversity.
 * Composed of 7 sections defined by the designer spec:
 *   1. Hero — full-bleed gradient with headline, CTA, scroll indicator
 *   2. Facts Strip — 3-col stat cards (species count, age, conservation status)
 *   3. Species Spotlight — alternating image+text rows with "did you know" callouts
 *   4. Habitat Map — illustrated world map with interactive region dots
 *   5. Gallery — CSS Grid photo mosaic with lightbox
 *   6. Conservation CTA — full-width dark section, single focused action
 *   7. Footer — minimal nav, external links, attribution
 *
 * Design tokens: custom frog palette defined in frog-landing.css
 * Tech: Next.js App Router, TypeScript strict, TailwindCSS, Lucide icons
 */

import {
  HeroSection,
  FactsStrip,
  SpeciesSpotlight,
  HabitatMap,
  Gallery,
  ConservationCTA,
  Footer,
} from '@/components/frog-landing';

export default function FrogLandingPage() {
  return (
    <main>
      <HeroSection />
      <FactsStrip />
      <SpeciesSpotlight />
      <HabitatMap />
      <Gallery />
      <ConservationCTA />
      <Footer />
    </main>
  );
}
