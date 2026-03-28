/** A2A SDK stub — not used in local mode. */
export class A2AClient {
  constructor(_config: any) {}
  async sendTask(_params: any): Promise<any> { return {} }
  async getTask(_id: string): Promise<any> { return {} }
}
export class A2AServer {
  constructor(_config: any) {}
  start(): void {}
}

export interface AgentCapabilities {
  streaming?: boolean
  pushNotifications?: boolean
  stateTransitionHistory?: boolean
}
export interface AgentSkill {
  id: string
  name: string
  description?: string
  tags?: string[]
  examples?: string[]
}
export interface Artifact {
  name?: string
  description?: string
  parts: any[]
  index?: number
  append?: boolean
  lastChunk?: boolean
}
export interface Message {
  role: string
  parts: any[]
  metadata?: Record<string, any>
}
export type TaskState = 'submitted' | 'working' | 'input-required' | 'completed' | 'canceled' | 'failed' | 'unknown'
