// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.

const features = [
  {
    title: 'Agent Squad',
    description: 'A cozy crew of AI agents working together in harmony, each with their own personality and specialty.',
    icon: AgentSquadIcon,
  },
  {
    title: 'Task Garden',
    description: 'Nurture your projects from seed to bloom. Watch tasks grow through your Kanban garden.',
    icon: TaskGardenIcon,
  },
  {
    title: 'Memory Mushrooms',
    description: 'Persistent, interconnected knowledge that grows in the background. Nothing is ever forgotten.',
    icon: MemoryMushroomIcon,
  },
  {
    title: 'Cozy Dashboard',
    description: 'Your peaceful command center. Everything you need, nothing you don\'t. Warm and inviting.',
    icon: CozyDashboardIcon,
  },
];

export default function FeatureCards() {
  return (
    <section className="features-section">
      <h2 className="section-title">What makes Froggo special</h2>
      <div className="features-grid">
        {features.map((feature) => (
          <div key={feature.title} className="feature-card">
            <div className="feature-icon">
              <feature.icon />
            </div>
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Feature Icon SVGs ── */

function AgentSquadIcon() {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Three small frogs in a circle */}
      {/* Frog 1 - center top */}
      <circle cx="36" cy="20" r="10" fill="#8fbc8f" />
      <circle cx="32" cy="17" r="3" fill="white" />
      <circle cx="40" cy="17" r="3" fill="white" />
      <circle cx="33" cy="17" r="1.5" fill="#2d3a2d" />
      <circle cx="41" cy="17" r="1.5" fill="#2d3a2d" />
      <path d="M32 24 Q36 28 40 24" stroke="#4a8a4a" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      {/* Frog 2 - bottom left */}
      <circle cx="20" cy="46" r="10" fill="#6aaa6a" />
      <circle cx="16" cy="43" r="3" fill="white" />
      <circle cx="24" cy="43" r="3" fill="white" />
      <circle cx="17" cy="43" r="1.5" fill="#2d3a2d" />
      <circle cx="25" cy="43" r="1.5" fill="#2d3a2d" />
      <path d="M16 50 Q20 54 24 50" stroke="#4a8a4a" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      {/* Frog 3 - bottom right */}
      <circle cx="52" cy="46" r="10" fill="#7ab87a" />
      <circle cx="48" cy="43" r="3" fill="white" />
      <circle cx="56" cy="43" r="3" fill="white" />
      <circle cx="49" cy="43" r="1.5" fill="#2d3a2d" />
      <circle cx="57" cy="43" r="1.5" fill="#2d3a2d" />
      <path d="M48 50 Q52 54 56 50" stroke="#4a8a4a" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      {/* Connection lines (subtle) */}
      <line x1="30" y1="28" x2="23" y2="38" stroke="#b8d4c8" strokeWidth="1.5" strokeDasharray="3 3" />
      <line x1="42" y1="28" x2="49" y2="38" stroke="#b8d4c8" strokeWidth="1.5" strokeDasharray="3 3" />
      <line x1="28" y1="50" x2="44" y2="50" stroke="#b8d4c8" strokeWidth="1.5" strokeDasharray="3 3" />
    </svg>
  );
}

function TaskGardenIcon() {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Soil */}
      <ellipse cx="36" cy="60" rx="28" ry="6" fill="#8b6f47" opacity="0.6" />
      {/* Stem */}
      <path d="M36 58 L36 28" stroke="#6aaa6a" strokeWidth="2.5" strokeLinecap="round" />
      {/* Leaves */}
      <path d="M36 45 C28 40, 22 44, 24 50" stroke="#6aaa6a" strokeWidth="2" fill="#8fbc8f" opacity="0.8" />
      <path d="M36 38 C44 33, 50 37, 48 43" stroke="#6aaa6a" strokeWidth="2" fill="#8fbc8f" opacity="0.8" />
      {/* Flower bloom */}
      <circle cx="36" cy="22" r="8" fill="#f5c6d0" />
      <circle cx="30" cy="18" r="6" fill="#f8d4dc" />
      <circle cx="42" cy="18" r="6" fill="#f8d4dc" />
      <circle cx="30" cy="26" r="6" fill="#f8d4dc" />
      <circle cx="42" cy="26" r="6" fill="#f8d4dc" />
      <circle cx="36" cy="22" r="4" fill="#f5e6a3" />
      {/* Sparkle */}
      <path d="M52 14 L54 10 L56 14 L54 18Z" fill="#f5e6a3" opacity="0.6" />
      <path d="M18 30 L20 26 L22 30 L20 34Z" fill="#f5e6a3" opacity="0.5" />
    </svg>
  );
}

function MemoryMushroomIcon() {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Ground */}
      <ellipse cx="36" cy="62" rx="24" ry="4" fill="#8b6f47" opacity="0.4" />
      {/* Large mushroom stem */}
      <rect x="30" y="40" width="12" height="20" rx="4" fill="#f5ede0" />
      {/* Large mushroom cap */}
      <path d="M16 42 Q16 22, 36 20 Q56 22, 56 42 Z" fill="#c4956a" />
      {/* Cap spots */}
      <circle cx="28" cy="30" r="4" fill="#f5ede0" opacity="0.7" />
      <circle cx="44" cy="32" r="3" fill="#f5ede0" opacity="0.7" />
      <circle cx="36" cy="26" r="3.5" fill="#f5ede0" opacity="0.7" />
      {/* Small mushroom */}
      <rect x="52" y="50" width="6" height="10" rx="2" fill="#f5ede0" />
      <path d="M48 52 Q48 44, 55 43 Q62 44, 62 52 Z" fill="#b8735a" />
      <circle cx="53" cy="47" r="2" fill="#f5ede0" opacity="0.7" />
      <circle cx="58" cy="48" r="1.5" fill="#f5ede0" opacity="0.7" />
      {/* Connection dots (memory network) */}
      <circle cx="36" cy="34" r="1.5" fill="#f5e6a3" opacity="0.8" />
      <circle cx="42" cy="38" r="1" fill="#f5e6a3" opacity="0.6" />
      <circle cx="30" cy="36" r="1" fill="#f5e6a3" opacity="0.6" />
    </svg>
  );
}

