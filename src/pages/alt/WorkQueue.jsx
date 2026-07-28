import { Link } from 'react-router-dom'
import { Upload } from 'lucide-react'

import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import ClientListView from '../../components/client/ClientListView'

export default function WorkQueue() {
  return (
    <>
      <PageHeader
        title="Work Queue"
        description="Clients waiting for their legal document. Prepare it in Microsoft Word, then upload the finished file."
        breadcrumbs={[{ label: 'ALT', to: '/alt' }, { label: 'Work Queue' }]}
      />
      <ClientListView
        baseFilters={{ status: 'waiting_alt' }}
        lockedStatus="waiting_alt"
        exportName="alt-queue"
        emptyTitle="Nothing waiting"
        emptyDescription="When Registration completes a client they appear here immediately."
        rowActions={(row) => (
          <Link to={`/clients/${row.id}`}>
            <Button size="sm" icon={Upload}>
              Open
            </Button>
          </Link>
        )}
      />
    </>
  )
}
