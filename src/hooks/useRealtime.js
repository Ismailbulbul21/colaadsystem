import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

/**
 * Dashboards must be live. Rather than polling, we listen to Postgres changes
 * and invalidate the affected React Query caches, which re-fetches only what
 * actually changed. When Registration saves a client, the ALT counter moves
 * within milliseconds and nobody presses refresh.
 */
export function useRealtime(table, queryKeys = [], { event = '*', filter } = {}) {
  const queryClient = useQueryClient()
  const keysRef = useRef(queryKeys)
  keysRef.current = queryKeys

  useEffect(() => {
    // The topic MUST be unique per subscription. Supabase caches channels by
    // topic, so two hooks watching the same table — or StrictMode mounting the
    // same hook twice — would hand back an already-subscribed channel, and
    // calling .on() after subscribe() throws.
    const topic = `olod:${table}:${Math.random().toString(36).slice(2, 10)}`

    const channel = supabase
      .channel(topic)
      .on(
        'postgres_changes',
        { event, schema: 'public', table, ...(filter ? { filter } : {}) },
        () => {
          for (const key of keysRef.current) {
            queryClient.invalidateQueries({ queryKey: key })
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [table, event, filter, queryClient])
}

/**
 * The workflow table every dashboard cares about. Notifications are handled
 * separately by NotificationProvider, so they are deliberately not subscribed
 * here — one websocket channel per table is enough.
 */
export function useWorkflowRealtime(queryKeys = []) {
  useRealtime('clients', queryKeys)
}
