// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.

export interface CampaignMember {
  campaignId: string;
  agentId: string;
  role: string;
  addedAt: number;
  agentName?: string;
  agentEmoji?: string;
  agentStatus?: string;
}

export interface CampaignAsset {
  id: string;
  campaignId: string;
  filePath: string;
  fileName: string;
  assetType: 'image' | 'video' | 'copy' | 'brief' | 'report' | 'other';
  channel?: string;
  status: 'draft' | 'approved' | 'live' | 'archived';
  createdBy?: string;
  createdAt: number;
}

export interface KpiEntry {
  target: number;
  actual: number;
}

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  type: string;
  goal?: string;
  status: string;
  channels: string[];
  budget?: number;
  budgetSpent: number;
  currency: string;
  targetAudience?: string;
  kpis: Record<string, KpiEntry>;
  startDate?: number;
  endDate?: number;
  briefContent?: string;
  color: string;
  createdBy?: string;
  createdAt: number;
  updatedAt: number;
  members?: CampaignMember[];
  assets?: CampaignAsset[];
  // Computed stats from list query
  memberCount?: number;
  totalTasks?: number;
  doneTasks?: number;
  inProgressTasks?: number;
  lastTaskActivity?: number;
}
