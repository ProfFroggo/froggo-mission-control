// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
'use client';

import { Leaf, Github, ExternalLink } from 'lucide-react';

const NAV_LINKS = [
  { label: 'Species', href: '#species' },
  { label: 'Habitats', href: '#habitat' },
  { label: 'Gallery', href: '#gallery' },
  { label: 'Conservation', href: '#conservation' },
];

const EXTERNAL_LINKS = [
  { label: 'AmphibiaWeb', href: 'https://amphibiaweb.org' },
  { label: 'IUCN Red List', href: 'https://www.iucnredlist.org' },
  { label: 'Save The Frogs', href: 'https://www.savethefrogs.com' },
];

/**
 * Footer — minimal navigation links, external resource links, and attribution.
 */
export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="frog-footer" aria-label="Footer">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-start sm:justify-between">
          {/* Brand */}
          <div className="flex flex-col items-center sm:items-start gap-3">
            <div className="flex items-center gap-2 text-[var(--frog-moss)]">
              <Leaf className="h-5 w-5" aria-hidden="true" />
              <span className="font-bold text-[var(--frog-mist)]">
                The World of Frogs
              </span>
            </div>
            <p className="text-xs text-[var(--frog-lily)] opacity-50 max-w-xs text-center sm:text-left">
              An educational landing page celebrating amphibian biodiversity.
            </p>
          </div>

          {/* Page nav */}
          <nav aria-label="Footer navigation">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--frog-moss)] mb-3 text-center sm:text-left">
              On this page
            </h3>
            <ul className="space-y-2">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-sm text-[var(--frog-lily)] hover:text-[var(--frog-mist)] transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* External resources */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--frog-moss)] mb-3 text-center sm:text-left">
              Resources
            </h3>
            <ul className="space-y-2">
              {EXTERNAL_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-[var(--frog-lily)] hover:text-[var(--frog-mist)] transition-colors"
                  >
                    {link.label}
                    <ExternalLink className="h-3 w-3 opacity-50" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 border-t border-[rgba(82,183,136,0.1)] pt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <p className="text-xs text-[var(--frog-lily)] opacity-40">
            {currentYear} The World of Frogs. Built with Mission Control.
          </p>
          <a
            href="https://github.com/ProfFroggo/froggo-mission-control"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[var(--frog-lily)] opacity-40 hover:opacity-70 transition-opacity"
            aria-label="View source on GitHub"
          >
            <Github className="h-4 w-4" aria-hidden="true" />
            Source
          </a>
        </div>
      </div>
    </footer>
  );
}
