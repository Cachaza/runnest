import * as Linking from 'expo-linking'

export const supportedProtectedDeepLinkPaths = ['community-access'] as const

export function protectedHrefFromIncomingUrl(url: string | null | undefined) {
  if (!url) {
    return null
  }

  const parsed = Linking.parse(url)
  const path = parsed.path?.replace(/^\/+/, '') ?? ''

  switch (path) {
    case 'community-access': {
      const code = typeof parsed.queryParams?.code === 'string' ? parsed.queryParams.code : null

      return code
        ? (`/community-access?code=${encodeURIComponent(code)}` as const)
        : ('/community-access' as const)
    }
    default:
      return null
  }
}
