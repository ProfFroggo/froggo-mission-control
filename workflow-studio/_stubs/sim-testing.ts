/** @sim/testing stub — test utilities not used in production builds. */
export function createTestContext(_config?: any): any {
  return {}
}
export function mockBlock(_type: string, _overrides?: any): any {
  return { id: 'mock-block', type: _type }
}
export function mockWorkflow(_overrides?: any): any {
  return { id: 'mock-workflow', blocks: [] }
}
export function createTestRunner(_config?: any): any {
  return { run: async () => ({}) }
}
export function expectBlock(_block: any): any {
  return { toHaveOutput: () => true, toHaveRun: () => true }
}
