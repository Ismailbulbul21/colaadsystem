import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, Printer } from 'lucide-react'

import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import StatCard from '../../components/dashboard/StatCard'
import DataTable from '../../components/table/DataTable'
import { Input, Select } from '../../components/ui/Field'
import { CardsSkeleton } from '../../components/feedback/Skeleton'
import { supabase } from '../../lib/supabaseClient'
import { useOfficeSettings } from '../../contexts/OfficeSettingsContext'
import { useTableState } from '../../hooks/useTableState'
import { formatDate, startOfMonthInput, todayInput, dayRangeToTimestamps } from '../../utils/format'
import { PAYMENT_METHOD_LABELS } from '../../constants'

const REPORTS = [
  { value: 'income', label: 'Income / Transactions' },
  { value: 'expenses', label: 'Expenses' },
  { value: 'profit', label: 'Profit summary' },
  { value: 'by-service', label: 'Revenue by service' },
  { value: 'by-employee', label: 'Collection by employee' },
  { value: 'by-method', label: 'Revenue by payment method' },
  { value: 'by-category', label: 'Expenses by category' },
  { value: 'outstanding', label: 'Outstanding payments' },
  { value: 'discounts', label: 'Discounts given' },
]

/**
 * Reports never store totals — they recompute from transactions every time,
 * so a report can never drift out of step with the underlying records.
 */
