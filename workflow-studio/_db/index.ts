import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

export * from './schema'
export * from './triggers'

const connectionString = process.env.DATABASE_URL

let db: ReturnType<typeof drizzle>

if (connectionString) {
  const postgresClient = postgres(connectionString, {
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 30,
    max: 10,
    onnotice: () => {},
  })
  db = drizzle(postgresClient, { schema })
} else {
  // Stub for build-time / local mode without a database
  db = new Proxy({} as any, {
    get: (_target, prop) => {
      if (prop === 'select' || prop === 'insert' || prop === 'update' || prop === 'delete' || prop === 'query') {
        return new Proxy(() => {}, {
          get: () => () => new Proxy(() => {}, { get: () => () => Promise.resolve([]) }),
          apply: () => new Proxy({}, { get: () => () => Promise.resolve([]) }),
        })
      }
      return undefined
    },
  })
}

export { db }

// SQLite local-mode database (standalone, no drizzle dependency)
export { sqliteDb } from './sqlite'
export type { WorkflowRow, ExecutionRow, CredentialRow, EnvironmentRow } from './sqlite'
