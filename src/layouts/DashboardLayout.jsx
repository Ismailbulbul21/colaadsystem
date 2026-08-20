import { useState, Suspense, useEffect, useRef } from 'react'
import { Outlet } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import TopNav from './TopNav'
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

  // Identity bar on top, department menu beneath it, content below — the
  // shape the office asked for, replacing the left sidebar.
  return (
    <div className="min-h-screen bg-surface-muted">
      <Topbar />
      <TopNav badges={badges} />

      <main className="mx-auto w-full max-w-[1600px] px-4 py-6 lg:px-6">
        <Suspense fallback={<CardsSkeleton />}>
          <Outlet />
        </Suspense>
      </main>

      <footer className="border-t border-surface-border bg-surface px-4 py-4 no-print lg:px-6">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2 text-2xs text-ink-400">
          <span>© {new Date().getFullYear()} Olad Law Office and Public Notary Service. All rights reserved.</span>
          <span>Version 1.0.0</span>
        </div>
      </footer>
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
