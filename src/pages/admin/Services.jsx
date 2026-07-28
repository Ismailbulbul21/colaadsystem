import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Briefcase, SlidersHorizontal, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'

import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import DataTable from '../../components/table/DataTable'
import Badge from '../../components/ui/Badge'
import { Input, Textarea, Select, Checkbox } from '../../components/ui/Field'
import { listAllServices, createService, updateService } from '../../services/serviceService'
import { useOfficeSettings } from '../../contexts/OfficeSettingsContext'
import { friendlyError } from '../../utils/errors'

const BLANK = {
  name: '', category: '', price: '', description: '',
  estimated_time: '', internal_notes: '', display_order: 0, is_active: true,
}

export default function Services() {
  const queryClient = useQueryClient()
  const { money } = useOfficeSettings()
  const [editing, setEditing] = useState(null)

  const { data = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['services', 'all'],
    queryFn: listAllServices,
  })

  const save = useMutation({
    mutationFn: (payload) => {
      const body = { ...payload, price: Number(payload.price), display_order: Number(payload.display_order || 0) }
      delete body.id
      return payload.id ? updateService(payload.id, body) : createService(body)
    },
    onSuccess: () => {
      toast.success(editing?.id ? 'Service updated' : 'Service created')
      queryClient.invalidateQueries({ queryKey: ['services'] })
      setEditing(null)
    },
    onError: (e) => toast.error(friendlyError(e)),
  })

  const columns = [
    {
      key: 'name',
      header: 'Service',
      render: (s) => (
        <div>
          <p className="font-medium text-slate-800">{s.name}</p>
          {s.description && <p className="max-w-md truncate text-xs text-slate-400">{s.description}</p>}
        </div>
      ),
    },
    { key: 'category', header: 'Category' },
    { key: 'price', header: 'Price', align: 'right', render: (s) => money(s.price), exportValue: (s) => s.price },
    { key: 'display_order', header: 'Order', align: 'center' },
    {
      key: 'is_active',
      header: 'Status',
      render: (s) => (s.is_active ? <Badge tone="emerald" dot>Active</Badge> : <Badge tone="slate" dot>Disabled</Badge>),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (s) => (
        <div className="flex justify-end gap-1.5">
          <Link to={`/admin/services/${s.id}/fields`}>
            <Button size="sm" variant="ghost" icon={SlidersHorizontal}>Fields</Button>
          </Link>
          <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing({ ...s, price: String(s.price) })}>
            Edit
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Services"
        description="Prices are fixed here and nowhere else. Disable a service instead of deleting it so old records keep their original name and price."
        actions={<Button icon={Plus} onClick={() => setEditing({ ...BLANK })}>Add Service</Button>}
      />

      <DataTable
        columns={columns}
        rows={data}
        total={data.length}
        page={1}
        pageSize={data.length || 1}
        loading={isLoading}
        error={isError ? error : null}
        onRetry={refetch}
        emptyIcon={Briefcase}
        emptyTitle="No services yet"
        emptyDescription="Add the services this office offers, with their fixed prices."
        exportFileName="services"
      />

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        size="lg"
        title={editing?.id ? 'Edit service' : 'Add service'}
        description={editing?.id ? 'Changing the price only affects future clients.' : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button
              loading={save.isPending}
              disabled={!editing?.name?.trim() || editing?.price === ''}
              onClick={() => save.mutate(editing)}
            >
              {editing?.id ? 'Save changes' : 'Create service'}
            </Button>
          </>
        }
      >
        {editing && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Service name" required value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} wrapperClassName="sm:col-span-2" />
            <Input label="Category" value={editing.category ?? ''} onChange={(e) => setEditing({ ...editing, category: e.target.value })} placeholder="Property, Legal, Contracts…" />
            <Input label="Fixed price" required type="number" step="0.01" min="0" value={editing.price} onChange={(e) => setEditing({ ...editing, price: e.target.value })} />
            <Textarea label="Description" value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={2} wrapperClassName="sm:col-span-2" />
            <Input label="Estimated processing time" value={editing.estimated_time ?? ''} onChange={(e) => setEditing({ ...editing, estimated_time: e.target.value })} placeholder="e.g. 2 days" />
            <Input label="Display order" type="number" value={editing.display_order ?? 0} onChange={(e) => setEditing({ ...editing, display_order: e.target.value })} />
            <Textarea label="Internal notes" value={editing.internal_notes ?? ''} onChange={(e) => setEditing({ ...editing, internal_notes: e.target.value })} rows={2} hint="Staff only — never printed" wrapperClassName="sm:col-span-2" />
            <Checkbox label="Service is active and can be selected" checked={!!editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} className="sm:col-span-2" />
          </div>
        )}
      </Modal>
    </>
  )
}
