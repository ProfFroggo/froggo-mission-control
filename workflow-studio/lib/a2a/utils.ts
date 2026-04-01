/**
 * A2A utility functions stub — stripped during Sim Studio fork.
 */

const TERMINAL_STATES = new Set(['completed', 'failed', 'canceled', 'rejected'])

export function isTerminalState(state: string): boolean {
  return TERMINAL_STATES.has(state)
}
