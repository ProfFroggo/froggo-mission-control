// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
'use client';

import { Bug, Clock, AlertTriangle } from 'lucide-react';
import { FROG_STATS } from './frog-data';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Bug,
  Clock,
  AlertTriangle,
};

/**
 * Facts strip — 3-column stat cards with icon, number, and label.
 * Displays key frog statistics at a glance.
 */
export function FactsStrip() {
  return (
    <section
      id="facts"
      className="frog-facts-strip frog-section-padding"
      aria-label="Frog facts"
    >
      <div className="mx-auto max-w-5xl">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {FROG_STATS.map((stat) => {
            const Icon = ICON_MAP[stat.icon];
            return (
              <div key={stat.label} className="frog-stat-card">
                {Icon && (
                  <Icon
                    className="mx-auto mb-3 h-8 w-8 text-[var(--frog-moss)]"
                    aria-hidden="true"
                  />
                )}
                <p className="text-4xl font-bold text-[var(--frog-mist)]">
                  {stat.value}
                </p>
                <p className="mt-1 text-sm uppercase tracking-wider text-[var(--frog-lily)]">
                  {stat.label}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
