import { expoClient } from '@better-auth/expo/client'
import * as SecureStore from 'expo-secure-store'
import { createAuthClient } from 'better-auth/react'
import { Platform } from 'react-native'

const defaultApiBaseUrl = Platform.select({
  android: 'http://10.0.2.2:8787',
  default: 'http://localhost:8787',
})

export const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_URL ?? defaultApiBaseUrl ?? 'http://localhost:8787'

export const authClient = createAuthClient({
  baseURL: apiBaseUrl,
  plugins: [
    expoClient({
      scheme: 'apprunners',
      storage: SecureStore,
      storagePrefix: 'apprunners',
    }),
  ],
})
