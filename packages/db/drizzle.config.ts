import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

config({ path: '../../apps/api/.env' })

export default defineConfig({
  out: './drizzle',
  schema: './dist/schema/index.js',
  dialect: 'postgresql',
  tablesFilter: [
    'user',
    'session',
    'account',
    'verification',
    'profiles',
    'crews',
    'meetups',
    'meetup_rsvps',
  ],
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://apprunners:apprunners@localhost:5433/apprunners',
  },
})
