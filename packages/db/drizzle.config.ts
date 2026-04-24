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
    'organization',
    'member',
    'invitation',
    'profiles',
    'communities',
    'community_blocks',
    'community_join_requests',
    'community_access_links',
    'community_access_link_claims',
    'community_user_invites',
    'meetups',
    'meetup_messages',
    'meetup_rsvps',
    'user_push_devices',
    'notification_deliveries',
  ],
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://apprunners:apprunners@localhost:5433/apprunners',
  },
})
