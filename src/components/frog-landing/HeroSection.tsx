// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
'use client';

import { ChevronDown, Leaf } from 'lucide-react';

/**
 * Hero section — full-bleed gradient with overlaid headline, subhead, and CTA.
 * Includes an animated scroll indicator at the bottom.
 */
export function HeroSection() {
  return (
    <section className="frog-hero" aria-label="Hero">
      {/* Background image overlay */}
      <div
        className="frog-hero-bg"
        style={{ backgroundImage: "url('/frog-landing/hero-bg.jpg')" }}
        role="presentation"
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-3xl mx-auto">
        <div className="mb-6 flex items-center gap-2 rounded-full border border-[rgba(82,183,136,0.3)] bg-[rgba(26,58,42,0.5)] px-4 py-2 text-sm text-[var(--frog-lily)]">
          <Leaf className="h-4 w-4" aria-hidden="true" />
          <span>Explore the world of amphibians</span>
        </div>

        <h1 className="text-5xl font-bold tracking-tight text-[var(--frog-mist)] sm:text-6xl lg:text-7xl leading-tight">
          The Extraordinary
          <br />
          <span className="text-[var(--frog-moss)]">World of Frogs</span>
        </h1>

        <p className="mt-6 text-lg text-[var(--frog-lily)] max-w-xl leading-relaxed sm:text-xl">
          From the canopies of the Amazon to the wetlands of Madagascar, discover
          the remarkable creatures that have thrived for 200 million years.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
          <a href="#species" className="frog-btn-primary">
            <Leaf className="h-5 w-5" aria-hidden="true" />
            Discover Species
          </a>
          <a href="#conservation" className="frog-btn-outline">
            Help Protect Frogs
          </a>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 frog-scroll-indicator">
        <a
          href="#facts"
          className="flex flex-col items-center gap-1 text-[var(--frog-lily)] opacity-60 hover:opacity-100 transition-opacity"
          aria-label="Scroll to learn more"
        >
          <span className="text-xs uppercase tracking-widest">Scroll</span>
          <ChevronDown className="h-5 w-5" aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}
