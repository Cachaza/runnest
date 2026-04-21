import { expo } from '@better-auth/expo'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { betterAuth } from 'better-auth'

import { db, schema } from '@apprunners/db'

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
  plugins: [expo()],
  secret: env.betterAuthSecret,
  trustedOrigins: [`${env.mobileScheme}://`, env.corsOrigin],
})
