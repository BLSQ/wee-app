import pg from 'pg'

const RETRY_MS = 500

/**
 * Waits for the Postgres server, then creates the database named in `connectionString` if it is
 * missing. A container started a second ago refuses connections, and restarts once while it
 * initialises an empty volume: both look like a connection error, so both are retried.
 */
export async function ensureDatabase(
  connectionString: string,
  { timeoutMs = 30_000 }: { timeoutMs?: number } = {},
): Promise<'created' | 'exists'> {
  const url = new URL(connectionString)
  const name = url.pathname.slice(1)
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`Unexpected database name: ${name}`)
  // The maintenance database exists on every server, including a brand new one.
  url.pathname = '/postgres'

  const deadline = Date.now() + timeoutMs
  for (;;) {
    const client = new pg.Client({ connectionString: url.toString() })
    try {
      await client.connect()
      const { rowCount } = await client.query('select 1 from pg_database where datname = $1', [
        name,
      ])
      if (rowCount) return 'exists'
      await client.query(`create database ${name}`)
      return 'created'
    } catch (error) {
      if (Date.now() >= deadline) {
        throw new Error(
          `Postgres is not reachable at ${url.host}. Is it running? Try: docker compose up -d`,
          { cause: error },
        )
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_MS))
    } finally {
      await client.end().catch(() => {})
    }
  }
}
