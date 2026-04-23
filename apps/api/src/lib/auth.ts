import { expo } from '@better-auth/expo'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { betterAuth } from 'better-auth'
import { organization } from 'better-auth/plugins'

import { db, schema } from '@apprunners/db'

import { communityAc, communityRoles } from './community-auth.js'
import { sendTransactionalEmail } from './email.js'
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
    sendResetPassword: async ({ user, url }) => {
      const safeUrl = new URL(url)
      const appRedirectUrl = new URL('/auth/reset-password', env.betterAuthUrl)
      const token = safeUrl.searchParams.get('token')
      const error = safeUrl.searchParams.get('error')

      if (token) {
        appRedirectUrl.searchParams.set('token', token)
      }

      if (error) {
        appRedirectUrl.searchParams.set('error', error)
      }

      await sendTransactionalEmail({
        to: user.email,
        subject: 'Recupera tu contraseña de AppRunners',
        text: `Abre este enlace para recuperar tu contraseña: ${appRedirectUrl.toString()}`,
        html: `<p>Abre este enlace para recuperar tu contraseña:</p><p><a href="${appRedirectUrl.toString()}">${appRedirectUrl.toString()}</a></p>`,
      })
    },
    onPasswordReset: async ({ user }) => {
      console.log(`[auth] password reset completed for ${user.email}`)
    },
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
