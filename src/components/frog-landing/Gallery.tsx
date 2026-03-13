// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
'use client';

import { useState, useCallback } from 'react';
import { X, Camera } from 'lucide-react';
import { GALLERY_IMAGES } from './frog-data';

/**
 * Gallery — CSS Grid photo mosaic with lightbox on click.
 * Uses placeholder cards since actual images aren't available yet.
 */
export function Gallery() {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const closeLightbox = useCallback(() => setLightboxIdx(null), []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
    },
    [closeLightbox],
  );

  return (
    <section
      id="gallery"
      className="frog-gallery-section frog-section-padding"
      aria-label="Photo gallery"
    >
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold text-[var(--frog-mist)] sm:text-4xl">
            Gallery
          </h2>
          <p className="mt-3 text-[var(--frog-lily)] max-w-xl mx-auto">
            A visual celebration of frogs in their natural habitats.
          </p>
        </div>

        <div className="frog-gallery-grid">
          {GALLERY_IMAGES.map((img, idx) => (
            <button
              key={img.src}
              type="button"
              className={`frog-gallery-item ${img.span === 'wide' ? 'span-wide' : ''} ${img.span === 'tall' ? 'span-tall' : ''}`}
              onClick={() => setLightboxIdx(idx)}
              aria-label={`View: ${img.alt}`}
            >
              {/* Placeholder card with icon */}
              <div className="absolute inset-0 bg-[var(--frog-canopy)] flex flex-col items-center justify-center gap-2 p-4">
                <Camera
                  className="h-8 w-8 text-[var(--frog-moss)] opacity-40"
                  aria-hidden="true"
                />
                <p className="text-xs text-[var(--frog-lily)] text-center opacity-60 leading-tight">
                  {img.alt}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Lightbox overlay */}
      {lightboxIdx !== null && (
        <div
          className="frog-lightbox-overlay"
          onClick={closeLightbox}
          onKeyDown={handleKeyDown}
          role="dialog"
          aria-modal="true"
          aria-label={GALLERY_IMAGES[lightboxIdx].alt}
          tabIndex={0}
        >
          <div className="relative flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
            {/* Placeholder in lightbox */}
            <div className="w-[80vw] max-w-[700px] aspect-[4/3] bg-[var(--frog-forest)] rounded-lg flex flex-col items-center justify-center gap-3 border border-[rgba(82,183,136,0.2)]">
              <Camera className="h-16 w-16 text-[var(--frog-moss)] opacity-30" aria-hidden="true" />
              <p className="text-[var(--frog-lily)] text-center px-8">
                {GALLERY_IMAGES[lightboxIdx].alt}
              </p>
            </div>
            <button
              type="button"
              className="absolute -top-3 -right-3 rounded-full bg-[var(--frog-forest)] border border-[rgba(82,183,136,0.3)] p-2 text-[var(--frog-lily)] hover:text-[var(--frog-mist)] transition-colors"
              onClick={closeLightbox}
              aria-label="Close lightbox"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
