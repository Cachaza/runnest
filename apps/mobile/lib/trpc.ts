import { QueryClient } from '@tanstack/react-query'
import { createTRPCReact } from '@trpc/react-query'
import { httpBatchLink } from '@trpc/client'
import { Platform } from 'react-native'

import { apiBaseUrl, authClient } from './auth-client'
import type { AppRouter } from '../../api/src/trpc/router'

export const trpc = createTRPCReact<AppRouter>()

export const queryClient = new QueryClient()

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${apiBaseUrl}/trpc`,
      headers() {
        if (Platform.OS === 'web') {
          return {}
        }

        const cookie = authClient.getCookie()

        return cookie ? { cookie } : {}
      },
      fetch(url, options) {
        return fetch(url, {
          ...options,
          credentials: 'include',
        })
      },
    }),
  ],
})
