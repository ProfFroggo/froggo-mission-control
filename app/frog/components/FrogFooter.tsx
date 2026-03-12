// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.

export default function FrogFooter() {
  return (
    <footer className="frog-footer">
      <div className="footer-frogs">
        <div className="footer-frog-hop">
          <TinyFrogSvg color="#8fbc8f" />
        </div>
        <div className="footer-frog-hop">
          <TinyFrogSvg color="#6aaa6a" />
        </div>
        <div className="footer-frog-hop">
          <TinyFrogSvg color="#7ab87a" />
        </div>
      </div>
      <p className="footer-tagline">
        Ribbit. Ribbit. Ship it.
      </p>
      <p style={{ marginTop: '0.25rem' }}>
        Made with mushrooms, warm tea, and a whole lot of vibes
      </p>
      <p style={{ marginTop: '1rem', fontSize: '0.8rem', opacity: 0.6 }}>
        Froggo.pro -- where agents feel at home
      </p>
    </footer>
  );
}

function TinyFrogSvg({ color }: { color: string }) {
  return (
    <svg width="28" height="24" viewBox="0 0 28 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <ellipse cx="14" cy="16" rx="10" ry="7" fill={color} />
      <circle cx="9" cy="9" r="4" fill={color} />
      <circle cx="19" cy="9" r="4" fill={color} />
      <circle cx="9" cy="8.5" r="2.5" fill="white" />
      <circle cx="19" cy="8.5" r="2.5" fill="white" />
      <circle cx="9.8" cy="8" r="1.3" fill="#2d3a2d" />
      <circle cx="19.8" cy="8" r="1.3" fill="#2d3a2d" />
      <path d="M11 18 Q14 21 17 18" stroke="#4a8a4a" strokeWidth="1.2" strokeLinecap="round" fill="none" />
    </svg>
  );
}
