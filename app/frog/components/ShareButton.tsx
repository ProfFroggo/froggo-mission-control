// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
'use client';

import { useState, useCallback } from 'react';

export default function ShareButton() {
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    const shareData = {
      title: 'Froggo - Your Cozy AI Command Center',
      text: 'Check out Froggo, the coziest AI agent platform around!',
      url: typeof window !== 'undefined' ? window.location.href : 'https://froggo.pro',
    };

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // User cancelled or share failed, fall through to clipboard
      }
    }

    // Clipboard fallback
    try {
      await navigator.clipboard.writeText(shareData.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Final fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = shareData.url;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }, []);

  return (
    <button
      onClick={handleShare}
      className={`share-button ${copied ? 'share-button-copied' : ''}`}
      aria-label={copied ? 'Link copied to clipboard' : 'Share this page'}
    >
      {copied ? (
        <>
          <CheckSvg />
          Copied!
        </>
      ) : (
        <>
          <ShareSvg />
          Share the vibes
        </>
      )}
    </button>
  );
}

function ShareSvg() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function CheckSvg() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
