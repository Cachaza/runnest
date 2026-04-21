import 'dotenv/config'

import { z } from 'zod'

const envSchema = z.object({
  PORT: z.coerce.number().default(8787),
  DATABASE_URL: z.string().min(1).default('postgres://apprunners:apprunners@localhost:5433/apprunners'),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url().default('http://localhost:8787'),
  CORS_ORIGIN: z.string().default('http://localhost:8081'),
  MOBILE_SCHEME: z.string().min(1).default('apprunners'),
})

const parsedEnv = envSchema.parse(process.env)

export const env = {
  port: parsedEnv.PORT,
  databaseUrl: parsedEnv.DATABASE_URL,
  betterAuthSecret: parsedEnv.BETTER_AUTH_SECRET,
  betterAuthUrl: parsedEnv.BETTER_AUTH_URL,
  corsOrigin: parsedEnv.CORS_ORIGIN,
  mobileScheme: parsedEnv.MOBILE_SCHEME,
}
