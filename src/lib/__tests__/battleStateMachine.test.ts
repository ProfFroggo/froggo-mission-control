// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Battle state machine unit tests
 *
 * Covers:
 *   - Every valid transition passes
 *   - Invalid transitions are rejected
 *   - Terminal states have no next states
 *   - getNextBattleStates returns correct options
 *   - isTerminalState correctly identifies resolved/cancelled
 */
import { describe, it, expect } from 'vitest';
import {
  validateBattleTransition,
  getNextBattleStates,
  isTerminalState,
  VALID_TRANSITIONS,
} from '@/lib/arena/battleStateMachine';
import type { BattleStatus } from '@/types/arena';

const ALL_STATUSES: BattleStatus[] = [
  'created', 'matching', 'active', 'settling',
  'settled', 'disputed', 'resolved', 'cancelled',
];

describe('battleStateMachine', () => {
  describe('validateBattleTransition', () => {
    const validCases: [BattleStatus, BattleStatus][] = [
      ['created', 'matching'],
      ['matching', 'active'],
      ['matching', 'cancelled'],
      ['active', 'settling'],
      ['active', 'cancelled'],
      ['settling', 'settled'],
      ['settling', 'disputed'],
      ['settled', 'resolved'],
      ['disputed', 'resolved'],
    ];

    it.each(validCases)('%s → %s is valid', (from, to) => {
      expect(validateBattleTransition(from, to)).toBe(true);
    });

    const invalidCases: [BattleStatus, BattleStatus][] = [
      ['created', 'active'],
      ['created', 'cancelled'],
      ['created', 'resolved'],
      ['matching', 'settling'],
      ['matching', 'resolved'],
      ['active', 'matching'],
      ['active', 'resolved'],
      ['settling', 'active'],
      ['settling', 'cancelled'],
      ['settled', 'active'],
      ['settled', 'cancelled'],
      ['resolved', 'created'],
      ['resolved', 'matching'],
      ['cancelled', 'created'],
      ['cancelled', 'matching'],
    ];

    it.each(invalidCases)('%s → %s is invalid', (from, to) => {
      expect(validateBattleTransition(from, to)).toBe(false);
    });
  });

  describe('getNextBattleStates', () => {
    it('created can only go to matching', () => {
      expect(getNextBattleStates('created')).toEqual(['matching']);
    });

    it('matching can go to active or cancelled', () => {
      expect(getNextBattleStates('matching')).toEqual(['active', 'cancelled']);
    });

    it('settling can go to settled or disputed', () => {
      expect(getNextBattleStates('settling')).toEqual(['settled', 'disputed']);
    });

    it('terminal states have no next states', () => {
      expect(getNextBattleStates('resolved')).toEqual([]);
      expect(getNextBattleStates('cancelled')).toEqual([]);
    });
  });

  describe('isTerminalState', () => {
    it('resolved is terminal', () => {
      expect(isTerminalState('resolved')).toBe(true);
    });

    it('cancelled is terminal', () => {
      expect(isTerminalState('cancelled')).toBe(true);
    });

    const nonTerminal: BattleStatus[] = ['created', 'matching', 'active', 'settling', 'settled', 'disputed'];
    it.each(nonTerminal)('%s is not terminal', (status) => {
      expect(isTerminalState(status)).toBe(false);
    });
  });

  describe('VALID_TRANSITIONS completeness', () => {
    it('every status has an entry in the transitions map', () => {
      for (const status of ALL_STATUSES) {
        expect(VALID_TRANSITIONS).toHaveProperty(status);
      }
    });

    it('all target states are valid BattleStatus values', () => {
      for (const [, targets] of Object.entries(VALID_TRANSITIONS)) {
        for (const target of targets) {
          expect(ALL_STATUSES).toContain(target);
        }
      }
    });
  });
});
