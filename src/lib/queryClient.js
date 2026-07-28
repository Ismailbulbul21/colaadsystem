import { QueryClient } from '@tanstack/react-query'
import { friendlyError } from '../utils/errors'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Office network can be slow; do not hammer it on every focus change.
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        const message = error?.message || ''
        // Permission problems will never succeed on retry
        if (/permission|row-level security|insufficient/i.test(message)) return false
        return failureCount < 2
      },
      staleTime: 30_000,
      gcTime: 5 * 60_000,
    },
    mutations: {
      retry: 0,
      onError: (error) => {
        // Individual mutations may override this; it is only a safety net.
        console.warn('[mutation]', friendlyError(error))
      },
    },
  },
})

/** Data that almost never changes can be cached far more aggressively. */
export const LONG_CACHE = { staleTime: 60 * 60_000, gcTime: 2 * 60 * 60_000 }
/** Dashboard counters should feel live but still be cheap. */
export const DASHBOARD_CACHE = { staleTime: 15_000, gcTime: 60_000 }

export const qk = {
  profile: ['profile'],
  officeSettings: ['office-settings'],
  services: (params) => ['services', params ?? {}],
  serviceFields: (serviceId) => ['service-fields', serviceId],
  employees: (params) => ['employees', params ?? {}],
  clients: (params) => ['clients', params ?? {}],
  client: (id) => ['client', id],
  clientDetails: (id) => ['client-details', id],
  clientTimeline: (id) => ['client-timeline', id],
  documents: (params) => ['documents', params ?? {}],
  clientDocuments: (id) => ['client-documents', id],
  discounts: (params) => ['discounts', params ?? {}],
  payments: (params) => ['payments', params ?? {}],
  receipts: (params) => ['receipts', params ?? {}],
  invoices: (params) => ['invoices', params ?? {}],
  expenses: (params) => ['expenses', params ?? {}],
  expenseCategories: ['expense-categories'],
  logs: (params) => ['logs', params ?? {}],
  notifications: ['notifications'],
  stats: (role) => ['stats', role],
  report: (name, params) => ['report', name, params ?? {}],
}
