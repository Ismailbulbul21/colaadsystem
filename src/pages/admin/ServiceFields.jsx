import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, SlidersHorizontal } from 'lucide-react'
import toast from 'react-hot-toast'

import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Badge from '../../components/ui/Badge'
import { Input, Select, Checkbox } from '../../components/ui/Field'
import { TableSkeleton } from '../../components/feedback/Skeleton'
import { EmptyState } from '../../components/feedback/States'
import { supabase } from '../../lib/supabaseClient'
import { getServiceFields, upsertServiceField, deleteServiceField } from '../../services/serviceService'
import { FIELD_TYPES } from '../../constants'
import { friendlyError } from '../../utils/errors'

const BLANK = {
  field_key: '', label: '', field_type: 'text', section: 'Service Information',
  is_required: false, display_order: 0, placeholder: '', help_text: '', options: [],
}

/**
 * This page is why the system never needs a code change for a new document
 * type. Whatever is defined here is what Registration will be asked to fill in.
 */
export default function ServiceFields() {
  const { serviceId } = useParams()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [optionsText, setOptionsText] = useState('')

  const service = useQuery({
    queryKey: ['service', serviceId],
    queryFn: async () => {
      const { data, error } = await supabase.from('services').select('id, name, category').eq('id', serviceId).single()
      if (error) throw error
      return data
    },
  })

  const fields = useQuery({
    queryKey: ['service-fields', serviceId],
    queryFn: () => getServiceFields(serviceId),
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['service-fields'] })

  const save = useMutation({
    mutationFn: () =>
      upsertServiceField({
        ...(editing.id ? { id: editing.id } : {}),
        service_id: serviceId,
        field_key: editing.field_key.trim().toLowerCase().replace(/\s+/g, '_'),
        label: editing.label.trim(),
        field_type: editing.field_type,
        section: editing.section.trim() || 'Service Information',
        is_required: editing.is_required,
        display_order: Number(editing.display_order || 0),
        placeholder: editing.placeholder || null,
        help_text: editing.help_text || null,
        options: optionsText
          ? optionsText.split('\n').map((o) => o.trim()).filter(Boolean)
          : [],
      }),
    onSuccess: () => {
      toast.success('Field saved. It appears on the Registration form immediately.')
      refresh()
      setEditing(null)
    },
    onError: (e) => toast.error(friendlyError(e)),
  })

  const remove = useMutation({
    mutationFn: () => deleteServiceField(deleting.id),
    onSuccess: () => {
      toast.success('Field removed')
      refresh()
      setDeleting(null)
    },
    onError: (e) => toast.error(friendlyError(e)),
  })

  const openEditor = (field) => {
    const value = field ?? { ...BLANK, display_order: (fields.data?.length ?? 0) + 1 }
    setEditing(value)
    setOptionsText(Array.isArray(value.options) ? value.options.join('\n') : '')
  }

  return (
    <>
      <PageHeader
        title={`Fields — ${service.data?.name ?? ''}`}
        description="Define exactly what Registration must collect for this service. No code change, no redeploy."
        breadcrumbs={[
          { label: 'Admin', to: '/admin' },
          { label: 'Services', to: '/admin/services' },
          { label: 'Fields' },
        ]}
        actions={<Button icon={Plus} onClick={() => openEditor(null)}>Add Field</Button>}
      />

      {fields.isLoading ? (
        <TableSkeleton rows={5} cols={4} />
      ) : !fields.data?.length ? (
        <EmptyState
          icon={SlidersHorizontal}
          title="No fields defined yet"
          description="Add the information this document needs — seller name, plot number, agreement date, and so on."
          action={<Button icon={Plus} onClick={() => openEditor(null)}>Add the first field</Button>}
        />
      ) : (
        <div className="card divide-y divide-surface-border overflow-hidden">
          {fields.data.map((f) => (
            <div key={f.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <span className="w-8 text-xs text-slate-400 tabular">{f.display_order}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800">
                  {f.label}
                  {f.is_required && <span className="ml-1 text-red-500">*</span>}
                </p>
                <p className="text-xs text-slate-400">
                  <code className="rounded bg-slate-100 px-1">{f.field_key}</code> · {f.section}
                </p>
              </div>
              <Badge tone="navy">{FIELD_TYPES.find((t) => t.value === f.field_type)?.label ?? f.field_type}</Badge>
              <Button size="sm" variant="ghost" onClick={() => openEditor(f)}>Edit</Button>
              <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setDeleting(f)} />
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        size="lg"
        title={editing?.id ? 'Edit field' : 'Add field'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button
              loading={save.isPending}
              disabled={!editing?.label?.trim() || !editing?.field_key?.trim()}
              onClick={() => save.mutate()}
            >
              Save field
            </Button>
          </>
        }
      >
        {editing && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Label shown to Registration" required value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value, field_key: editing.id ? editing.field_key : e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '_') })} placeholder="e.g. Seller Name" />
            <Input label="Field key" required value={editing.field_key} onChange={(e) => setEditing({ ...editing, field_key: e.target.value })} hint="Stored in the database. Do not change once in use." disabled={!!editing.id} />
            <Select label="Field type" value={editing.field_type} onChange={(e) => setEditing({ ...editing, field_type: e.target.value })} options={FIELD_TYPES} />
            <Input label="Section heading" value={editing.section} onChange={(e) => setEditing({ ...editing, section: e.target.value })} placeholder="Parties, Property, Witnesses…" />
            <Input label="Placeholder" value={editing.placeholder ?? ''} onChange={(e) => setEditing({ ...editing, placeholder: e.target.value })} />
            <Input label="Display order" type="number" value={editing.display_order} onChange={(e) => setEditing({ ...editing, display_order: e.target.value })} />
            {editing.field_type === 'select' && (
              <div className="sm:col-span-2">
                <label className="label">Dropdown options</label>
                <textarea
                  rows={4}
                  value={optionsText}
                  onChange={(e) => setOptionsText(e.target.value)}
                  placeholder={'One option per line'}
                  className="w-full rounded-lg border border-surface-border px-3 py-2 text-sm"
                />
              </div>
            )}
            <Input label="Help text" value={editing.help_text ?? ''} onChange={(e) => setEditing({ ...editing, help_text: e.target.value })} wrapperClassName="sm:col-span-2" />
            <Checkbox label="This field is required" checked={editing.is_required} onChange={(e) => setEditing({ ...editing, is_required: e.target.checked })} className="sm:col-span-2" />
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
        tone="danger"
        title="Remove this field?"
        message={`"${deleting?.label}" will no longer be asked for on new clients. Existing client records keep the information already saved.`}
        confirmLabel="Remove field"
      />
    </>
  )
}
