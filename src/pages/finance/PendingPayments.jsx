import { Link } from 'react-router-dom'
import { Wallet } from 'lucide-react'

import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import ClientListView from '../../components/client/ClientListView'

/**
 * Finance never re-enters client information: every column here is pulled
 * from the record Registration created and ALT worked on.
 */
export default function PendingPayments() {
  return (
    <>
      <PageHeader
        title="Pending Payments"
        description="Clients whose documents are signed and who are ready to pay."
        breadcrumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Pending Payments' }]}
      />
      <ClientListView
        baseFilters={{ status: 'waiting_payment' }}
        lockedStatus="waiting_payment"
        exportName="pending-payments"
        emptyTitle="No payments waiting"
        emptyDescription="Clients appear here as soon as ALT marks their document complete."
        rowActions={(row) => (
          <Link to={`/clients/${row.id}`}>
            <Button size="sm" icon={Wallet}>
              Receive Payment
            </Button>
          </Link>
        )}
      />
    </>
  )
}
