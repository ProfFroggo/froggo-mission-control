// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.

const wisdoms = [
  {
    quote: 'Be like water: patient, persistent, and always finding the path of least resistance.',
    attribution: 'Ancient Pond Proverb',
    accent: WaterDropletSvg,
  },
  {
    quote: 'The loudest ribbit in the pond is not always the wisest, but it is always the bravest.',
    attribution: 'Froggo\'s Field Guide',
    accent: LilyFlowerSvg,
  },
  {
    quote: 'Every tadpole becomes a frog. Growth is not optional, it is inevitable.',
    attribution: 'The Marsh Philosopher',
    accent: SproutSvg,
  },
];

export default function FrogWisdom() {
  return (
    <section className="wisdom-section">
      <h2 className="section-title">Wisdom from the pond</h2>
      <div className="wisdom-grid">
        {wisdoms.map((w) => (
          <div key={w.attribution} className="wisdom-card">
            <div className="wisdom-card-accent">
              <w.accent />
            </div>
            <blockquote>&ldquo;{w.quote}&rdquo;</blockquote>
            <cite>-- {w.attribution}</cite>
          </div>
        ))}
      </div>
    </section>
  );
}

function WaterDropletSvg() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M8 2 C8 2, 3 8, 3 10.5 C3 13.5 5.5 15 8 15 C10.5 15 13 13.5 13 10.5 C13 8 8 2 8 2Z" fill="#7aab9a" opacity="0.7" />
    </svg>
  );
}

function LilyFlowerSvg() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="8" cy="8" r="4" fill="#f5c6d0" />
      <circle cx="5" cy="6" r="3" fill="#f8d4dc" />
      <circle cx="11" cy="6" r="3" fill="#f8d4dc" />
      <circle cx="8" cy="8" r="2" fill="#f5e6a3" />
    </svg>
  );
}

function SproutSvg() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M8 14 L8 7" stroke="#6aaa6a" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8 9 C5 6 3 7 4 10" stroke="#6aaa6a" strokeWidth="1" fill="#8fbc8f" opacity="0.8" />
      <path d="M8 7 C11 4 13 5 12 8" stroke="#6aaa6a" strokeWidth="1" fill="#8fbc8f" opacity="0.8" />
    </svg>
  );
}
