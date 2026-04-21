import { expoClient } from '@better-auth/expo/client'
import * as SecureStore from 'expo-secure-store'
import { organizationClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'
import { Platform } from 'react-native'

import { communityAc, communityRoles } from './community-auth'

const defaultApiBaseUrl = Platform.select({
  android: 'http://10.0.2.2:8787',
  default: 'http://localhost:8787',
})

export const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_URL ?? defaultApiBaseUrl ?? 'http://localhost:8787'

export const authClient = createAuthClient({
  baseURL: apiBaseUrl,
  plugins: [
    organizationClient({
      ac: communityAc,
      roles: communityRoles,
    }),
    expoClient({
      scheme: 'apprunners',
      storage: SecureStore,
      storagePrefix: 'apprunners',
    }),
  ],
})
