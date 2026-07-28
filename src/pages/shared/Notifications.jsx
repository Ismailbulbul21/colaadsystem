import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck } from 'lucide-react'

import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import { EmptyState } from '../../components/feedback/States'
import { TableSkeleton } from '../../components/feedback/Skeleton'
import { useNotifications } from '../../contexts/NotificationContext'
import { formatDateTime, formatRelative } from '../../utils/format'

export default function Notifications() {
  const { notifications, unreadCount, isLoading, markRead, markAllRead } = useNotifications()
  const navigate = useNavigate()

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Work waiting for you. Notifications stay here until you mark them read."
        actions={
          unreadCount > 0 && (
            <Button variant="secondary" icon={CheckCheck} onClick={markAllRead}>
              Mark all read ({unreadCount})
            </Button>
          )
        }
      />

      {isLoading ? (
        <TableSkeleton rows={6} cols={2} />
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Nothing waiting for you"
          description="You will be notified here when a client, document or payment needs your attention."
        />
      ) : (
        <div className="card divide-y divide-surface-border overflow-hidden">
          {notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => {
                if (!n.is_read) markRead(n.id)
                if (n.link) navigate(n.link)
              }}
              className={`flex w-full gap-4 px-5 py-4 text-left transition-colors hover:bg-navy-50/40 ${
                n.is_read ? '' : 'bg-navy-50/30'
              }`}
            >
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                  n.is_read ? 'bg-slate-200' : 'bg-navy-600'
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800">{n.title}</p>
                {n.body && <p className="mt-0.5 text-sm text-slate-600">{n.body}</p>}
                <p className="mt-1 text-[11px] text-slate-400">
                  {formatDateTime(n.created_at)} · {formatRelative(n.created_at)}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  )
}
