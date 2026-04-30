import { serve } from '@hono/node-server'
import { trpcServer } from '@hono/trpc-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { z } from 'zod'

import { db, pool, waitlistSignups } from '@apprunners/db'

import { auth } from './lib/auth.js'
import { env } from './lib/env.js'
import { createTRPCContext } from './trpc/context.js'
import { appRouter } from './trpc/router.js'

type AppVariables = {
  user: typeof auth.$Infer.Session.user | null
  session: typeof auth.$Infer.Session.session | null
}

const app = new Hono<{ Variables: AppVariables }>()
const waitlistSignupSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  source: z.string().trim().min(1).max(80).default('landing'),
})

app.use('*', cors({
  origin: env.corsOrigins,
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
  credentials: true,
}))

app.use('*', async (c, next) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  })

  c.set('user', session?.user ?? null)
  c.set('session', session?.session ?? null)

  await next()
})

app.get('/', (c) => {
  return c.json({
    name: 'AppRunners API',
    status: 'ok',
    authBasePath: '/api/auth',
  })
})

app.get('/health', async (c) => {
  await pool.query('select 1')

  return c.json({
    status: 'ok',
    database: 'reachable',
  })
})

app.post('/api/waitlist', async (c) => {
  const body = await c.req.parseBody()
  const parsed = waitlistSignupSchema.safeParse({
    email: body.email,
    source: body.source ?? 'landing',
  })

  if (!parsed.success) {
    return c.json({
      ok: false,
      message: 'Introduce un correo válido.',
    }, 400)
  }

  const forwardedFor = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
  const userAgent = c.req.header('user-agent') ?? null
  const now = new Date()

  await db
    .insert(waitlistSignups)
    .values({
      email: parsed.data.email,
      ipAddress: forwardedFor || null,
      source: parsed.data.source,
      updatedAt: now,
      userAgent,
    })
    .onConflictDoUpdate({
      target: waitlistSignups.email,
      set: {
        source: parsed.data.source,
        updatedAt: now,
        userAgent,
      },
    })

  return c.json({
    ok: true,
    message: 'Te avisaremos cuando abramos el acceso.',
  })
})

app.get('/auth/reset-password', (c) => {
  const token = c.req.query('token')
  const error = c.req.query('error')
  const redirectUrl = new URL(`${env.mobileScheme}://reset-password`)

  if (token) {
    redirectUrl.searchParams.set('token', token)
  }

  if (error) {
    redirectUrl.searchParams.set('error', error)
  }

  return c.redirect(redirectUrl.toString(), 302)
})

app.use(
  '/trpc/*',
  trpcServer({
    endpoint: '/trpc',
    router: appRouter,
    createContext: (_, c) => createTRPCContext(c.req.raw.headers),
  }),
)

app.on(['GET', 'POST'], '/api/auth/*', (c) => {
  return auth.handler(c.req.raw)
})

app.get('/api/me', (c) => {
  const user = c.get('user')
  const session = c.get('session')

  if (!user || !session) {
    return c.json({
      authenticated: false,
    }, 401)
  }

  return c.json({
    authenticated: true,
    user,
    session,
  })
})

export type AppType = typeof app

serve({
  fetch: app.fetch,
  port: env.port,
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
