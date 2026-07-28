import { NavLink } from 'react-router-dom'
import clsx from 'clsx'
import {
  LayoutDashboard, BadgePercent, Users, Briefcase, Settings, ScrollText,
  UserPlus, Inbox, FolderOpen, Wallet, ReceiptText, FileText, TrendingDown,
  BarChart3, Search, Circle,
} from 'lucide-react'

import { useAuth } from '../contexts/AuthContext'
import { useOfficeSettings } from '../contexts/OfficeSettingsContext'
import { useT } from '../contexts/LanguageContext'
import { NAV_ITEMS } from '../constants'
import { assetUrl } from '../lib/supabaseClient'

// An explicit map instead of `import * as Icons`: a namespace import defeats
// tree-shaking and drags all ~1500 lucide icons into the main bundle.
const ICONS = {
  LayoutDashboard, BadgePercent, Users, Briefcase, Settings, ScrollText,
  UserPlus, Inbox, FolderOpen, Wallet, ReceiptText, FileText, TrendingDown,
  BarChart3, Search,
}

export default function Sidebar({ open, onClose, badges = {} }) {
  const { role, profile } = useAuth()
  const { settings } = useOfficeSettings()
  const t = useT()

  // A link the role cannot use is never rendered, so it cannot be discovered
  // by reading the DOM either.
  const items = NAV_ITEMS.filter((i) => i.roles.includes(role))
  const logo = assetUrl(settings.logo_url)

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-navy-950/50 backdrop-blur-[2px] lg:hidden no-print"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col no-print',
          'bg-gradient-to-b from-navy-900 via-navy-900 to-navy-950',
          'transition-transform duration-300 ease-out lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Hairline of light along the right edge lifts the panel off the page */}
        <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-white/10" />

        {/* ---------- office identity ---------- */}
        <div className="flex h-16 shrink-0 items-center gap-3 px-5">
          {logo ? (
            <img
              src={logo}
              alt=""
              className="h-9 w-9 rounded-lg bg-white object-contain p-0.5 shadow-xs"
            />
          ) : (
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/10 text-[13px] font-bold tracking-tight text-white ring-1 ring-inset ring-white/15">
              CN
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold leading-tight text-white">
              {settings.office_name || 'Colaad Notary'}
            </p>
            <p className="truncate text-2xs text-navy-300">{t('app.system')}</p>
          </div>
        </div>

        <div className="mx-5 h-px bg-white/10" />

        {/* ---------- navigation ---------- */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {items.map((item) => {
            const Icon = ICONS[item.icon] ?? Circle
            const count = item.badge ? badges[item.badge] : 0

            return (
              <NavLink
                key={`${item.to}-${item.label}`}
                to={item.to}
                end={item.end}
                onClick={onClose}
                className={({ isActive }) =>
                  clsx(
                    'group relative flex items-center gap-3 rounded-lg px-3 py-2.5',
                    'text-[13px] font-medium transition-colors duration-150',
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-navy-200 hover:bg-white/[0.06] hover:text-white',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {/* Brass marker: the one place accent colour earns its keep */}
                    <span
                      className={clsx(
                        'absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full transition-all duration-200',
                        isActive ? 'bg-brass-400 opacity-100' : 'bg-brass-400 opacity-0',
                      )}
                    />
                    <Icon
                      className={clsx(
                        'h-[18px] w-[18px] shrink-0 transition-opacity',
                        isActive ? 'opacity-100' : 'opacity-70 group-hover:opacity-100',
                      )}
                      strokeWidth={isActive ? 2.2 : 1.9}
                    />
                    <span className="flex-1 truncate">{t(item.tKey, item.label)}</span>
                    {count > 0 && (
                      <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brass-400 px-1.5 text-2xs font-bold tabular text-navy-950">
                        {count > 99 ? '99+' : count}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* ---------- who is signed in ---------- */}
        <div className="shrink-0 p-3">
          <div className="flex items-center gap-3 rounded-lg bg-white/[0.06] px-3 py-2.5 ring-1 ring-inset ring-white/10">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                className="h-8 w-8 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brass-400/90 text-xs font-bold text-navy-950">
                {(profile?.full_name || '?').slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white">
                {profile?.full_name}
              </p>
              <p className="truncate text-2xs text-navy-300">{t(`role.${role}`, role)}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
