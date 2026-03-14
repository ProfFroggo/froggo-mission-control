'use client';

// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect, useCallback } from 'react';
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
];

function EmptyCampaigns({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 text-center py-16">
      <div className="w-16 h-16 rounded-2xl bg-mission-control-surface border border-mission-control-border flex items-center justify-center mb-4">
        <Megaphone size={28} className="text-mission-control-text-dim" />
      </div>
      <h3 className="text-lg font-semibold text-mission-control-text-primary mb-2">No campaigns yet</h3>
      <p className="text-sm text-mission-control-text-dim max-w-xs mb-6">
        Create a campaign to plan, track and measure your marketing efforts across all channels.
      </p>
      <button
        onClick={onNew}
        className="flex items-center gap-2 px-4 py-2 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent/90 transition-colors text-sm font-medium"
      >
        <Plus size={16} /> Create your first campaign
      </button>
    </div>
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
    <div className="flex flex-col h-full bg-mission-control-bg0">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-mission-control-border bg-mission-control-surface">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-mission-control-accent/20 rounded-xl">
            <Megaphone size={24} className="text-mission-control-accent" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-mission-control-text">Campaigns</h1>
            <p className="text-sm text-mission-control-text-dim">
              {liveCount > 0 ? `${liveCount} live` : ''}
              {liveCount > 0 && planningCount > 0 ? ' · ' : ''}
              {planningCount > 0 ? `${planningCount} planning` : ''}
              {liveCount === 0 && planningCount === 0 ? `${campaigns.filter(c => c.status !== 'archived').length} campaigns` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => load(false)}
            disabled={refreshing}
            className="p-2 rounded-lg text-mission-control-text-dim hover:text-mission-control-text-primary hover:bg-mission-control-surface transition-colors"
            title="Refresh"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <div className="flex items-center rounded-lg border border-mission-control-border overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 transition-colors ${viewMode === 'grid' ? 'bg-mission-control-accent text-white' : 'text-mission-control-text-dim hover:text-mission-control-text-primary hover:bg-mission-control-surface'}`}
              title="Grid view"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 transition-colors ${viewMode === 'list' ? 'bg-mission-control-accent text-white' : 'text-mission-control-text-dim hover:text-mission-control-text-primary hover:bg-mission-control-surface'}`}
              title="List view"
            >
              <List size={14} />
            </button>
          </div>
          <button
            onClick={() => setShowCreateWizard(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent/90 transition-colors text-sm font-medium"
          >
            <Plus size={15} /> New Campaign
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 px-6 py-3 border-b border-mission-control-border">
        {/* Search + status tabs */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mission-control-text-dim" />
            <input
              type="text"
              placeholder="Search campaigns..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-mission-control-surface border border-mission-control-border rounded-lg text-mission-control-text-primary placeholder-mission-control-text-dim focus:outline-none focus:border-mission-control-accent/50"
            />
          </div>
          <div className="flex items-center gap-1">
            {STATUS_FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  statusFilter === f.value
                    ? 'bg-mission-control-accent text-white'
                    : 'text-mission-control-text-dim hover:text-mission-control-text-primary hover:bg-mission-control-surface'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Type filters */}
        <div className="flex items-center gap-1 flex-wrap">
          {TYPE_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setTypeFilter(f.value)}
              className={`px-2.5 py-0.5 text-xs rounded-full transition-colors border ${
                typeFilter === f.value
                  ? 'bg-mission-control-accent/20 text-mission-control-accent border-mission-control-accent/40'
                  : 'text-mission-control-text-dim border-mission-control-border hover:text-mission-control-text-primary hover:bg-mission-control-surface'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Spinner size={24} />
          </div>
        )}

        {error && !loading && (
          <div className="flex items-center gap-2 px-4 py-3 bg-error-subtle border border-error/30 rounded-lg text-error text-sm">
            <AlertCircle size={15} />
            {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          search || statusFilter || typeFilter ? (
            <div className="text-center py-16 text-mission-control-text-dim text-sm">
              No campaigns matching your filters
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
                viewMode={viewMode}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create wizard */}
      {showCreateWizard && (
        <CampaignCreationWizard
          onClose={() => setShowCreateWizard(false)}
          onCreated={handleCampaignCreated}
        />
      )}
    </div>
  );
}
