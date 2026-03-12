// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import ShareButton from './ShareButton';

export default function FrogHero() {
  return (
    <section className="hero-section">
      {/* Dappled sunlight overlay */}
      <div className="dappled-light" />

      {/* Floating leaves */}
      <FloatingLeaves />

      {/* Frog on lily pad */}
      <div className="frog-bounce" style={{ position: 'relative', zIndex: 1 }}>
        <FrogOnLilyPad />
      </div>

      {/* Title */}
      <h1 className="hero-title" style={{ position: 'relative', zIndex: 1 }}>
        Froggo
      </h1>

      <p className="hero-subtitle" style={{ position: 'relative', zIndex: 1, marginBottom: '2rem' }}>
        Your cozy little AI command center
      </p>

      {/* Share CTA */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <ShareButton />
      </div>

      {/* Pond ripples at bottom */}
      <div className="pond-ripple">
        <div className="ripple-ring" />
        <div className="ripple-ring" />
        <div className="ripple-ring" />
      </div>
    </section>
  );
}

/* ── Inline SVG: Frog sitting on a lily pad ── */
function FrogOnLilyPad() {
  return (
    <svg width="220" height="200" viewBox="0 0 220 200" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="A cute frog sitting on a lily pad">
      {/* Lily pad */}
      <ellipse cx="110" cy="168" rx="90" ry="24" fill="#6aaa6a" opacity="0.7" />
      <ellipse cx="110" cy="165" rx="85" ry="22" fill="#8fbc8f" />
      {/* Lily pad vein lines */}
      <path d="M110 145 L110 185" stroke="#6aaa6a" strokeWidth="1.5" opacity="0.4" />
      <path d="M110 165 L80 150" stroke="#6aaa6a" strokeWidth="1" opacity="0.3" />
      <path d="M110 165 L140 150" stroke="#6aaa6a" strokeWidth="1" opacity="0.3" />
      <path d="M110 165 L75 175" stroke="#6aaa6a" strokeWidth="1" opacity="0.3" />
      <path d="M110 165 L145 175" stroke="#6aaa6a" strokeWidth="1" opacity="0.3" />
      {/* Lily pad notch */}
      <path d="M110 143 L100 165 L110 160" fill="#b8d4c8" opacity="0.5" />

      {/* Frog body */}
      <ellipse cx="110" cy="130" rx="38" ry="32" fill="#6aaa6a" />
      {/* Belly */}
      <ellipse cx="110" cy="138" rx="26" ry="20" fill="#d4e8c4" />

      {/* Head */}
      <ellipse cx="110" cy="95" rx="34" ry="28" fill="#6aaa6a" />

      {/* Eye bumps */}
      <circle cx="90" cy="78" r="14" fill="#6aaa6a" />
      <circle cx="130" cy="78" r="14" fill="#6aaa6a" />

      {/* Eyes - white */}
      <circle cx="90" cy="76" r="10" fill="white" />
      <circle cx="130" cy="76" r="10" fill="white" />

      {/* Pupils + shine (blink group) */}
      <g className="frog-blink-lid">
        <circle cx="92" cy="75" r="5" fill="#2d3a2d" />
        <circle cx="132" cy="75" r="5" fill="#2d3a2d" />
        <circle cx="94" cy="73" r="2" fill="white" />
        <circle cx="134" cy="73" r="2" fill="white" />
      </g>

      {/* Smile */}
      <path d="M95 100 Q110 112 125 100" stroke="#4a8a4a" strokeWidth="2.5" strokeLinecap="round" fill="none" />

      {/* Blush cheeks */}
      <circle cx="82" cy="97" r="6" fill="#f4a0a0" opacity="0.35" />
      <circle cx="138" cy="97" r="6" fill="#f4a0a0" opacity="0.35" />

      {/* Front legs */}
      <ellipse cx="80" cy="155" rx="12" ry="8" fill="#6aaa6a" transform="rotate(-10 80 155)" />
      <ellipse cx="140" cy="155" rx="12" ry="8" fill="#6aaa6a" transform="rotate(10 140 155)" />

      {/* Toes */}
      <circle cx="68" cy="156" r="3.5" fill="#5a9a5a" />
      <circle cx="74" cy="160" r="3.5" fill="#5a9a5a" />
      <circle cx="80" cy="162" r="3.5" fill="#5a9a5a" />
      <circle cx="140" cy="162" r="3.5" fill="#5a9a5a" />
      <circle cx="146" cy="160" r="3.5" fill="#5a9a5a" />
      <circle cx="152" cy="156" r="3.5" fill="#5a9a5a" />

      {/* Small flower on lily pad */}
      <circle cx="160" cy="158" r="5" fill="#f5c6d0" />
      <circle cx="156" cy="155" r="4" fill="#f8d4dc" />
      <circle cx="164" cy="155" r="4" fill="#f8d4dc" />
      <circle cx="160" cy="152" r="4" fill="#f8d4dc" />
      <circle cx="160" cy="157" r="2.5" fill="#f5e6a3" />
    </svg>
  );
}

/* ── Floating leaf SVGs ── */
function FloatingLeaves() {
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="floating-leaf" style={{ top: '-40px' }}>
          <svg width="24" height="28" viewBox="0 0 24 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M12 2 C6 8, 2 16, 12 26 C22 16, 18 8, 12 2Z"
              fill={i % 2 === 0 ? '#8fbc8f' : '#6aaa6a'}
              opacity="0.7"
            />
            <path d="M12 6 L12 22" stroke="#5a9a5a" strokeWidth="0.8" opacity="0.5" />
          </svg>
        </div>
      ))}
    </>
  );
}
