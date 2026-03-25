'use client';

// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect, useCallback } from 'react';
import { Button, TextField, Flex, Box } from '@radix-ui/themes';
import {
  Megaphone, Plus, Search, RefreshCw, AlertCircle, LayoutGrid, List
} from 'lucide-react';
import { campaignsApi } from '../../lib/api';
import type { Campaign } from '../../types/campaigns';
import { Spinner } from '../LoadingStates';
import { showToast } from '../Toast';
import CampaignCard from './CampaignCard';
import CampaignCreationWizard from './CampaignCreationWizard';
import CampaignWorkspace from './CampaignWorkspace';

const TYPE_FILTERS = [
  { value: '', label: 'All Types' },
  { value: 'paid', label: 'Paid' },
  { value: 'organic', label: 'Organic' },
  { value: 'social', label: 'Social' },
  { value: 'email', label: 'Email / CLM' },
  { value: 'content', label: 'Content' },
  { value: 'pr', label: 'PR' },
  { value: 'seo', label: 'SEO' },
  { value: 'influencer', label: 'Influencer' },
];

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'live', label: 'Live' },
  { value: 'planning', label: 'Planning' },
  { value: 'draft', label: 'Draft' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
];

function EmptyCampaigns({ onNew }: { onNew: () => void }) {
  return (
    <Flex direction="column" align="center" justify="center" py="9" className="flex-1 text-center">
      <Flex align="center" justify="center" mb="4" className="w-16 h-16 rounded-2xl bg-mission-control-surface border border-mission-control-border">
        <Megaphone size={28} className="text-mission-control-text-dim" />
      </Flex>
      <h3 className="text-lg font-semibold text-mission-control-text mb-2">No campaigns yet</h3>
      <p className="text-sm text-mission-control-text-dim max-w-xs mb-6">
        Create a campaign to plan, track and measure your marketing efforts across all channels.
      </p>
      <Button
        onClick={onNew}
        size="2"
        variant="solid"
      >
        <Plus size={16} /> Create your first campaign
      </Button>
    </Flex>
  );
}

