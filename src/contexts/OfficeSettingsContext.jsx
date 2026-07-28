import { createContext, useContext, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { qk, LONG_CACHE } from '../lib/queryClient'

const OfficeSettingsContext = createContext(null)

const FALLBACK = {
  office_name: 'Colaad Public Notary Office',
  currency: 'USD',
  currency_symbol: '$',
  date_format: 'DD/MM/YYYY',
  timezone: 'Africa/Mogadishu',
  receipt_footer: 'Thank you for your business.',
}

/**
 * Office settings change perhaps twice a year but are needed on almost every
 * screen (logo, currency symbol, receipt text), so they are fetched once and
 * cached for an hour rather than re-queried per page.
 */
export function OfficeSettingsProvider({ children }) {
  const { data, isLoading } = useQuery({
    queryKey: qk.officeSettings,
    queryFn: async () => {
      const { data, error } = await supabase.from('office_settings').select('*').limit(1).maybeSingle()
      if (error) throw error
      return data ?? FALLBACK
    },
    ...LONG_CACHE,
  })

  const value = useMemo(() => {
    const settings = data ?? FALLBACK
    return {
      settings,
      isLoading,
      currency: settings.currency_symbol || '$',
      money: (amount) =>
        `${settings.currency_symbol || '$'}${Number(amount ?? 0).toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
    }
  }, [data, isLoading])

  return (
    <OfficeSettingsContext.Provider value={value}>{children}</OfficeSettingsContext.Provider>
  )
}

export function useOfficeSettings() {
  const ctx = useContext(OfficeSettingsContext)
  if (!ctx) throw new Error('useOfficeSettings must be used inside <OfficeSettingsProvider>')
  return ctx
}
