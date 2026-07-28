import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, TrendingDown, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'

import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import DataTable from '../../components/table/DataTable'
import { Input, Textarea, Select } from '../../components/ui/Field'
import { supabase } from '../../lib/supabaseClient'
import { useTableState } from '../../hooks/useTableState'
import { useOfficeSettings } from '../../contexts/OfficeSettingsContext'
import { formatDate, todayInput } from '../../utils/format'
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '../../constants'
import { friendlyError } from '../../utils/errors'
import { LONG_CACHE } from '../../lib/queryClient'

const BLANK = {
  category_id: '', description: '', amount: '', payment_method: 'cash',
  expense_date: todayInput(), receipt_ref: '', notes: '',
}

export default function Expenses() {
  const queryClient = useQueryClient()
  const { money } = useOfficeSettings()
  const table = useTableState({ defaultSort: { key: 'expense_date', dir: 'desc' } })
  const [editing, setEditing] = useState(null)
  const f = table.filters

  const categories = useQuery({
    queryKey: ['expense-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expense_categories').select('id, name').eq('is_active', true).is('deleted_at', null).order('name')
      if (error) throw error
      return data ?? []
    },
    ...LONG_CACHE,
  })

  const query = useQuery({
    queryKey: ['expenses', f, table.page, table.pageSize, table.sort],
    queryFn: async () => {
      let q = supabase
        .from('expenses')
        .select('id, description, amount, payment_method, expense_date, receipt_ref, notes, category_id, category_name_snapshot', { count: 'exact' })
        .is('deleted_at', null)

      if (f.q) q = q.or(`description.ilike.%${f.q}%,receipt_ref.ilike.%${f.q}%`)
      if (f.category) q = q.eq('category_id', f.category)
      if (f.method) q = q.eq('payment_method', f.method)
      if (f.range === 'today') q = q.eq('expense_date', todayInput())
      if (f.from) q = q.gte('expense_date', f.from)
      if (f.to) q = q.lte('expense_date', f.to)

      q = q.order(table.sort.key, { ascending: table.sort.dir === 'asc' }).range(table.range.from, table.range.to)
      const { data, error, count } = await q
      if (error) throw error
      return { rows: data ?? [], total: count ?? 0 }
    },
    keepPreviousData: true,
  })

  const save = useMutation({
    mutationFn: async () => {
      const category = categories.data?.find((c) => c.id === editing.category_id)
      const payload = {
        category_id: editing.category_id,
        category_name_snapshot: category?.name ?? 'Uncategorised',
        description: editing.description.trim(),
        amount: Number(editing.amount),
        payment_method: editing.payment_method,
        expense_date: editing.expense_date,
        receipt_ref: editing.receipt_ref || null,
        notes: editing.notes || null,
      }
      if (editing.id) {
        const { error } = await supabase.from('expenses').update(payload).eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('expenses').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      toast.success(editing.id ? 'Expense updated' : 'Expense recorded')
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      setEditing(null)
    },
    onError: (e) => toast.error(friendlyError(e)),
  })

  const columns = [
    { key: 'expense_date', header: 'Date', sortable: true, render: (r) => formatDate(r.expense_date) },
    { key: 'category_name_snapshot', header: 'Category' },
    { key: 'description', header: 'Description' },
    { key: 'amount', header: 'Amount', align: 'right', sortable: true, render: (r) => money(r.amount), exportValue: (r) => r.amount },
    { key: 'payment_method', header: 'Method', render: (r) => PAYMENT_METHOD_LABELS[r.payment_method] ?? r.payment_method },
    { key: 'receipt_ref', header: 'Reference' },
    {
      key: 'actions', header: '', align: 'right',
      render: (r) => (
        <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing({ ...r, amount: String(r.amount) })}>
          Edit
        </Button>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Expenses"
        description="Office costs. These are the only figures entered by hand — income comes from payments automatically."
        breadcrumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Expenses' }]}
        actions={<Button icon={Plus} onClick={() => setEditing({ ...BLANK })}>Record Expense</Button>}
      />

      <div className="mb-4 card p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Input label="Search" placeholder="Description or reference" defaultValue={f.q ?? ''} onChange={(e) => table.setFilter('q', e.target.value)} />
          <Select label="Category" placeholder="All categories" value={f.category ?? ''} onChange={(e) => table.setFilter('category', e.target.value)} options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))} />
          <Select label="Method" placeholder="All methods" value={f.method ?? ''} onChange={(e) => table.setFilter('method', e.target.value)} options={PAYMENT_METHODS} />
          <Input label="From" type="date" value={f.from ?? ''} onChange={(e) => table.setFilter('from', e.target.value)} />
          <Input label="To" type="date" value={f.to ?? ''} onChange={(e) => table.setFilter('to', e.target.value)} />
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={query.data?.rows ?? []}
        total={query.data?.total ?? 0}
        page={table.page}
        pageSize={table.pageSize}
        onPageChange={table.setPage}
        onPageSizeChange={table.setPageSize}
        sort={table.sort}
        onSortChange={table.setSort}
        loading={query.isLoading}
        error={query.isError ? query.error : null}
        onRetry={query.refetch}
        emptyIcon={TrendingDown}
        emptyTitle="No expenses recorded"
        emptyDescription="Record rent, electricity, salaries, fuel and other office costs here."
        exportFileName="expenses"
        enablePrint
      />

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit expense' : 'Record expense'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button
              loading={save.isPending}
              disabled={!editing?.category_id || !editing?.description?.trim() || !(Number(editing?.amount) > 0)}
              onClick={() => save.mutate()}
            >
              {editing?.id ? 'Save changes' : 'Save expense'}
            </Button>
          </>
        }
      >
        {editing && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Category" required placeholder="Choose…" value={editing.category_id} onChange={(e) => setEditing({ ...editing, category_id: e.target.value })} options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))} />
            <Input label="Amount" required type="number" step="0.01" min="0.01" value={editing.amount} onChange={(e) => setEditing({ ...editing, amount: e.target.value })} />
            <Input label="Description" required value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} wrapperClassName="sm:col-span-2" />
            <Select label="Payment method" value={editing.payment_method} onChange={(e) => setEditing({ ...editing, payment_method: e.target.value })} options={PAYMENT_METHODS} />
            <Input label="Expense date" type="date" value={editing.expense_date} onChange={(e) => setEditing({ ...editing, expense_date: e.target.value })} />
            <Input label="Receipt reference" value={editing.receipt_ref ?? ''} onChange={(e) => setEditing({ ...editing, receipt_ref: e.target.value })} hint="Optional" wrapperClassName="sm:col-span-2" />
            <Textarea label="Notes" value={editing.notes ?? ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} rows={2} wrapperClassName="sm:col-span-2" />
          </div>
        )}
      </Modal>
    </>
  )
}
