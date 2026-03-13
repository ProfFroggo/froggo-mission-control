// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
'use client';

import { Lightbulb } from 'lucide-react';
import { FROG_SPECIES } from './frog-data';

/**
 * Species Spotlight — alternating image + text rows with "Did you know" callouts.
 * Each species card features a description and a highlighted fact.
 */
export function SpeciesSpotlight() {
  return (
    <section
      id="species"
      className="frog-species-section frog-section-padding"
      aria-label="Species spotlight"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold text-[var(--frog-mist)] sm:text-4xl">
            Species Spotlight
          </h2>
          <p className="mt-3 text-[var(--frog-lily)] max-w-xl mx-auto">
            Meet some of the most fascinating frog species on the planet.
          </p>
        </div>

        <div className="space-y-12 lg:space-y-16">
          {FROG_SPECIES.map((species, idx) => {
            const isReversed = idx % 2 === 1;
            return (
              <article
                key={species.name}
                className="frog-species-card"
              >
                <div
                  className={`flex flex-col ${isReversed ? 'lg:flex-row-reverse' : 'lg:flex-row'}`}
                >
                  {/* Image placeholder */}
                  <div className="lg:w-2/5 min-h-[240px] lg:min-h-[320px] bg-[var(--frog-canopy)] flex items-center justify-center">
                    <div className="text-center p-6">
                      <div className="w-24 h-24 mx-auto rounded-full bg-[rgba(82,183,136,0.2)] flex items-center justify-center mb-3">
                        <Lightbulb
                          className="h-10 w-10 text-[var(--frog-moss)]"
                          aria-hidden="true"
                        />
                      </div>
                      <p className="text-sm text-[var(--frog-lily)] italic">
                        {species.imageAlt}
                      </p>
                    </div>
                  </div>

                  {/* Text content */}
                  <div className="lg:w-3/5 p-6 lg:p-8 flex flex-col justify-center">
                    <h3 className="text-2xl font-bold text-[var(--frog-mist)]">
                      {species.name}
                    </h3>
                    <p className="mt-1 text-sm italic text-[var(--frog-moss)]">
                      {species.scientificName}
                    </p>
                    <p className="mt-4 text-[var(--frog-lily)] leading-relaxed">
                      {species.description}
                    </p>

                    {/* Did you know callout */}
                    <div className="frog-callout mt-5">
                      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--frog-amber)] mb-1">
                        Did you know?
                      </p>
                      <p className="text-sm text-[var(--frog-parchment)]">
                        {species.fact}
                      </p>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
