// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.

export default function VibeSection() {
  return (
    <section className="vibe-section">
      {/* Fireflies */}
      <div className="firefly" />
      <div className="firefly" />
      <div className="firefly" />
      <div className="firefly" />
      <div className="firefly" />

      <p className="vibe-quote">
        &ldquo;In the garden of productivity, every task is a lily pad.&rdquo;
      </p>
      <div className="vibe-scene">
        <PondScene />
      </div>
    </section>
  );
}

function PondScene() {
  return (
    <svg
      width="100%"
      height="180"
      viewBox="0 0 800 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="A peaceful pond scene with lily pads and reeds"
      style={{ maxWidth: '800px' }}
    >
      {/* Water */}
      <rect x="0" y="40" width="800" height="140" rx="8" fill="#b8d4c8" opacity="0.35" />

      {/* Subtle water lines */}
      <path d="M0 80 Q100 75, 200 80 Q300 85, 400 80 Q500 75, 600 80 Q700 85, 800 80" stroke="#7aab9a" strokeWidth="1" opacity="0.3" fill="none" />
      <path d="M0 110 Q120 105, 240 110 Q360 115, 480 110 Q600 105, 720 110 Q780 112, 800 110" stroke="#7aab9a" strokeWidth="1" opacity="0.2" fill="none" />
      <path d="M0 140 Q80 138, 160 140 Q300 144, 440 140 Q560 136, 700 140 Q760 142, 800 140" stroke="#7aab9a" strokeWidth="1" opacity="0.15" fill="none" />

      {/* Lily pad 1 */}
      <ellipse cx="160" cy="100" rx="45" ry="14" fill="#8fbc8f" opacity="0.7" />
      <path d="M160 87 L152 100 L160 96" fill="#b8d4c8" opacity="0.4" />

      {/* Lily pad 2 */}
      <ellipse cx="420" cy="120" rx="38" ry="12" fill="#6aaa6a" opacity="0.6" />
      <path d="M420 109 L413 120 L420 117" fill="#b8d4c8" opacity="0.4" />

      {/* Lily pad 3 */}
      <ellipse cx="640" cy="90" rx="42" ry="13" fill="#8fbc8f" opacity="0.65" />
      <path d="M640 78 L633 90 L640 87" fill="#b8d4c8" opacity="0.4" />

      {/* Small flower on lily pad 1 */}
      <circle cx="175" cy="94" r="4" fill="#f5c6d0" />
      <circle cx="172" cy="91" r="3" fill="#f8d4dc" />
      <circle cx="178" cy="91" r="3" fill="#f8d4dc" />
      <circle cx="175" cy="93" r="2" fill="#f5e6a3" />

      {/* Small flower on lily pad 3 */}
      <circle cx="655" cy="84" r="3.5" fill="#f5c6d0" />
      <circle cx="652" cy="82" r="2.5" fill="#f8d4dc" />
      <circle cx="658" cy="82" r="2.5" fill="#f8d4dc" />
      <circle cx="655" cy="83" r="1.8" fill="#f5e6a3" />

      {/* Reeds on the left */}
      <line x1="40" y1="30" x2="40" y2="100" stroke="#6aaa6a" strokeWidth="2" opacity="0.5" />
      <ellipse cx="40" cy="28" rx="5" ry="10" fill="#8b6f47" opacity="0.4" />
      <line x1="55" y1="40" x2="55" y2="110" stroke="#6aaa6a" strokeWidth="1.5" opacity="0.4" />
      <ellipse cx="55" cy="38" rx="4" ry="8" fill="#8b6f47" opacity="0.35" />

      {/* Reeds on the right */}
      <line x1="750" y1="35" x2="750" y2="105" stroke="#6aaa6a" strokeWidth="2" opacity="0.5" />
      <ellipse cx="750" cy="33" rx="5" ry="10" fill="#8b6f47" opacity="0.4" />
      <line x1="770" y1="45" x2="770" y2="115" stroke="#6aaa6a" strokeWidth="1.5" opacity="0.4" />
      <ellipse cx="770" cy="43" rx="4" ry="8" fill="#8b6f47" opacity="0.35" />

      {/* Dragonfly */}
      <g opacity="0.5">
        <ellipse cx="320" cy="50" rx="6" ry="2" fill="#7aab9a" />
        <line x1="314" y1="48" x2="308" y2="42" stroke="#b8d4c8" strokeWidth="1" />
        <line x1="326" y1="48" x2="332" y2="42" stroke="#b8d4c8" strokeWidth="1" />
        <line x1="314" y1="52" x2="310" y2="56" stroke="#b8d4c8" strokeWidth="1" />
        <line x1="326" y1="52" x2="330" y2="56" stroke="#b8d4c8" strokeWidth="1" />
      </g>

      {/* Small frog on lily pad 2 */}
      <ellipse cx="420" cy="113" rx="8" ry="6" fill="#6aaa6a" />
      <circle cx="416" cy="108" r="2.5" fill="white" />
      <circle cx="424" cy="108" r="2.5" fill="white" />
      <circle cx="417" cy="108" r="1.2" fill="#2d3a2d" />
      <circle cx="425" cy="108" r="1.2" fill="#2d3a2d" />
    </svg>
  );
}
