// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
'use client';

import { Heart, ExternalLink } from 'lucide-react';

/**
 * Conservation CTA — dark full-width section with a single focused call to action.
 * Urges visitors to support frog conservation efforts.
 */
export function ConservationCTA() {
  return (
    <section
      id="conservation"
      className="frog-cta-section frog-section-padding"
      aria-label="Conservation call to action"
    >
      <div className="mx-auto max-w-3xl text-center">
        <div className="mb-6 inline-flex items-center justify-center rounded-full bg-[rgba(233,196,106,0.1)] p-4">
          <Heart
            className="h-10 w-10 text-[var(--frog-amber)]"
            aria-hidden="true"
          />
        </div>

        <h2 className="text-3xl font-bold text-[var(--frog-mist)] sm:text-4xl lg:text-5xl">
          One-Third of All Frog Species
          <br />
          <span className="text-[var(--frog-amber)]">Are at Risk</span>
        </h2>

        <p className="mt-6 text-lg text-[var(--frog-lily)] leading-relaxed max-w-2xl mx-auto">
          Habitat loss, climate change, and the deadly chytrid fungus are pushing
          amphibians to the brink. But there is still time to act. Conservation
          efforts around the world are making a difference — and you can help.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <a
            href="https://www.savethefrogs.com"
            target="_blank"
            rel="noopener noreferrer"
            className="frog-btn-primary"
          >
            <Heart className="h-5 w-5" aria-hidden="true" />
            Support Conservation
            <ExternalLink className="h-4 w-4 opacity-60" aria-hidden="true" />
          </a>
          <a
            href="https://amphibiaweb.org"
            target="_blank"
            rel="noopener noreferrer"
            className="frog-btn-outline"
          >
            Learn More at AmphibiaWeb
            <ExternalLink className="h-4 w-4 opacity-60" aria-hidden="true" />
          </a>
        </div>

        <p className="mt-8 text-xs text-[var(--frog-lily)] opacity-50">
          Links open external conservation and research websites.
        </p>
      </div>
    </section>
  );
}
