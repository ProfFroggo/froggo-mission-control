// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.

export type BattleMode = '1v1' | 'tournament' | 'free-for-all';

export type BattleStatus =
  | 'created'
  | 'matching'
  | 'active'
  | 'settling'
  | 'settled'
  | 'disputed'
  | 'resolved'
  | 'cancelled';

export type PositionSide = 'long' | 'short';
export type PositionStatus = 'open' | 'closed';
export type PayoutStatus = 'pending' | 'paid' | 'failed';

export interface BattleParticipant {
  id: string;
  displayName: string;
  joinedAt: number;
}

export interface Battle {
  id: string;
  mode: BattleMode;
  status: BattleStatus;
  stakeAmount: number;
  stakeCurrency: string;
  duration: number;
  maxParticipants: number;
  createdBy: string;
  participants: BattleParticipant[];
  winnerId: string | null;
  startedAt: number | null;
  endedAt: number | null;
  settledAt: number | null;
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface PaperPosition {
  id: string;
  battleId: string;
  participantId: string;
  tokenMint: string;
  side: PositionSide;
  quantity: number;
  entryPrice: number;
  exitPrice: number | null;
  pnl: number | null;
  status: PositionStatus;
  openedAt: number;
  closedAt: number | null;
}

export interface LeaderboardEntry {
  participantId: string;
  displayName: string | null;
  totalBattles: number;
  wins: number;
  losses: number;
  draws: number;
  totalPnl: number;
  winStreak: number;
  bestStreak: number;
  maxDrawdown: number;
  rankScore: number;
  rank: number | null;
  updatedAt: number;
}

export interface ArenaSettlement {
  id: string;
  battleId: string;
  participantId: string;
  finalPnl: number;
  payout: number;
  payoutStatus: PayoutStatus;
  settledAt: number;
}
