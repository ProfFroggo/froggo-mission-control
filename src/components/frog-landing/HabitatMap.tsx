// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
'use client';

import { useState } from 'react';
import { Globe, MapPin } from 'lucide-react';
import { HABITAT_REGIONS, type HabitatRegion } from './frog-data';

/**
 * Habitat Map — illustrated world map with interactive frog-range overlay dots.
 * Desktop: hover to see tooltip. Mobile: tap to select region and show details below.
 */
export function HabitatMap() {
  const [selectedRegion, setSelectedRegion] = useState<HabitatRegion | null>(null);

  return (
    <section
      id="habitat"
      className="frog-habitat-section frog-section-padding"
      aria-label="Frog habitats around the world"
    >
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold text-[var(--frog-mist)] sm:text-4xl">
            Where Frogs Live
          </h2>
          <p className="mt-3 text-[var(--frog-lily)] max-w-xl mx-auto">
            Frogs inhabit every continent except Antarctica. Hover over a region to
            learn about its amphibian diversity.
          </p>
        </div>

        {/* Map container with stylized world outline */}
        <div className="frog-map-container">
          {/* Simplified SVG world map outline */}
          <svg
            viewBox="0 0 1000 562"
            className="absolute inset-0 w-full h-full"
            aria-hidden="true"
          >
            {/* Simplified continent outlines */}
            {/* North America */}
            <path
              d="M120,100 Q150,80 200,90 Q250,85 280,110 Q300,130 290,170 Q275,200 250,220 Q220,240 190,230 Q160,220 140,200 Q120,180 115,150 Q110,120 120,100Z"
              fill="rgba(82,183,136,0.08)"
              stroke="rgba(82,183,136,0.2)"
              strokeWidth="1"
            />
            {/* South America */}
            <path
              d="M230,270 Q260,260 280,280 Q300,310 310,350 Q310,390 290,420 Q270,450 250,440 Q230,430 220,400 Q210,370 215,340 Q218,310 225,285Z"
              fill="rgba(82,183,136,0.08)"
              stroke="rgba(82,183,136,0.2)"
              strokeWidth="1"
            />
            {/* Africa */}
            <path
              d="M450,200 Q480,190 510,200 Q540,220 550,260 Q555,300 540,340 Q520,370 500,380 Q475,385 460,360 Q445,330 440,290 Q435,250 445,220Z"
              fill="rgba(82,183,136,0.08)"
              stroke="rgba(82,183,136,0.2)"
              strokeWidth="1"
            />
            {/* Europe */}
            <path
              d="M430,100 Q460,85 500,95 Q530,100 540,120 Q545,145 530,160 Q510,170 480,165 Q455,160 440,145 Q430,125 430,100Z"
              fill="rgba(82,183,136,0.06)"
              stroke="rgba(82,183,136,0.15)"
              strokeWidth="1"
            />
            {/* Asia */}
            <path
              d="M560,90 Q620,70 700,85 Q760,100 800,130 Q820,160 810,200 Q790,230 750,240 Q700,245 660,230 Q620,210 590,180 Q565,150 555,120Z"
              fill="rgba(82,183,136,0.08)"
              stroke="rgba(82,183,136,0.2)"
              strokeWidth="1"
            />
            {/* Australia */}
            <path
              d="M760,340 Q800,330 840,340 Q870,360 875,390 Q870,420 845,435 Q815,440 785,430 Q760,415 755,385 Q752,360 760,340Z"
              fill="rgba(82,183,136,0.08)"
              stroke="rgba(82,183,136,0.2)"
              strokeWidth="1"
            />
          </svg>

          {/* Interactive region dots */}
          {HABITAT_REGIONS.map((region) => (
            <button
              key={region.name}
              className="frog-map-dot"
              style={{ left: `${region.x}%`, top: `${region.y}%` }}
              onClick={() => setSelectedRegion(region)}
              onMouseEnter={() => setSelectedRegion(region)}
              aria-label={`${region.name}: ${region.speciesCount} species`}
              type="button"
            >
              {/* Desktop tooltip */}
              <div className="frog-map-tooltip hidden lg:block">
                <p className="font-semibold text-[var(--frog-mist)] text-sm">
                  {region.name}
                </p>
                <p className="text-xs text-[var(--frog-lily)]">
                  {region.speciesCount}+ species
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* Selected region detail (mobile + desktop) */}
        <div className="mt-8 text-center min-h-[80px]" aria-live="polite">
          {selectedRegion ? (
            <div className="inline-flex flex-col items-center gap-2 rounded-xl border border-[rgba(82,183,136,0.2)] bg-[rgba(13,31,23,0.6)] px-8 py-5">
              <div className="flex items-center gap-2 text-[var(--frog-moss)]">
                <MapPin className="h-5 w-5" aria-hidden="true" />
                <h3 className="text-lg font-semibold text-[var(--frog-mist)]">
                  {selectedRegion.name}
                </h3>
              </div>
              <p className="text-[var(--frog-lily)] text-sm max-w-md">
                {selectedRegion.description}
              </p>
              <p className="text-2xl font-bold text-[var(--frog-amber)]">
                {selectedRegion.speciesCount}+{' '}
                <span className="text-sm font-normal text-[var(--frog-lily)]">
                  species
                </span>
              </p>
            </div>
          ) : (
            <p className="text-sm text-[var(--frog-lily)] opacity-60 flex items-center justify-center gap-2">
              <Globe className="h-4 w-4" aria-hidden="true" />
              Select a region on the map to learn more
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
