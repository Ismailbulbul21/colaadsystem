import { useRef, useState } from 'react'
import { Printer, Download } from 'lucide-react'
import toast from 'react-hot-toast'

import Modal from '../ui/Modal'
import Button from '../ui/Button'
import QrCode from './QrCode'
import { exportNodeToPdf } from '../../utils/export'
import { formatDateTime, formatDate } from '../../utils/format'
import { PAYMENT_METHOD_LABELS } from '../../constants'
import { friendlyError } from '../../utils/errors'
import { useOfficeSettings } from '../../contexts/OfficeSettingsContext'

/**
 * Like the receipt, the invoice renders only from the columns frozen onto the
 * invoice row. Nothing is looked up live, so reprinting years later gives the
 * same document even if prices or office details have changed since.
 */
export default function InvoiceModal({ invoice, onClose }) {
  const printRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const { settings } = useOfficeSettings()
  if (!invoice) return null

  const symbol = settings.currency_symbol || '$'
  const money = (v) =>
    `${symbol}${Number(v ?? 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`

  const handlePdf = async () => {
    setBusy(true)
    try {
      await exportNodeToPdf(printRef.current, invoice.invoice_no)
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  const Row = ({ label, value, strong }) => (
    <div className="flex justify-between gap-4 py-1.5">
      <span className="text-slate-600">{label}</span>
      <span className={`tabular ${strong ? 'font-bold text-slate-900' : 'font-medium text-slate-800'}`}>
        {value}
      </span>
    </div>
  )

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Invoice ${invoice.invoice_no}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button variant="secondary" icon={Download} loading={busy} onClick={handlePdf}>PDF</Button>
          <Button icon={Printer} onClick={() => window.print()}>Print</Button>
        </>
      }
    >
      <div ref={printRef} className="printable print-exact mx-auto max-w-[190mm] bg-white p-6 text-sm">
        {/* ---------- header ---------- */}
        <div className="flex items-start justify-between gap-6 border-b-2 border-navy-900 pb-4">
          <div className="flex items-center gap-3">
            {settings.logo_url && (
              <img src={settings.logo_url} alt="" className="h-14 w-14 object-contain" />
            )}
            <div>
              <h2 className="text-lg font-bold text-navy-900">{settings.office_name}</h2>
              {settings.address && <p className="text-xs text-slate-600">{settings.address}</p>}
              <p className="text-xs text-slate-600">
                {[settings.phone_primary, settings.email].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-700">Invoice</p>
            <p className="mt-1 text-base font-bold tabular text-navy-900">{invoice.invoice_no}</p>
            <p className="text-xs text-slate-500">{formatDateTime(invoice.issued_at)}</p>
          </div>
        </div>

        {/* ---------- billed to ---------- */}
        <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
          <div>
            <p className="font-semibold text-slate-500">BILLED TO</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{invoice.client_name}</p>
            {invoice.client_phone && (
              <p className="text-slate-600 tabular">{invoice.client_phone}</p>
            )}
          </div>
          <div className="text-right">
            <p className="font-semibold text-slate-500">REGISTRATION</p>
            <p className="mt-1 text-sm font-semibold tabular text-slate-900">
              {invoice.registration_no}
            </p>
            <p className="mt-1 text-slate-600">
              Payment date: {formatDate(invoice.payment_date)}
            </p>
          </div>
        </div>

        {/* ---------- line ---------- */}
        <table className="mt-5 w-full border-collapse text-sm">
          <thead>
            <tr className="bg-navy-900 text-white">
              <th className="px-3 py-2 text-left text-xs font-semibold">SERVICE</th>
              <th className="px-3 py-2 text-right text-xs font-semibold">AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-200">
              <td className="px-3 py-2.5 font-medium text-slate-900">{invoice.service_name}</td>
              <td className="px-3 py-2.5 text-right font-medium tabular">
                {money(invoice.original_price)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* ---------- totals ---------- */}
        <div className="mt-3 ml-auto w-full max-w-xs text-sm">
          <Row label="Subtotal" value={money(invoice.original_price)} />
          {Number(invoice.discount_amount) > 0 && (
            <Row label="Discount" value={`− ${money(invoice.discount_amount)}`} />
          )}
          <div className="my-1 border-t border-slate-300" />
          <Row label="Total" value={money(invoice.final_price)} strong />
          <Row label="Paid" value={money(invoice.amount_paid)} strong />
          <Row label="Balance" value={money(invoice.balance)} />
          <Row
            label="Method"
            value={PAYMENT_METHOD_LABELS[invoice.payment_method] ?? invoice.payment_method}
          />
        </div>

        {/* ---------- status + verification ---------- */}
        <div className="mt-6 flex items-end justify-between gap-6">
          <div>
            <span
              className={`inline-block rounded px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                invoice.status === 'paid'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {invoice.status}
            </span>
          </div>
          <div className="text-center">
            <QrCode
              value={`${invoice.invoice_no}|${invoice.client_name}|${invoice.amount_paid}`}
              size={88}
              className="mx-auto"
            />
            <p className="mt-1 text-[9px] uppercase tracking-wide text-slate-400">
              Scan to verify
            </p>
          </div>
        </div>

        {settings.receipt_footer && (
          <p className="mt-6 border-t border-slate-200 pt-3 text-center text-xs text-slate-500">
            {settings.receipt_footer}
          </p>
        )}
      </div>
    </Modal>
  )
}
