'use client';

import { useState } from 'react';
import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import {
  Bot,
  Puzzle,
  BookOpen,
  Download,
  Star,
  Zap,
  Search,
} from 'lucide-react';

type CatalogType = 'all' | 'agent' | 'module' | 'knowledge';

interface CatalogItem {
  id: string;
  name: string;
  description: string;
  type: 'agent' | 'module' | 'knowledge';
  price: string;
  rating: number;
  installs: string;
  author: string;
}

const catalog: CatalogItem[] = [
  {
    id: '1',
    name: 'Research Agent',
    description:
      'Autonomous web research agent that synthesizes findings into structured reports with citations.',
    type: 'agent',
    price: 'Free',
    rating: 4.8,
    installs: '2.4k',
    author: 'Froggo Labs',
  },
  {
    id: '2',
    name: 'Code Review Agent',
    description:
      'Reviews pull requests, suggests improvements, and catches bugs before they ship.',
    type: 'agent',
    price: '$9/mo',
    rating: 4.6,
    installs: '1.8k',
    author: 'DevTools Co',
  },
  {
    id: '3',
    name: 'Social Media Agent',
    description:
      'Creates, schedules, and optimizes social content across X, LinkedIn, and Instagram.',
    type: 'agent',
    price: '$14/mo',
    rating: 4.3,
    installs: '920',
    author: 'GrowthKit',
  },
  {
    id: '4',
    name: 'Slack Integration',
    description:
      'Connect your agents to Slack channels. Receive notifications and issue commands via Slack.',
    type: 'module',
    price: 'Free',
    rating: 4.9,
    installs: '5.1k',
    author: 'Froggo Labs',
  },
  {
    id: '5',
    name: 'GitHub Connector',
    description:
      'Sync repos, manage issues, and trigger workflows from your agents.',
    type: 'module',
    price: 'Free',
    rating: 4.7,
    installs: '3.2k',
    author: 'Froggo Labs',
  },
  {
    id: '6',
    name: 'Vector Memory Store',
    description:
      'High-performance vector database module for semantic search and long-term agent memory.',
    type: 'module',
    price: '$5/mo',
    rating: 4.5,
    installs: '1.1k',
    author: 'MemoryAI',
  },
  {
    id: '7',
    name: 'Web3 & Crypto Pack',
    description:
      'Token prices, on-chain analytics, DeFi protocols, and blockchain fundamentals.',
    type: 'knowledge',
    price: '$7/mo',
    rating: 4.4,
    installs: '780',
    author: 'ChainData',
  },
  {
    id: '8',
    name: 'Legal Compliance Pack',
    description:
      'SOC2, GDPR, HIPAA frameworks and compliance checklists for agent operations.',
    type: 'knowledge',
    price: '$12/mo',
    rating: 4.2,
    installs: '430',
    author: 'ComplianceAI',
  },
  {
    id: '9',
    name: 'Startup Playbook',
    description:
      'Growth strategies, fundraising templates, and operational best practices for startups.',
    type: 'knowledge',
    price: 'Free',
    rating: 4.6,
    installs: '2.0k',
    author: 'Froggo Labs',
  },
];

const typeFilters: { label: string; value: CatalogType; icon: typeof Bot }[] = [
  { label: 'All', value: 'all', icon: Zap },
  { label: 'Agents', value: 'agent', icon: Bot },
  { label: 'Modules', value: 'module', icon: Puzzle },
  { label: 'Knowledge', value: 'knowledge', icon: BookOpen },
];

const typeBadge: Record<string, string> = {
  agent: 'bg-blue-500/10 text-blue-400',
  module: 'bg-purple-500/10 text-purple-400',
  knowledge: 'bg-amber-500/10 text-amber-400',
};

export default function MarketplacePage() {
  const [filter, setFilter] = useState<CatalogType>('all');

  const filtered =
    filter === 'all' ? catalog : catalog.filter((i) => i.type === filter);

  return (
    <div className="min-h-screen bg-surface">
      {/* Top bar */}
      <header className="border-b border-border-subtle bg-surface-raised">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-froggo-green" />
              <span className="font-bold">Froggo</span>
            </Link>
            <nav className="flex items-center gap-1">
              <Link
                href="/dashboard"
                className="rounded-md px-3 py-1.5 text-sm text-text-muted hover:text-white"
              >
                Dashboard
              </Link>
              <Link
                href="/marketplace"
                className="rounded-md px-3 py-1.5 text-sm font-medium text-white"
              >
                Marketplace
              </Link>
              <Link
                href="/settings"
                className="rounded-md px-3 py-1.5 text-sm text-text-muted hover:text-white"
              >
                Settings
              </Link>
            </nav>
          </div>
          <UserButton />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="mb-1 text-2xl font-bold">Marketplace</h1>
            <p className="text-sm text-text-muted">
              Browse agents, modules, and knowledge packs
            </p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search marketplace..."
              className="rounded-lg border border-border-subtle bg-surface-raised py-2 pl-9 pr-4 text-sm text-white placeholder:text-text-muted focus:border-froggo-green/50 focus:outline-none"
            />
          </div>
        </div>

        {/* Type filters */}
        <div className="mb-6 flex items-center gap-2">
          {typeFilters.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setFilter(tf.value)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                filter === tf.value
                  ? 'bg-froggo-green/10 text-froggo-green'
                  : 'text-text-muted hover:text-white'
              }`}
            >
              <tf.icon className="h-3.5 w-3.5" />
              {tf.label}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="flex flex-col rounded-xl border border-border-subtle bg-surface-raised p-5"
            >
              <div className="mb-3 flex items-start justify-between">
                <span
                  className={`rounded-md px-2 py-0.5 text-xs font-medium capitalize ${typeBadge[item.type]}`}
                >
                  {item.type}
                </span>
                <div className="flex items-center gap-1 text-xs text-text-muted">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  {item.rating}
                </div>
              </div>
              <h3 className="mb-1 font-semibold">{item.name}</h3>
              <p className="mb-4 flex-1 text-sm leading-relaxed text-text-muted">
                {item.description}
              </p>
              <div className="flex items-center justify-between">
                <div className="text-xs text-text-muted">
                  <span>{item.author}</span>
                  <span className="mx-1.5">·</span>
                  <span>{item.installs} installs</span>
                </div>
                <button className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle px-3 py-1.5 text-xs font-medium hover:border-froggo-green/30 hover:text-froggo-green">
                  <Download className="h-3 w-3" />
                  {item.price === 'Free' ? 'Install' : item.price}
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
