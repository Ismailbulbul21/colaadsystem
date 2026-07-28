import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import FullPageLoader from '../components/feedback/FullPageLoader'
import { HOME_BY_ROLE } from '../constants'

/**
 * Route protection is the *convenience* layer: it stops an employee from
 * landing on a page that would only show them errors. The real barrier is
 * Row Level Security in Postgres, which does not care what the browser does.
 */
export default function ProtectedRoute({ roles, children }) {
  const { loading, session, profile, mustChangePassword, role } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageLoader />

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (!profile) return <FullPageLoader label="Loading your profile" />

  if (mustChangePassword) {
    return <Navigate to="/change-password" replace />
  }

  if (roles && !roles.includes(role)) {
    // Send them somewhere useful rather than showing a dead end.
    return <Navigate to={HOME_BY_ROLE[role] ?? '/login'} replace />
  }

  return children ?? <Outlet />
}
