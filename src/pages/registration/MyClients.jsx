import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'

import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import ClientListView from '../../components/client/ClientListView'
import { useAuth } from '../../contexts/AuthContext'

export default function MyClients() {
  const { profile, isAdmin } = useAuth()

  return (
    <>
      <PageHeader
        title={isAdmin ? 'All Clients' : 'My Clients'}
        description="Every client you registered and where each one is in the process."
        breadcrumbs={[{ label: 'Registration', to: '/registration' }, { label: 'Clients' }]}
        actions={
          <Link to="/registration/new">
            <Button icon={Plus}>New Client</Button>
          </Link>
        }
      />
      <ClientListView
        baseFilters={isAdmin ? {} : { registered_by: profile?.id }}
        exportName="my-clients"
        emptyTitle="You have not registered any clients yet"
        emptyDescription="Press New Client to register the first one."
      />
    </>
  )
}