function CozyDashboardIcon() {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Window frame */}
      <rect x="10" y="12" width="52" height="42" rx="6" fill="#f5ede0" stroke="#8b6f47" strokeWidth="2" />
      {/* Window panes */}
      <line x1="36" y1="12" x2="36" y2="54" stroke="#8b6f47" strokeWidth="1.5" />
      <line x1="10" y1="33" x2="62" y2="33" stroke="#8b6f47" strokeWidth="1.5" />
      {/* Cozy scenes in panes */}
      {/* Top-left: sunset/nature */}
      <circle cx="20" cy="22" r="4" fill="#f5e6a3" opacity="0.7" />
      <path d="M12 30 L24 22 L34 30" stroke="#8fbc8f" strokeWidth="1.5" fill="#d4e8c4" opacity="0.5" />
      {/* Top-right: chart/progress */}
      <path d="M40 30 L46 24 L52 27 L58 20" stroke="#6aaa6a" strokeWidth="2" strokeLinecap="round" fill="none" />
      {/* Bottom-left: heart */}
      <path d="M18 42 C18 39, 22 38, 23 41 C24 38, 28 39, 28 42 C28 46, 23 49, 23 49 C23 49, 18 46, 18 42Z" fill="#f4a0a0" opacity="0.5" />
      {/* Bottom-right: checkmarks */}
      <path d="M42 41 L44 43 L48 39" stroke="#6aaa6a" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M42 47 L44 49 L48 45" stroke="#6aaa6a" strokeWidth="2" strokeLinecap="round" fill="none" />
      {/* Windowsill */}
      <rect x="6" y="52" width="60" height="5" rx="2" fill="#8b6f47" opacity="0.5" />
      {/* Plant on windowsill */}
      <circle cx="14" cy="52" r="4" fill="#8fbc8f" />
      <rect x="12" y="52" width="4" height="5" rx="1" fill="#c4956a" />
    </svg>
  );
}
