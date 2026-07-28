import { useRef, useState } from 'react'
import { Printer, Download } from 'lucide-react'
import toast from 'react-hot-toast'

import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { supabase } from '../../lib/supabaseClient'
import { exportNodeToPdf } from '../../utils/export'
import { formatDateTime } from '../../utils/format'
import { PAYMENT_METHOD_LABELS } from '../../constants'
import { friendlyError } from '../../utils/errors'

/**
 * The receipt is rendered ONLY from the columns stored on the receipt row.
 * Nothing is looked up live, which is what makes a 2031 reprint identical to
 * the 2026 original.
 */
export default function ReceiptModal({ receipt, onClose }) {
  const printRef = useRef(null)
  const [busy, setBusy] = useState(false)
  if (!receipt) return null

  const symbol = receipt.currency_symbol || '$'
  const money = (v) =>
    `${symbol}${Number(v ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const logPrint = () => supabase.rpc('log_receipt_print', { p_receipt_id: receipt.id }).catch(() => {})

  const handlePrint = () => {
    logPrint()
    window.print()
  }

  const handlePdf = async () => {
    setBusy(true)
    try {
      await exportNodeToPdf(printRef.current, receipt.receipt_no)
      logPrint()
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  const Row = ({ label, value, strong, accent }) => (
    <div className="flex justify-between gap-4 py-1.5">
      <span className="text-slate-600">{label}</span>
      <span className={`tabular ${strong ? 'font-bold text-slate-900' : accent ? 'font-medium text-emerald-700' : 'font-medium text-slate-800'}`}>
        {value}
      </span>
    </div>
  )

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Receipt ${receipt.receipt_no}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button variant="secondary" icon={Download} loading={busy} onClick={handlePdf}>PDF</Button>
          <Button icon={Printer} onClick={handlePrint}>Print</Button>
        </>
      }
    >
      <div ref={printRef} className="printable print-exact mx-auto max-w-[190mm] bg-white p-6 text-sm">
        {/* ---------- header ---------- */}
        <div className="flex items-start justify-between gap-6 border-b-2 border-navy-900 pb-4">
          <div className="flex items-center gap-3">
            {receipt.office_logo_url && (
              <img src={receipt.office_logo_url} alt="" className="h-14 w-14 object-contain" />
            )}
            <div>
              <h2 className="text-lg font-bold text-navy-900">{receipt.office_name}</h2>
              {receipt.office_address && <p className="text-xs text-slate-600">{receipt.office_address}</p>}
              <p className="text-xs text-slate-600">
                {[receipt.office_phone, receipt.office_email].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-700">
              {receipt.receipt_header || 'Official Receipt'}
            </p>
            <p className="mt-1 text-base font-bold tabular text-navy-900">{receipt.receipt_no}</p>
            <p className="text-xs text-slate-500">{formatDateTime(receipt.issued_at)}</p>
          </div>
        </div>

        {/* ---------- client ---------- */}
        <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
          <div>
            <p className="font-semibold text-slate-500">RECEIVED FROM</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{receipt.client_name}</p>
            {receipt.client_phone && <p className="text-slate-600 tabular">{receipt.client_phone}</p>}
            {receipt.client_national_id && <p className="text-slate-600">ID: {receipt.client_national_id}</p>}
          </div>
          <div className="text-right">
            <p className="font-semibold text-slate-500">CUSTOMER / REGISTRATION</p>
            <p className="mt-1 text-sm font-semibold tabular text-slate-900">{receipt.registration_no}</p>
          </div>
        </div>

        {/* ---------- service ---------- */}
        <table className="mt-5 w-full border-collapse text-sm">
          <thead>
            <tr className="bg-navy-900 text-white">
              <th className="px-3 py-2 text-left text-xs font-semibold">DESCRIPTION</th>
              <th className="px-3 py-2 text-right text-xs font-semibold">AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-200">
              <td className="px-3 py-2.5">
                <p className="font-medium text-slate-900">{receipt.service_name}</p>
                {receipt.service_description && (
                  <p className="text-xs text-slate-500">{receipt.service_description}</p>
                )}
              </td>
              <td className="px-3 py-2.5 text-right font-medium tabular">{money(receipt.original_price)}</td>
            </tr>
          </tbody>
        </table>

        {/* ---------- totals ---------- */}
        <div className="mt-3 ml-auto w-full max-w-xs text-sm">
          <Row label="Total" value={money(receipt.original_price)} />
          {Number(receipt.discount_amount) > 0 && (
            <Row label="Discount" value={`− ${money(receipt.discount_amount)}`} accent />
          )}
          <div className="my-1 border-t border-slate-300" />
          <Row label="Final Amount" value={money(receipt.final_price)} strong />
          <Row label="Amount Paid" value={money(receipt.amount_paid)} strong />
          <Row label="Balance" value={money(receipt.balance)} />
          <Row label="Payment Method" value={PAYMENT_METHOD_LABELS[receipt.payment_method] ?? receipt.payment_method} />
          {receipt.transaction_ref && <Row label="Reference" value={receipt.transaction_ref} />}
        </div>

        {/* ---------- amount in words ---------- */}
        <div className="mt-4 rounded border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase text-slate-500">Amount in words</p>
          <p className="text-sm font-medium text-slate-800">{receipt.amount_in_words}</p>
        </div>

        {/* ---------- signature ---------- */}
        <div className="mt-6 flex items-end justify-between gap-6">
          <div className="text-xs text-slate-500">
            <p>Received by: <span className="font-medium text-slate-800">{receipt.cashier_name}</span></p>
            {receipt.stamp_url && <img src={receipt.stamp_url} alt="" className="mt-2 h-16 object-contain" />}
          </div>
          <div className="text-center">
            {receipt.signature_url && (
              <img src={receipt.signature_url} alt="" className="mx-auto h-12 object-contain" />
            )}
            <div className="mt-1 w-44 border-t border-slate-400 pt-1 text-[10px] text-slate-500">
              Authorised Signature
            </div>
          </div>
        </div>

        {receipt.receipt_footer && (
          <p className="mt-6 border-t border-slate-200 pt-3 text-center text-xs text-slate-500">
            {receipt.receipt_footer}
          </p>
        )}
      </div>
    </Modal>
  )
}
