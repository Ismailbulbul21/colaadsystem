import { Link } from 'react-router-dom'
import { Home, SearchX } from 'lucide-react'
import Button from '../../components/ui/Button'
import { useAuth } from '../../contexts/AuthContext'
import { HOME_BY_ROLE } from '../../constants'

export default function NotFound() {
  const { role, session } = useAuth()
  const home = session ? (HOME_BY_ROLE[role] ?? '/') : '/login'

  return (
    <div className="grid min-h-screen place-items-center bg-surface-muted px-6">
      <div className="text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-navy-50 text-navy-700">
          <SearchX className="h-8 w-8" />
        </div>
        <h1 className="mt-6 text-2xl font-semibold text-slate-900">Page not found</h1>
        <p className="mt-2 max-w-sm text-sm text-slate-500">
          That page does not exist, or you do not have access to it.
        </p>
        <Link to={home} className="mt-6 inline-block">
          <Button icon={Home}>Back to dashboard</Button>
        </Link>
      </div>
    </div>
  )
}
