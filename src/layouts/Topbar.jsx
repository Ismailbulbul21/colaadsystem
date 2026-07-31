import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import {
  Menu, Bell, LogOut, User, Search, Loader2, CheckCheck, X, Sun, Moon,
} from 'lucide-react'
import toast from 'react-hot-toast'

import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../contexts/NotificationContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useTheme } from '../contexts/ThemeContext'
import { useDebounce } from '../hooks/useDebounce'
import { universalSearch } from '../services/searchService'
import { formatRelative } from '../utils/format'
import { friendlyError } from '../utils/errors'
import { supabase } from '../lib/supabaseClient'

export default function Topbar({ onMenuClick }) {
  const { profile, role, signOut } = useAuth()
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications()
  const { t, lang, setLang, languages } = useLanguage()
  const { isDark, setTheme } = useTheme()
  const navigate = useNavigate()

  // Switching language also saves it to the employee's profile so it follows
  // them to any computer in the office.
  const changeLanguage = (next) => {
    setLang(next)
    if (profile?.id) {
      supabase.from('users').update({ preferred_language: next }).eq('id', profile.id).then(
        () => {},
        () => {},
      )
    }
  }

  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [openPanel, setOpenPanel] = useState(null) // 'search' | 'bell' | 'user'
  const debounced = useDebounce(query, 300)
  const rootRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    if (debounced.trim().length < 2) {
      setResults(null)
      return
    }
    setSearching(true)
    universalSearch(debounced.trim(), role)
      .then((r) => !cancelled && setResults(r))
      .catch(() => !cancelled && setResults({ clients: [], receipts: [], invoices: [], services: [], employees: [] }))
      .finally(() => !cancelled && setSearching(false))
    return () => {
      cancelled = true
    }
  }, [debounced, role])

  useEffect(() => {
    const onClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpenPanel(null)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const go = (to, notificationId) => {
    if (notificationId) markRead(notificationId)
    setOpenPanel(null)
    setQuery('')
    navigate(to)
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch (e) {
      toast.error(friendlyError(e))
    }
  }

  const hasResults =
    results &&
    Object.values(results).some((list) => Array.isArray(list) && list.length > 0)

  return (
    <header
      ref={rootRef}
      className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-surface-border bg-white/85 px-4 backdrop-blur-xl backdrop-saturate-150 lg:px-6 no-print"
    >
      <button
        onClick={onMenuClick}
        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* ---------- universal search ---------- */}
      <div className="relative flex-1 max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpenPanel('search')
          }}
          onFocus={() => setOpenPanel('search')}
          placeholder={t('top.searchPlaceholder')}
          className="h-10 w-full rounded-lg border border-surface-border bg-surface-sunken pl-9 pr-9 text-[13px] text-ink-800 shadow-inset transition-all duration-200 placeholder:text-ink-400 focus:border-navy-400 focus:bg-white focus:shadow-none"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('')
              setResults(null)
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}

        {openPanel === 'search' && query.trim().length >= 2 && (
          <div className="absolute left-0 right-0 top-12 max-h-[70vh] overflow-y-auto rounded-xl border border-surface-border bg-white p-2 shadow-panel">
            {searching && (
              <div className="flex items-center gap-2 px-3 py-3 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> {t('top.searching')}
              </div>
            )}

            {!searching && !hasResults && (
              <p className="px-3 py-4 text-sm text-slate-500">
                {t('top.noResults')} — “{query}”
              </p>
            )}

            {!searching && hasResults && (
              <>
                <SearchGroup
                  title="Clients"
                  items={results.clients}
                  render={(c) => ({
                    key: c.id,
                    primary: c.full_name,
                    secondary: `${c.registration_no} · ${c.service_name_snapshot}`,
                    to: `/clients/${c.id}`,
                  })}
                  onSelect={go}
                />
                <SearchGroup
                  title="Receipts"
                  items={results.receipts}
                  render={(r) => ({
                    key: r.id,
                    primary: r.receipt_no,
                    secondary: `${r.client_name} · ${r.service_name}`,
                    to: `/finance/receipts?q=${encodeURIComponent(r.receipt_no)}`,
                  })}
                  onSelect={go}
                />
                <SearchGroup
                  title="Invoices"
                  items={results.invoices}
                  render={(i) => ({
                    key: i.id,
                    primary: i.invoice_no,
                    secondary: `${i.client_name} · ${i.service_name}`,
                    to: `/finance/invoices?q=${encodeURIComponent(i.invoice_no)}`,
                  })}
                  onSelect={go}
                />
                <SearchGroup
                  title="Documents"
                  items={results.documents}
                  render={(d) => ({
                    key: d.id,
                    primary: d.title,
                    secondary: `${d.file_name} · v${d.version} · ${d.clients?.registration_no ?? ''}`,
                    to: `/clients/${d.client_id}`,
                  })}
                  onSelect={go}
                />
                <SearchGroup
                  title="Services"
                  items={results.services}
                  render={(s) => ({
                    key: s.id,
                    primary: s.name,
                    secondary: s.category ?? 'Service',
                    to: '/admin/services',
                  })}
                  onSelect={go}
                />
                <SearchGroup
                  title="Employees"
                  items={results.employees}
                  render={(u) => ({
                    key: u.id,
                    primary: u.full_name,
                    secondary: u.role_code,
                    to: '/admin/employees',
                  })}
                  onSelect={go}
                />
              </>
            )}
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <div className="hidden text-right md:block">
          <p className="text-xs font-medium text-ink-700">
            {format(new Date(), 'EEEE, dd MMMM yyyy')}
          </p>
          <p className="text-[11px] text-slate-400">{t(`role.${role}`, role)}</p>
        </div>

        {/* ---------- light / dark ---------- */}
        <button
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          title={isDark ? 'Switch to light' : 'Switch to dark'}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          className="rounded-lg p-2 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800"
        >
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        {/* ---------- language switch ---------- */}
        <div className="flex items-center rounded-lg border border-surface-border p-0.5">
          {languages.map((l) => (
            <button
              key={l.code}
              onClick={() => changeLanguage(l.code)}
              title={l.label}
              aria-pressed={lang === l.code}
              className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                lang === l.code
                  ? 'bg-navy-900 text-white'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {l.short}
            </button>
          ))}
        </div>

        {/* ---------- notification bell ---------- */}
        <div className="relative">
          <button
            onClick={() => setOpenPanel(openPanel === 'bell' ? null : 'bell')}
            className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white tabular">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {openPanel === 'bell' && (
            <div className="absolute right-0 top-12 w-80 overflow-hidden rounded-xl border border-surface-border bg-white shadow-panel">
              <div className="flex items-center justify-between border-b border-surface-border px-4 py-2.5">
                <p className="text-sm font-semibold text-slate-800">{t('top.notifications')}</p>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="flex items-center gap-1 text-xs font-medium text-navy-700 hover:underline"
                  >
                    <CheckCheck className="h-3.5 w-3.5" /> {t('top.markAllRead')}
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-slate-500">
                    {t('top.nothingWaiting')}
                  </p>
                ) : (
                  notifications.slice(0, 12).map((n) => (
                    <button
                      key={n.id}
                      onClick={() => go(n.link || '/notifications', n.id)}
                      className={`flex w-full gap-3 border-b border-surface-border px-4 py-3 text-left last:border-0 hover:bg-slate-50 ${
                        n.is_read ? '' : 'bg-navy-50/40'
                      }`}
                    >
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                          n.is_read ? 'bg-transparent' : 'bg-navy-600'
                        }`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-800">
                          {n.title}
                        </span>
                        {n.body && (
                          <span className="block truncate text-xs text-slate-500">{n.body}</span>
                        )}
                        <span className="mt-0.5 block text-[11px] text-slate-400">
                          {formatRelative(n.created_at)}
                        </span>
                      </span>
                    </button>
                  ))
                )}
              </div>

              <Link
                to="/notifications"
                onClick={() => setOpenPanel(null)}
                className="block border-t border-surface-border bg-surface-muted px-4 py-2.5 text-center text-xs font-medium text-navy-700 hover:underline"
              >
                {t('top.viewAll')}
              </Link>
            </div>
          )}
        </div>

        {/* ---------- profile ---------- */}
        <div className="relative">
          <button
            onClick={() => setOpenPanel(openPanel === 'user' ? null : 'user')}
            className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-slate-100"
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <span className="grid h-8 w-8 place-items-center rounded-full bg-navy-900 text-xs font-semibold text-white">
                {(profile?.full_name || '?').slice(0, 1).toUpperCase()}
              </span>
            )}
          </button>

          {openPanel === 'user' && (
            <div className="absolute right-0 top-12 w-56 overflow-hidden rounded-xl border border-surface-border bg-white shadow-panel">
              <div className="border-b border-surface-border px-4 py-3">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {profile?.full_name}
                </p>
                <p className="truncate text-xs text-slate-500">@{profile?.username}</p>
              </div>
              <Link
                to="/profile"
                onClick={() => setOpenPanel(null)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                <User className="h-4 w-4 text-slate-400" /> {t('top.myProfile')}
              </Link>
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-2.5 border-t border-surface-border px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" /> {t('auth.signOut')}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

function SearchGroup({ title, items, render, onSelect }) {
  if (!items?.length) return null
  return (
    <div className="mb-1 last:mb-0">
      <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </p>
      {items.map((item) => {
        const r = render(item)
        return (
          <button
            key={r.key}
            onClick={() => onSelect(r.to)}
            className="flex w-full flex-col items-start rounded-lg px-3 py-2 text-left hover:bg-slate-50"
          >
            <span className="text-sm font-medium text-slate-800">{r.primary}</span>
            <span className="text-xs text-slate-500">{r.secondary}</span>
          </button>
        )
      })}
    </div>
  )
}
