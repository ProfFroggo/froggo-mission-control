/** Trigger.dev stub — not used in local mode. */
export function task(_config: any): any { return () => {} }
export function configure(_config: any): void {}
export const tasks = { trigger: async () => ({}) }
export const runs = {
  list: async (_opts?: any): Promise<any> => ({ data: [] }),
  retrieve: async (_id: string): Promise<any> => ({}),
}
