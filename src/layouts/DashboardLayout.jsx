import { useState, Suspense, useEffect, useRef } from 'react'
import { Outlet } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { NotificationProvider } from '../contexts/NotificationContext'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useWorkflowRealtime } from '../hooks/useRealtime'
import { fetchSidebarBadges } from '../services/statsService'
import { CardsSkeleton } from '../components/feedback/Skeleton'
import { DASHBOARD_CACHE } from '../lib/queryClient'

function Shell() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { role, profile } = useAuth()
  const { setLang } = useLanguage()
  const languageApplied = useRef(false)

  // Apply the employee's saved language once per session. Guarded by a ref so
  // it never fights the switcher in the top bar afterwards.
  useEffect(() => {
    if (languageApplied.current) return
    if (profile?.preferred_language) {
      languageApplied.current = true
      setLang(profile.preferred_language)
    }
  }, [profile?.preferred_language, setLang])

  const { data: badges = {} } = useQuery({
    queryKey: ['sidebar-badges', role],
    queryFn: () => fetchSidebarBadges(role),
    ...DASHBOARD_CACHE,
  })

  // One subscription for the whole shell keeps every counter live.
  useWorkflowRealtime([['sidebar-badges', role], ['stats', role]])

  return (
    <div className="min-h-screen bg-surface-muted">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} badges={badges} />

      <div className="lg:pl-64">
        <Topbar onMenuClick={() => setMenuOpen(true)} />

        <main className="mx-auto w-full max-w-[1600px] px-4 py-6 lg:px-8">
          <Suspense fallback={<CardsSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  )
}

export default function DashboardLayout() {
  return (
    <NotificationProvider>
      <Shell />
    </NotificationProvider>
  )
}
