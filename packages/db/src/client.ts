import { config } from 'dotenv'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

import * as schema from './schema/index.js'

config({ path: '../../apps/api/.env' })

const connectionString =
  process.env.DATABASE_URL ?? 'postgres://apprunners:apprunners@localhost:5433/apprunners'

export const pool = new Pool({
  connectionString,
})

export const db = drizzle(pool, {
  schema,
})

export { schema }
