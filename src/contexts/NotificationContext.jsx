import { createContext, useContext, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from './AuthContext'
import { useRealtime } from '../hooks/useRealtime'
import { qk } from '../lib/queryClient'

const NotificationContext = createContext(null)

export function NotificationProvider({ children }) {
  const { session } = useAuth()
  const queryClient = useQueryClient()

  const { data = [], isLoading } = useQuery({
    queryKey: qk.notifications,
    enabled: !!session,
    // RLS already restricts these to "mine or addressed to my role"
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, title, body, kind, entity_type, entity_id, link, is_read, created_at')
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data ?? []
    },
    staleTime: 20_000,
  })

  useRealtime('notifications', [qk.notifications])

  const markRead = useMutation({
    mutationFn: async (ids) => {
      const { error } = await supabase.rpc('mark_notifications_read', { p_ids: ids })
      if (error) throw error
    },
    onMutate: async (ids) => {
      // Optimistic: the bell should drop the moment it is clicked
      await queryClient.cancelQueries({ queryKey: qk.notifications })
      const previous = queryClient.getQueryData(qk.notifications)
      queryClient.setQueryData(qk.notifications, (old = []) =>
        old.map((n) => (ids.includes(n.id) ? { ...n, is_read: true } : n)),
      )
      return { previous }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(qk.notifications, ctx.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.notifications }),
  })

  const unread = useMemo(() => data.filter((n) => !n.is_read), [data])

  const markAllRead = useCallback(() => {
    const ids = unread.map((n) => n.id)
    if (ids.length) markRead.mutate(ids)
  }, [unread, markRead])

  const value = useMemo(
    () => ({
      notifications: data,
      unread,
      unreadCount: unread.length,
      isLoading,
      markRead: (id) => markRead.mutate([id]),
      markAllRead,
    }),
    [data, unread, isLoading, markRead, markAllRead],
  )

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used inside <NotificationProvider>')
  return ctx
}
