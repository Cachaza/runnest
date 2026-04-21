import { expo } from '@better-auth/expo'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { betterAuth } from 'better-auth'
import { organization } from 'better-auth/plugins'

import { db, schema } from '@apprunners/db'

import { communityAc, communityRoles } from './community-auth.js'
import { env } from './env.js'

export const auth = betterAuth({
  baseURL: env.betterAuthUrl,
  basePath: '/api/auth',
  database: drizzleAdapter(db, {
    camelCase: true,
    provider: 'pg',
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    organization({
      ac: communityAc,
      allowUserToCreateOrganization: true,
      roles: communityRoles,
    }),
    expo(),
  ],
  secret: env.betterAuthSecret,
  trustedOrigins: [`${env.mobileScheme}://`, env.corsOrigin],
})
