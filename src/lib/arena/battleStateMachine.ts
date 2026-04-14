// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import type { BattleStatus } from '@/types/arena';

/**
 * Battle state machine — pure functions for validating Arena battle transitions.
 *
 * State diagram:
 *   created → matching → active → settling → settled → resolved
 *                     ↘ cancelled    ↗ disputed → resolved
 */

const VALID_TRANSITIONS: Record<BattleStatus, BattleStatus[]> = {
  created:   ['matching'],
  matching:  ['active', 'cancelled'],
  active:    ['settling', 'cancelled'],
  settling:  ['settled', 'disputed'],
  settled:   ['resolved'],
  disputed:  ['resolved'],
  resolved:  [],
  cancelled: [],
};

export function validateBattleTransition(from: BattleStatus, to: BattleStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getNextBattleStates(current: BattleStatus): BattleStatus[] {
  return VALID_TRANSITIONS[current] ?? [];
}

export function isTerminalState(status: BattleStatus): boolean {
  return status === 'resolved' || status === 'cancelled';
}

export { VALID_TRANSITIONS };
