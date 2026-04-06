'use client';

import { useState } from 'react';
import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import {
  Zap,
  Key,
  CreditCard,
  Users,
  Eye,
  EyeOff,
  Copy,
  Plus,
  Trash2,
  ArrowUpRight,
} from 'lucide-react';

export default function SettingsPage() {
  const [showKey, setShowKey] = useState(false);
  const [apiKey, setApiKey] = useState('sk-ant-••••••••••••••••••••');

  const teamMembers = [
    { email: 'kevin@froggo.pro', role: 'Owner', status: 'Active' },
    { email: 'clara@froggo.pro', role: 'Admin', status: 'Active' },
    { email: 'derek@froggo.pro', role: 'Member', status: 'Pending' },
  ];

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
                className="rounded-md px-3 py-1.5 text-sm text-text-muted hover:text-white"
              >
                Marketplace
              </Link>
              <Link
                href="/settings"
                className="rounded-md px-3 py-1.5 text-sm font-medium text-white"
              >
                Settings
              </Link>
            </nav>
          </div>
          <UserButton />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="mb-8 text-2xl font-bold">Settings</h1>

        {/* API Keys */}
        <section className="mb-8 rounded-xl border border-border-subtle bg-surface-raised p-6">
          <div className="mb-5 flex items-center gap-2">
            <Key className="h-5 w-5 text-froggo-green" />
            <h2 className="text-lg font-semibold">API Keys</h2>
          </div>
          <div className="mb-4">
            <label className="mb-1.5 block text-sm text-text-muted">
              Anthropic API Key
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className="w-full rounded-lg border border-border-subtle bg-surface py-2 pl-3 pr-10 text-sm text-white placeholder:text-text-muted focus:border-froggo-green/50 focus:outline-none"
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-white"
                >
                  {showKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <button className="rounded-lg border border-border-subtle px-3 text-text-muted hover:text-white">
                <Copy className="h-4 w-4" />
              </button>
              <button className="rounded-lg bg-froggo-green px-4 py-2 text-sm font-medium text-black hover:bg-froggo-green-light">
                Save
              </button>
            </div>
            <p className="mt-2 text-xs text-text-muted">
              Your API key is encrypted at rest and never shared with third
              parties.
            </p>
          </div>
        </section>

        {/* Billing */}
        <section className="mb-8 rounded-xl border border-border-subtle bg-surface-raised p-6">
          <div className="mb-5 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-froggo-green" />
            <h2 className="text-lg font-semibold">Billing</h2>
          </div>
          <div className="mb-4 flex items-center justify-between rounded-lg border border-border-subtle bg-surface p-4">
            <div>
              <p className="text-sm font-medium">Current Plan</p>
              <p className="text-2xl font-bold text-froggo-green">Pro</p>
              <p className="text-xs text-text-muted">$29/month, renews Apr 15</p>
            </div>
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle px-4 py-2 text-sm font-medium text-text-muted hover:border-froggo-green/30 hover:text-froggo-green">
              Upgrade to Team
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border border-border-subtle bg-surface p-3">
              <p className="text-xs text-text-muted">Messages Used</p>
              <p className="text-lg font-semibold">12,847</p>
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-surface-overlay">
                <div
                  className="h-full rounded-full bg-froggo-green"
                  style={{ width: '25.7%' }}
                />
              </div>
              <p className="mt-1 text-xs text-text-muted">of 50,000</p>
            </div>
            <div className="rounded-lg border border-border-subtle bg-surface p-3">
              <p className="text-xs text-text-muted">Agents</p>
              <p className="text-lg font-semibold">3 / 5</p>
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-surface-overlay">
                <div
                  className="h-full rounded-full bg-froggo-green"
                  style={{ width: '60%' }}
                />
              </div>
              <p className="mt-1 text-xs text-text-muted">slots used</p>
            </div>
            <div className="rounded-lg border border-border-subtle bg-surface p-3">
              <p className="text-xs text-text-muted">Storage</p>
              <p className="text-lg font-semibold">245 MB</p>
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-surface-overlay">
                <div
                  className="h-full rounded-full bg-froggo-green"
                  style={{ width: '24%' }}
                />
              </div>
              <p className="mt-1 text-xs text-text-muted">of 1 GB</p>
            </div>
          </div>
        </section>

        {/* Team */}
        <section className="rounded-xl border border-border-subtle bg-surface-raised p-6">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-froggo-green" />
              <h2 className="text-lg font-semibold">Team Members</h2>
            </div>
            <button className="inline-flex items-center gap-1.5 rounded-lg bg-froggo-green px-3 py-1.5 text-sm font-medium text-black hover:bg-froggo-green-light">
              <Plus className="h-3.5 w-3.5" />
              Invite
            </button>
          </div>
          <div className="mb-4 flex gap-2">
            <input
              type="email"
              placeholder="teammate@company.com"
              className="flex-1 rounded-lg border border-border-subtle bg-surface py-2 pl-3 pr-3 text-sm text-white placeholder:text-text-muted focus:border-froggo-green/50 focus:outline-none"
            />
            <button className="rounded-lg border border-border-subtle px-4 py-2 text-sm font-medium text-text-muted hover:border-froggo-green/30 hover:text-froggo-green">
              Send Invite
            </button>
          </div>
          <div className="divide-y divide-border-subtle">
            {teamMembers.map((member) => (
              <div
                key={member.email}
                className="flex items-center justify-between py-3"
              >
                <div>
                  <p className="text-sm font-medium">{member.email}</p>
                  <p className="text-xs text-text-muted">{member.role}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      member.status === 'Active'
                        ? 'bg-froggo-green/10 text-froggo-green'
                        : 'bg-amber-400/10 text-amber-400'
                    }`}
                  >
                    {member.status}
                  </span>
                  {member.role !== 'Owner' && (
                    <button className="text-text-muted hover:text-red-400">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
