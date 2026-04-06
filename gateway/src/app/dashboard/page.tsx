import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import {
  Play,
  Square,
  ExternalLink,
  Bot,
  ListChecks,
  HardDrive,
  Zap,
  Store,
  Settings,
} from 'lucide-react';

type WorkspaceStatus = 'running' | 'stopped' | 'creating';

const workspace: {
  status: WorkspaceStatus;
  subdomain: string;
  region: string;
  agents: number;
  tasks: number;
  storageUsedMb: number;
  storageLimitMb: number;
} = {
  status: 'running',
  subdomain: 'kevin',
  region: 'iad (Ashburn)',
  agents: 3,
  tasks: 12,
  storageUsedMb: 245,
  storageLimitMb: 1024,
};

const statusConfig: Record<
  WorkspaceStatus,
  { label: string; color: string; dot: string }
> = {
  running: {
    label: 'Running',
    color: 'text-froggo-green',
    dot: 'bg-froggo-green',
  },
  stopped: {
    label: 'Stopped',
    color: 'text-text-muted',
    dot: 'bg-text-muted',
  },
  creating: {
    label: 'Creating...',
    color: 'text-amber-400',
    dot: 'bg-amber-400',
  },
};

const stats = [
  { label: 'Active Agents', value: workspace.agents, icon: Bot },
  { label: 'Tasks Today', value: workspace.tasks, icon: ListChecks },
  {
    label: 'Storage',
    value: `${workspace.storageUsedMb} MB / ${workspace.storageLimitMb} MB`,
    icon: HardDrive,
  },
];

export default function DashboardPage() {
  const status = statusConfig[workspace.status];

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
                className="rounded-md px-3 py-1.5 text-sm font-medium text-white"
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
        <h1 className="mb-8 text-2xl font-bold">Workspace</h1>

        {/* Status card */}
        <div className="mb-8 rounded-xl border border-border-subtle bg-surface-raised p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${status.dot}`}
                />
                <span className={`text-sm font-medium ${status.color}`}>
                  {status.label}
                </span>
              </div>
              <h2 className="mb-1 text-lg font-semibold">
                {workspace.subdomain}.froggo.pro
              </h2>
              <p className="text-sm text-text-muted">
                Region: {workspace.region}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {workspace.status === 'running' ? (
                <>
                  <button className="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-4 py-2 text-sm text-text-muted hover:border-red-500/30 hover:text-red-400">
                    <Square className="h-3.5 w-3.5" />
                    Stop
                  </button>
                  <a
                    href={`https://${workspace.subdomain}.froggo.pro`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-froggo-green px-4 py-2 text-sm font-medium text-black hover:bg-froggo-green-light"
                  >
                    Open Mission Control
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </>
              ) : workspace.status === 'stopped' ? (
                <button className="inline-flex items-center gap-2 rounded-lg bg-froggo-green px-4 py-2 text-sm font-medium text-black hover:bg-froggo-green-light">
                  <Play className="h-3.5 w-3.5" />
                  Start Instance
                </button>
              ) : (
                <div className="flex items-center gap-2 text-sm text-amber-400">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                  Provisioning...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-border-subtle bg-surface-raised p-5"
            >
              <div className="mb-3 flex items-center gap-2 text-text-muted">
                <stat.icon className="h-4 w-4" />
                <span className="text-sm">{stat.label}</span>
              </div>
              <p className="text-xl font-semibold">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <h2 className="mb-4 text-lg font-semibold">Quick Actions</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Link
            href="/marketplace"
            className="group flex items-center gap-4 rounded-xl border border-border-subtle bg-surface-raised p-5 hover:border-froggo-green/30"
          >
            <div className="rounded-lg bg-froggo-green/10 p-2.5">
              <Store className="h-5 w-5 text-froggo-green" />
            </div>
            <div>
              <p className="text-sm font-medium group-hover:text-froggo-green">
                Browse Marketplace
              </p>
              <p className="text-xs text-text-muted">
                Install agents and modules
              </p>
            </div>
          </Link>
          <Link
            href="/settings"
            className="group flex items-center gap-4 rounded-xl border border-border-subtle bg-surface-raised p-5 hover:border-froggo-green/30"
          >
            <div className="rounded-lg bg-froggo-green/10 p-2.5">
              <Settings className="h-5 w-5 text-froggo-green" />
            </div>
            <div>
              <p className="text-sm font-medium group-hover:text-froggo-green">
                Account Settings
              </p>
              <p className="text-xs text-text-muted">
                API keys, billing, team
              </p>
            </div>
          </Link>
          <a
            href={`https://${workspace.subdomain}.froggo.pro`}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-4 rounded-xl border border-border-subtle bg-surface-raised p-5 hover:border-froggo-green/30"
          >
            <div className="rounded-lg bg-froggo-green/10 p-2.5">
              <Bot className="h-5 w-5 text-froggo-green" />
            </div>
            <div>
              <p className="text-sm font-medium group-hover:text-froggo-green">
                Manage Agents
              </p>
              <p className="text-xs text-text-muted">
                Open your Mission Control
              </p>
            </div>
          </a>
        </div>
      </main>
    </div>
  );
}
