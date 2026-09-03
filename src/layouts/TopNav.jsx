import { NavLink } from 'react-router-dom'
import clsx from 'clsx'
import {
  LayoutDashboard, BadgePercent, Users, Briefcase, Settings, ScrollText,
  UserPlus, Inbox, FolderOpen, Wallet, ReceiptText, FileText, TrendingDown,
  BarChart3, Search, Circle, DatabaseBackup, FileClock, Archive, Map, FileBarChart, FileSpreadsheet, Calculator, FilePlus2, Stamp, BadgeDollarSign,
} from 'lucide-react'

import { useAuth } from '../contexts/AuthContext'
import { useT } from '../contexts/LanguageContext'
import { NAV_ITEMS } from '../constants'

// An explicit map instead of `import * as Icons`: a namespace import defeats
// tree-shaking and drags all ~1500 lucide icons into the main bundle.
const ICONS = {
  LayoutDashboard, BadgePercent, Users, Briefcase, Settings, ScrollText,
  UserPlus, Inbox, FolderOpen, Wallet, ReceiptText, FileText, TrendingDown,
  BarChart3, Search, DatabaseBackup, FileClock, Archive, Map, FileBarChart, FileSpreadsheet, Calculator, FilePlus2, Stamp, BadgeDollarSign,
}

/**
 * The department menu, sitting under the identity bar.
 *
 * The office asked for the Ministry portal's shape — logo and account on top,
 * a horizontal menu beneath — rather than a left sidebar. On narrow screens it
 * scrolls sideways instead of collapsing into a drawer, so a clerk on a small
 * laptop can still reach every page with one swipe.
 */
export default function TopNav({ badges = {} }) {
  const { role } = useAuth()
  const t = useT()

  // A link the role cannot use is never rendered, so it cannot be discovered
  // by reading the DOM either.
  const items = NAV_ITEMS.filter((i) => i.roles.includes(role))

  return (
    <nav className="sticky top-0 z-20 border-b border-surface-border bg-surface no-print">
      <div className="mx-auto max-w-[1600px] px-2 sm:px-4 lg:px-6">
        <ul className="flex items-stretch gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((item) => {
            const Icon = ICONS[item.icon] ?? Circle
            const count = item.badge ? badges[item.badge] : 0

            return (
              <li key={`${item.to}-${item.label}`} className="shrink-0">
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    clsx(
                      'relative flex items-center gap-2 whitespace-nowrap px-3.5 py-3 text-[13px] font-medium transition-colors',
                      isActive
                        ? 'text-navy-700 dark:text-navy-300'
                        : 'text-ink-500 hover:text-ink-800',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className="h-[18px] w-[18px] shrink-0"
                        strokeWidth={isActive ? 2.2 : 1.9}
                      />
                      <span>{t(item.tKey, item.label)}</span>

                      {count > 0 && (
                        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1.5 text-2xs font-bold tabular text-white">
                          {count > 99 ? '99+' : count}
                        </span>
                      )}

                      {/* underline marks the current page, as in the mockups */}
                      <span
                        className={clsx(
                          'absolute inset-x-2 bottom-0 h-0.5 rounded-t-full transition-opacity',
                          isActive ? 'bg-navy-600 opacity-100' : 'opacity-0',
                        )}
                      />
                    </>
                  )}
                </NavLink>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
