import { db } from '@apprunners/db'

import { auth } from '../lib/auth.js'

export async function createTRPCContext(headers: Headers) {
  const session = await auth.api.getSession({ headers })

  return {
    db,
    headers,
    user: session?.user ?? null,
    session: session?.session ?? null,
  }
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>
