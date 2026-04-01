/**
 * Pub/sub channel stub — stripped during Sim Studio fork.
 */

export interface PubSubChannel<T = any> {
  publish(event: T): void
  subscribe(handler: (event: T) => void): () => void
}

export function createPubSubChannel<T = any>(): PubSubChannel<T> {
  const listeners = new Set<(event: T) => void>()
  return {
    publish(event: T) {
      for (const fn of listeners) {
        try {
          fn(event)
        } catch {}
      }
    },
    subscribe(handler: (event: T) => void) {
      listeners.add(handler)
      return () => {
        listeners.delete(handler)
      }
    },
  }
}
