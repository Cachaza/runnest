import type { PropsWithChildren } from 'react'

import { QueryClientProvider } from '@tanstack/react-query'

import { ThemePreferenceProvider } from '@/components/ThemeContext'
import { queryClient, trpc, trpcClient } from '@/lib/trpc'

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ThemePreferenceProvider>{children}</ThemePreferenceProvider>
      </QueryClientProvider>
    </trpc.Provider>
  )
}
