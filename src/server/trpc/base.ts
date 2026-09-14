import { initTRPC } from '@trpc/server'
import type { Kysely } from 'kysely'
import superjson from 'superjson'
import { createDb, type Database } from '#/server/db'

export type Context = { db: Kysely<Database> }

let db: Kysely<Database> | undefined

export function createContext(): Context {
  db ??= createDb()
  return { db }
}

// superjson keeps a Date a Date across the wire. Without it every date arrives
// as a string while TypeScript still claims it is a Date.
const t = initTRPC.context<Context>().create({ transformer: superjson })

export const router = t.router
export const publicProcedure = t.procedure