export default function CampaignsPanel() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const data = await campaignsApi.list(statusFilter || undefined, typeFilter || undefined) as { campaigns: Campaign[] };
      setCampaigns(data.campaigns ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load campaigns');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => { load(); }, [load]);

  const filtered = campaigns.filter(c => {
    // Hide archived from "All" — only show when explicitly filtering by archived
    if (!statusFilter && c.status === 'archived') return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.description ?? '').toLowerCase().includes(q) ||
      (c.goal ?? '').toLowerCase().includes(q) ||
      (c.targetAudience ?? '').toLowerCase().includes(q)
    );
  });

  const liveCount = campaigns.filter(c => c.status === 'live').length;
  const planningCount = campaigns.filter(c => c.status === 'planning').length;

  const handleCampaignCreated = (campaign: Campaign) => {
    setShowCreateWizard(false);
    load(false);
    showToast(`Campaign "${campaign.name}" created!`, 'success');
    setSelectedCampaign(campaign);
  };

  if (selectedCampaign) {
    return (
      <CampaignWorkspace
        campaign={selectedCampaign}
        onBack={() => { setSelectedCampaign(null); load(false); }}
        onUpdated={() => load(false)}
      />
    );
  }

  return (
    <Flex direction="column" height="100%" className="bg-mission-control-surface">
      {/* Header */}
      <Flex align="center" justify="between" px="4" py="3" className="border-b border-mission-control-border bg-mission-control-surface">
        <Flex align="center" gap="3">
          <Box p="2" className="bg-mission-control-accent/20 rounded-lg">
            <Megaphone size={24} className="text-mission-control-accent" />
          </Box>
          <div>
            <h1 className="text-xl font-semibold text-mission-control-text">Campaigns</h1>
            <p className="text-sm text-mission-control-text-dim">
              {liveCount > 0 ? `${liveCount} live` : ''}
              {liveCount > 0 && planningCount > 0 ? ' · ' : ''}
              {planningCount > 0 ? `${planningCount} planning` : ''}
              {liveCount === 0 && planningCount === 0 ? `${campaigns.filter(c => c.status !== 'archived').length} campaigns` : ''}
            </p>
          </div>
        </Flex>
        <Flex align="center" gap="2">
          <button
            type="button"
            onClick={() => load(false)}
            disabled={refreshing}
            title="Refresh"
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <div className="flex items-center rounded-lg border border-mission-control-border overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              title="Grid view"
              className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-mission-control-accent/10 text-mission-control-accent' : 'text-mission-control-text-dim hover:text-mission-control-text'}`}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              title="List view"
              className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-mission-control-accent/10 text-mission-control-accent' : 'text-mission-control-text-dim hover:text-mission-control-text'}`}
            >
              <List size={14} />
            </button>
          </div>
          <Button
            onClick={() => setShowCreateWizard(true)}
            size="2"
            variant="solid"
          >
            <Plus size={15} /> New Campaign
          </Button>
        </Flex>
      </Flex>

      {/* Filters */}
      <Flex direction="column" gap="2" px="4" py="3" className="border-b border-mission-control-border">
        {/* Search + status segment */}
        <Flex align="center" gap="3">
          <Box className="flex-1 max-w-xs">
            <TextField.Root
              aria-label="Search campaigns"
              placeholder="Search campaigns..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              size="2"
            >
              <TextField.Slot>
                <Search size={14} />
              </TextField.Slot>
            </TextField.Root>
          </Box>
          <div className="flex items-center border border-mission-control-border rounded-lg overflow-hidden">
            {STATUS_FILTERS.map(f => (
              <button
                key={f.value}
                type="button"
                onClick={() => setStatusFilter(f.value)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  statusFilter === f.value
                    ? 'bg-mission-control-accent/10 text-mission-control-accent'
                    : 'text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/30'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </Flex>

        {/* Type filters */}
        <div className="flex items-center flex-wrap gap-1.5">
          {TYPE_FILTERS.map(f => (
            <button
              key={f.value}
              type="button"
              onClick={() => setTypeFilter(f.value)}
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                typeFilter === f.value
                  ? 'bg-mission-control-accent/10 border-mission-control-accent/30 text-mission-control-accent'
                  : 'border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text hover:border-mission-control-accent/30'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </Flex>

      {/* Content */}
      <Box px="4" py="4" className="flex-1 overflow-y-auto">
        {loading && (
          <Flex align="center" justify="center" py="9">
            <Spinner size={24} />
          </Flex>
        )}

        {error && !loading && (
          <Flex align="center" gap="2" px="4" py="3" className="bg-[var(--color-error)]/10 border border-[var(--color-error)]/30 rounded-lg text-[var(--color-error)] text-sm">
            <AlertCircle size={15} />
            {error}
          </Flex>
        )}

        {!loading && !error && filtered.length === 0 && (
          search || statusFilter || typeFilter ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search size={32} className="text-mission-control-text-dim mb-3 opacity-50" />
              <p className="text-sm font-medium text-mission-control-text-dim">No campaigns match your filters</p>
              <p className="text-xs text-mission-control-text-dim mt-1 opacity-70">Try adjusting your search or filter criteria</p>
            </div>
          ) : (
            <EmptyCampaigns onNew={() => setShowCreateWizard(true)} />
          )
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'
              : 'flex flex-col gap-3'
          }>
            {filtered.map(c => (
              <CampaignCard
                key={c.id}
                campaign={c}
                onClick={() => setSelectedCampaign(c)}
                onArchive={async () => {
                  if (!confirm(`Archive "${c.name}"?`)) return;
                  try {
                    await campaignsApi.update(c.id, { status: 'archived' });
                    load();
                    showToast('Campaign archived', 'success');
                  } catch { showToast('Archive failed', 'error'); }
                }}
                viewMode={viewMode}
              />
            ))}
          </div>
        )}
      </Box>

      {/* Create wizard */}
      {showCreateWizard && (
        <CampaignCreationWizard
          onClose={() => setShowCreateWizard(false)}
          onCreated={handleCampaignCreated}
        />
      )}
    </Flex>
  );
}
