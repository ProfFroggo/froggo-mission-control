// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Shared in-memory store for session-scoped tool grants.
 * Grants cleared on server restart. For permanent grants, use the DB settings table.
 */
type G = typeof globalThis & { _sessionToolGrants?: Map<string, Set<string>> };
export const sessionToolGrants: Map<string, Set<string>> = (globalThis as G)._sessionToolGrants
  ?? ((globalThis as G)._sessionToolGrants = new Map());
