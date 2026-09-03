import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'

import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import ClientListView from '../../components/client/ClientListView'
import { useAuth } from '../../contexts/AuthContext'

export default function ClientSearch() {
  const { hasRole } = useAuth()

  return (
    <>
      <PageHeader
        title="Client Search"
        description="Search by name, phone, registration number, service, status or date."
        actions={
          hasRole('admin', 'nootaayo') && (
            <Link to="/registration/new">
              <Button icon={Plus}>New Client</Button>
            </Link>
          )
        }
      />
      <ClientListView exportName="client-search" />
    </>
  )
}