export default function Reports() {
  const { money } = useOfficeSettings()
  const table = useTableState()
  const report = table.filters.report ?? 'income'
  const from = table.filters.from ?? startOfMonthInput()
  const to = table.filters.to ?? todayInput()

  const { data, isLoading } = useQuery({
    queryKey: ['report', report, from, to],
    queryFn: async () => {
      const { start, end } = dayRangeToTimestamps(from, to)

      const [payments, expenses] = await Promise.all([
        supabase
          .from('receipts')
          .select('receipt_no, client_name, registration_no, service_name, original_price, discount_amount, amount_paid, payment_method, cashier_name, issued_at')
          .gte('issued_at', start).lt('issued_at', end)
          .order('issued_at', { ascending: false }),
        supabase
          .from('expenses')
          .select('description, amount, payment_method, expense_date, category_name_snapshot, receipt_ref')
          .gte('expense_date', from).lte('expense_date', to).is('deleted_at', null)
          .order('expense_date', { ascending: false }),
      ])

      const rows = payments.data ?? []
      const exp = expenses.data ?? []
      const income = rows.reduce((a, r) => a + Number(r.amount_paid ?? 0), 0)
      const spent = exp.reduce((a, e) => a + Number(e.amount ?? 0), 0)
      const discounts = rows.reduce((a, r) => a + Number(r.discount_amount ?? 0), 0)

      const groupBy = (list, key, valueKey) => {
        const map = new Map()
        for (const r of list) {
          const k = r[key] || 'Unknown'
          const cur = map.get(k) ?? { name: k, total: 0, count: 0 }
          cur.total += Number(r[valueKey] ?? 0)
          cur.count += 1
          map.set(k, cur)
        }
        return Array.from(map.values()).sort((a, b) => b.total - a.total)
      }

      let outstanding = []
      if (report === 'outstanding') {
        const { data } = await supabase
          .from('clients')
          .select('registration_no, full_name, phone, service_name_snapshot, final_price, status, registered_at')
          .eq('status', 'waiting_payment').is('deleted_at', null)
          .order('registered_at', { ascending: true })
        outstanding = data ?? []
      }

      return {
        income, spent, profit: income - spent, discounts,
        transactions: rows, expenses: exp, outstanding,
        byService: groupBy(rows, 'service_name', 'amount_paid'),
        byEmployee: groupBy(rows, 'cashier_name', 'amount_paid'),
        byMethod: groupBy(rows, 'payment_method', 'amount_paid'),
        byCategory: groupBy(exp, 'category_name_snapshot', 'amount'),
      }
    },
  })

  const { rows, columns, title } = useMemo(() => {
    const d = data
    if (!d) return { rows: [], columns: [], title: '' }
    const grouped = (label) => [
      { key: 'name', header: label },
      { key: 'count', header: 'Count', align: 'center' },
      { key: 'total', header: 'Total', align: 'right', render: (r) => money(r.total), exportValue: (r) => r.total },
    ]

    switch (report) {
      case 'expenses':
      case 'profit':
        return {
          title: 'Expenses',
          rows: d.expenses,
          columns: [
            { key: 'expense_date', header: 'Date', render: (r) => formatDate(r.expense_date) },
            { key: 'category_name_snapshot', header: 'Category' },
            { key: 'description', header: 'Description' },
            { key: 'payment_method', header: 'Method', render: (r) => PAYMENT_METHOD_LABELS[r.payment_method] ?? r.payment_method },
            { key: 'amount', header: 'Amount', align: 'right', render: (r) => money(r.amount), exportValue: (r) => r.amount },
          ],
        }
      case 'by-service': return { title: 'Revenue by service', rows: d.byService, columns: grouped('Service') }
      case 'by-employee': return { title: 'Collection by employee', rows: d.byEmployee, columns: grouped('Employee') }
      case 'by-method': return {
        title: 'Revenue by payment method',
        rows: d.byMethod.map((r) => ({ ...r, name: PAYMENT_METHOD_LABELS[r.name] ?? r.name })),
        columns: grouped('Method'),
      }
      case 'by-category': return { title: 'Expenses by category', rows: d.byCategory, columns: grouped('Category') }
      case 'outstanding':
        return {
          title: 'Outstanding payments',
          rows: d.outstanding,
          columns: [
            { key: 'registration_no', header: 'Reg No', className: 'tabular' },
            { key: 'full_name', header: 'Client' },
            { key: 'phone', header: 'Phone', className: 'tabular' },
            { key: 'service_name_snapshot', header: 'Service' },
            { key: 'final_price', header: 'Amount due', align: 'right', render: (r) => money(r.final_price), exportValue: (r) => r.final_price },
            { key: 'registered_at', header: 'Registered', render: (r) => formatDate(r.registered_at) },
          ],
        }
      case 'discounts':
        return {
          title: 'Discounts given',
          rows: d.transactions.filter((r) => Number(r.discount_amount) > 0),
          columns: [
            { key: 'issued_at', header: 'Date', render: (r) => formatDate(r.issued_at) },
            { key: 'client_name', header: 'Client' },
            { key: 'service_name', header: 'Service' },
            { key: 'original_price', header: 'Original', align: 'right', render: (r) => money(r.original_price), exportValue: (r) => r.original_price },
            { key: 'discount_amount', header: 'Discount', align: 'right', render: (r) => money(r.discount_amount), exportValue: (r) => r.discount_amount },
            { key: 'amount_paid', header: 'Paid', align: 'right', render: (r) => money(r.amount_paid), exportValue: (r) => r.amount_paid },
          ],
        }
      default:
        return {
          title: 'Transactions',
          rows: d.transactions,
          columns: [
            { key: 'issued_at', header: 'Date', render: (r) => formatDate(r.issued_at) },
            { key: 'receipt_no', header: 'Receipt', className: 'tabular' },
            { key: 'client_name', header: 'Client' },
            { key: 'service_name', header: 'Service' },
            { key: 'payment_method', header: 'Method', render: (r) => PAYMENT_METHOD_LABELS[r.payment_method] ?? r.payment_method },
            { key: 'cashier_name', header: 'Cashier' },
            { key: 'amount_paid', header: 'Amount', align: 'right', render: (r) => money(r.amount_paid), exportValue: (r) => r.amount_paid },
          ],
        }
    }
  }, [data, report, money])

  return (
    <>
      <PageHeader
        title="Financial Reports"
        description="All totals are calculated live from transactions. Nothing here is stored or editable."
        breadcrumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Reports' }]}
        actions={<Button variant="secondary" icon={Printer} onClick={() => window.print()}>Print</Button>}
      />

      <div className="mb-5 card p-4 no-print">
        <div className="grid gap-3 sm:grid-cols-3">
          <Select label="Report" value={report} onChange={(e) => table.setFilter('report', e.target.value)} options={REPORTS} />
          <Input label="From" type="date" value={from} onChange={(e) => table.setFilter('from', e.target.value)} />
          <Input label="To" type="date" value={to} onChange={(e) => table.setFilter('to', e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <CardsSkeleton count={4} />
      ) : (
        <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Income" value={money(data?.income)} tone="emerald" hint={`${formatDate(from)} – ${formatDate(to)}`} />
          <StatCard label="Total Expenses" value={money(data?.spent)} tone="red" />
          <StatCard label="Profit" value={money(data?.profit)} tone={data?.profit >= 0 ? 'navy' : 'red'} emphasis hint="Income minus expenses" />
          <StatCard label="Discounts Given" value={money(data?.discounts)} tone="amber" />
        </div>
      )}

      <DataTable
        title={title}
        columns={columns}
        rows={rows}
        total={rows.length}
        page={1}
        pageSize={rows.length || 1}
        loading={isLoading}
        emptyIcon={BarChart3}
        emptyTitle="No data in this period"
        emptyDescription="Try widening the date range."
        exportFileName={`report-${report}`}
        enablePrint
        dense
      />
    </>
  )
}
