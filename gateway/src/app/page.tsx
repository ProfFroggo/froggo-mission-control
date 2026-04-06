import Link from 'next/link';
import { Bot, Store, Brain, Zap, ArrowRight, Check } from 'lucide-react';

const features = [
  {
    icon: Bot,
    title: 'Multi-Agent Orchestration',
    description:
      'Deploy and manage multiple AI agents from a single command center. Coordinate tasks, share context, and scale your workforce.',
  },
  {
    icon: Store,
    title: 'Agent Marketplace',
    description:
      'Browse and install pre-built agents, modules, and knowledge packs. Extend your platform in one click.',
  },
  {
    icon: Brain,
    title: 'Shared Knowledge',
    description:
      'Persistent memory and knowledge graphs that all your agents can access. Build institutional knowledge over time.',
  },
];

const tiers = [
  {
    name: 'Free',
    price: '$0',
    period: '/mo',
    description: 'Get started with AI agents',
    features: [
      '1 agent instance',
      '1,000 messages/month',
      'Community marketplace',
      'Basic knowledge store',
    ],
    cta: 'Get Started',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$29',
    period: '/mo',
    description: 'For power users and creators',
    features: [
      '5 agent instances',
      '50,000 messages/month',
      'Full marketplace access',
      'Advanced knowledge graphs',
      'Custom agent creation',
      'Priority support',
    ],
    cta: 'Start Pro Trial',
    highlighted: true,
  },
  {
    name: 'Team',
    price: '$99',
    period: '/mo',
    description: 'Collaborate with your team',
    features: [
      'Unlimited agents',
      'Unlimited messages',
      'Private marketplace',
      'Shared team knowledge',
      'SSO & audit logs',
      'Dedicated support',
      'Custom integrations',
    ],
    cta: 'Contact Sales',
    highlighted: false,
  },
];

export default function LandingPage() {
  return (
    <div className="relative">
      {/* Nav */}
      <nav className="fixed top-0 z-50 w-full border-b border-border-subtle bg-surface/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-froggo-green" />
            <span className="text-lg font-bold">Froggo</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/sign-in"
              className="text-sm text-text-muted hover:text-white"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="rounded-lg bg-froggo-green px-4 py-2 text-sm font-medium text-black hover:bg-froggo-green-light"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-6 pt-16 text-center">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(34,197,94,0.08)_0%,_transparent_70%)]" />
        <div className="relative z-10 max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-froggo-green/20 bg-froggo-green/5 px-4 py-1.5 text-sm text-froggo-green">
            <Zap className="h-3.5 w-3.5" />
            Now in public beta
          </div>
          <h1 className="mb-6 text-5xl font-bold leading-tight tracking-tight sm:text-6xl">
            Your AI Agent
            <br />
            <span className="text-froggo-green">Command Center</span>
          </h1>
          <p className="mx-auto mb-10 max-w-xl text-lg text-text-muted">
            Deploy, orchestrate, and manage AI agents from one platform.
            Built for builders who want full control over their AI workforce.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 rounded-lg bg-froggo-green px-6 py-3 text-sm font-semibold text-black hover:bg-froggo-green-light"
            >
              Start Building
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="#features"
              className="rounded-lg border border-border-subtle px-6 py-3 text-sm font-medium text-text-muted hover:border-white/20 hover:text-white"
            >
              Learn More
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold">
            Everything you need to run AI agents
          </h2>
          <p className="text-text-muted">
            A complete platform for deploying and managing autonomous agents at
            scale.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-xl border border-border-subtle bg-surface-raised p-8 hover:border-froggo-green/30"
            >
              <div className="mb-4 inline-flex rounded-lg bg-froggo-green/10 p-3">
                <f.icon className="h-6 w-6 text-froggo-green" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">{f.title}</h3>
              <p className="text-sm leading-relaxed text-text-muted">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold">
            Simple, transparent pricing
          </h2>
          <p className="text-text-muted">
            Start free. Scale when you are ready.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative rounded-xl border p-8 ${
                tier.highlighted
                  ? 'border-froggo-green bg-froggo-green/5'
                  : 'border-border-subtle bg-surface-raised'
              }`}
            >
              {tier.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-froggo-green px-3 py-0.5 text-xs font-semibold text-black">
                  Popular
                </div>
              )}
              <h3 className="mb-1 text-lg font-semibold">{tier.name}</h3>
              <p className="mb-4 text-sm text-text-muted">
                {tier.description}
              </p>
              <div className="mb-6">
                <span className="text-4xl font-bold">{tier.price}</span>
                <span className="text-text-muted">{tier.period}</span>
              </div>
              <ul className="mb-8 space-y-3">
                {tier.features.map((feat) => (
                  <li key={feat} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 shrink-0 text-froggo-green" />
                    {feat}
                  </li>
                ))}
              </ul>
              <Link
                href="/sign-up"
                className={`block w-full rounded-lg py-2.5 text-center text-sm font-medium ${
                  tier.highlighted
                    ? 'bg-froggo-green text-black hover:bg-froggo-green-light'
                    : 'border border-border-subtle text-white hover:border-white/20'
                }`}
              >
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border-subtle py-12">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <Zap className="h-4 w-4 text-froggo-green" />
            Froggo Mission Control
          </div>
          <p className="text-sm text-text-muted">
            &copy; {new Date().getFullYear()} Froggo. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
