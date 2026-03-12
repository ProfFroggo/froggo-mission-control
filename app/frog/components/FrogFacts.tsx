// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import type { ReactNode } from 'react';

interface Fact {
  label: string;
  content: ReactNode;
}

const facts: Fact[] = [
  {
    label: 'Fun Fact',
    content: <>Frogs drink water through their skin. They have a special patch on their belly called a &ldquo;drinking patch&rdquo; that absorbs moisture like a tiny sponge.</>,
  },
  {
    label: 'Did You Know',
    content: <>A group of frogs is called an <strong>army</strong>. An army of frogs working together, kind of like our agent squad.</>,
  },
  {
    label: 'Frog Wisdom',
    content: <>The glass frog has translucent skin so you can see its beating heart. Transparency is always a good look.</>,
  },
  {
    label: 'Wild Stat',
    content: <>The smallest frog in the world is <strong>Paedophryne amauensis</strong> at just 7.7mm long. Proof that small things can be mighty.</>,
  },
  {
    label: 'Garden Lore',
    content: <>In Japanese folklore, frogs symbolize <strong>safe return</strong>. The word for frog (kaeru) also means &ldquo;to return home.&rdquo;</>,
  },
  {
    label: 'Cool Science',
    content: <>Some frogs can freeze solid in winter and thaw out in spring, perfectly alive. The ultimate resilience.</>,
  },
];

export default function FrogFacts() {
  return (
    <section className="facts-section">
      <h2 className="section-title">Things frogs want you to know</h2>
      <div className="facts-grid">
        {facts.map((fact) => (
          <div key={fact.label} className="fact-card">
            <span className="fact-label">{fact.label}</span>
            <p className="fact-text">{fact.content}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
