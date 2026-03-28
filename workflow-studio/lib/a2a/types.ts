/**
 * A2A protocol types stub — stripped during Sim Studio fork.
 */

export interface AgentAuthentication {
  schemes: string[]
  credentials?: any
}

export interface AgentCapabilities {
  streaming?: boolean
  pushNotifications?: boolean
  stateTransitionHistory?: boolean
  [key: string]: any
}
