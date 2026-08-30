import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'

import { useOfficeSettings } from '../../contexts/OfficeSettingsContext'
import { formatDate } from '../../utils/format'
import { amountInWords } from '../../services/billingService'

/**
 * The printed invoice and receipt.
 *
 * Both share the office letterhead and are laid out to the office's own
 * design. Every figure comes from the saved record — nothing is recomputed
 * here, so the paper always agrees with the ledger.
 */

/**
 * The office's official letterhead: the republic line across the top, the
 * Somali title on the left, the seal in the middle and the Arabic title on
 * the right. Drawn rather than dropped in as a picture so it stays sharp at
 * any print size and the address still comes from Office Settings.
 */
export function Letterhead() {
  const { settings } = useOfficeSettings()
  return (
    <header>
      <p className="text-center text-sm font-bold tracking-wide text-ink-900">
        JAMHUURIYADDA SOOMAALIYA
      </p>

      <div className="mt-1 flex items-center justify-between gap-4">
        <div className="flex-1 text-center text-[11px] font-bold leading-tight text-navy-900">
          <p>Xafiiska Nootaayada iyo Latalinta</p>
          <p>Arrimaha Sharciga ee Olad</p>
          <p className="mt-1.5 font-semibold text-ink-700">MOGADISHU SOMALIA</p>
        </div>

        <div className="flex shrink-0 flex-col items-center gap-0.5">
          {settings?.logo_url && (
            <img src={settings.logo_url} alt="" className="h-16 w-16 object-contain" />
          )}
          <span className="max-w-[8rem] bg-emerald-800 px-1.5 py-0.5 text-center text-[6px] font-bold uppercase leading-tight text-white">
            Olad Law Office and Public Notary Service
          </span>
        </div>

        {/* dir=rtl so the Arabic lays out right-to-left as it must. */}
        <div dir="rtl" lang="ar"
             className="flex-1 text-center text-[13px] font-bold leading-relaxed text-navy-900">
          <p>مكتب عولاد للاستشارات</p>
          <p>القانونية وتوثيق العقود</p>
          <p className="mt-1 text-[11px] font-semibold text-ink-700">مقديشو - الصومال</p>
        </div>
      </div>

      <div className="mt-2 h-1 bg-navy-900" />

      {(settings?.address || settings?.phone || settings?.email) && (
        <p className="mt-1.5 flex flex-wrap justify-center gap-x-4 gap-y-0.5 text-[10px] text-ink-500">
          {settings?.address && <span>{settings.address}</span>}
          {settings?.phone && <span>{settings.phone}</span>}
          {settings?.email && <span>{settings.email}</span>}
        </p>
      )}
    </header>
  )
}

/* ================================================================ invoice */

export function InvoiceDoc({ invoice }) {
  const { money } = useOfficeSettings()
  if (!invoice) return null

  // The office's design keeps the table a fixed height so every invoice
  // prints on one page whether it has one line or six.
  const blanks = Math.max(0, 5 - invoice.items.length)

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-ink-800">
      <Letterhead />

      <div className="mt-4 flex items-start justify-between gap-6">
        <h2 className="text-3xl font-bold text-navy-900">INVOICE</h2>
        <table className="text-xs">
          <tbody>
            <tr>
              <td className="pr-4 font-semibold text-ink-700">Invoice No:</td>
              <td className="font-semibold text-red-600">{invoice.invoice_no}</td>
            </tr>
            <tr>
              <td className="pr-4 font-semibold text-ink-700">Invoice Date:</td>
              <td>{formatDate(invoice.invoice_date)}</td>
            </tr>
            {invoice.due_date && (
              <tr>
                <td className="pr-4 font-semibold text-ink-700">Due Date:</td>
                <td>{formatDate(invoice.due_date)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6">
        <p className="mb-2 text-sm font-bold text-navy-800">Bill To:</p>
        <p className="text-sm">{invoice.bill_to_name}</p>
        {invoice.bill_to_address && (
          <p className="whitespace-pre-line text-sm text-ink-600">{invoice.bill_to_address}</p>
        )}
        {invoice.bill_to_phone && (
          <p className="text-sm text-ink-600">TEL: {invoice.bill_to_phone}</p>
        )}
      </div>

      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="bg-navy-900 text-white">
            <th className="px-3 py-2 text-left font-semibold">No.</th>
            <th className="px-3 py-2 text-left font-semibold">Description</th>
            <th className="px-3 py-2 text-center font-semibold">Qty</th>
            <th className="px-3 py-2 text-right font-semibold">Unit Price</th>
            <th className="px-3 py-2 text-right font-semibold">Amount (USD)</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((it, i) => (
            <tr key={it.id ?? i} className="border-b border-dashed border-ink-200">
              <td className="px-3 py-2">{i + 1}</td>
              <td className="px-3 py-2">{it.description}</td>
              <td className="px-3 py-2 text-center tabular">{Number(it.qty)}</td>
              <td className="px-3 py-2 text-right tabular">{money(it.unit_price)}</td>
              <td className="px-3 py-2 text-right tabular">{money(it.amount)}</td>
            </tr>
          ))}
          {Array.from({ length: blanks }).map((_, i) => (
            <tr key={`blank-${i}`} className="border-b border-dashed border-ink-200">
              <td className="px-3 py-3" colSpan={5}>&nbsp;</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex justify-end">
        <table className="w-72 text-sm">
          <tbody>
            <tr className="border-b border-ink-200">
              <td className="py-1.5">Subtotal:</td>
              <td className="py-1.5 text-right tabular">{money(invoice.subtotal)}</td>
            </tr>
            <tr className="border-b border-ink-200">
              <td className="py-1.5">Discount:</td>
              <td className="py-1.5 text-right tabular">{money(invoice.discount)}</td>
            </tr>
            <tr className="border-b border-ink-200">
              <td className="py-1.5">Tax ({Number(invoice.tax_percent)}%):</td>
              <td className="py-1.5 text-right tabular">{money(invoice.tax_amount)}</td>
            </tr>
            <tr className="bg-navy-50">
              <td className="py-2 pl-2 font-bold text-navy-900">Total Amount:</td>
              <td className="py-2 pr-2 text-right text-base font-bold tabular text-navy-900">
                {money(invoice.total)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-6">
        <p className="text-sm font-bold text-navy-800">Amount in Words:</p>
        <p className="text-sm">{amountInWords(invoice.total)}</p>
      </div>

      <div className="mt-6 flex items-end justify-between gap-8 border-t border-ink-200 pt-4">
        <div className="text-sm">
          <p className="mb-2 font-bold text-navy-800">Payment Details:</p>
          <p><span className="inline-block w-32 font-semibold">Paid By:</span>
            {invoice.paid_by ?? '—'}</p>
          <p><span className="inline-block w-32 font-semibold">Payment Method:</span>
            {invoice.method_name ?? '—'}</p>
        </div>
        <div className="w-56 border-t border-ink-400 pt-1 text-center text-xs text-ink-600">
          Authorized Signature
        </div>
      </div>

      <div className="mt-8 flex items-center gap-4">
        <span className="h-px flex-1 bg-navy-300" />
        <span className="font-serif text-xl italic text-navy-800">Thank you!</span>
        <span className="h-px flex-1 bg-navy-300" />
      </div>
    </div>
  )
}

/* ================================================================ receipt */

export function ReceiptDoc({ receipt }) {
  const { money } = useOfficeSettings()
  const canvasRef = useRef(null)

  // The office chose the QR to carry the receipt number alone, so it stays
  // scannable without depending on the site being reachable.
  useEffect(() => {
    if (!canvasRef.current || !receipt?.receipt_no) return
    QRCode.toCanvas(canvasRef.current, receipt.receipt_no, {
      width: 96, margin: 1, color: { dark: '#0F2444', light: '#ffffff' },
    }).catch(() => { /* a missing QR must never stop the receipt printing */ })
  }, [receipt?.receipt_no])

  if (!receipt) return null

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-ink-800">
      <Letterhead />

      <h2 className="mt-6 text-center text-4xl font-bold tracking-wide text-navy-900">
        RECEIPT
      </h2>

      <div className="mt-4 flex items-center justify-between text-sm">
        <p><span className="font-bold text-navy-800">Date:</span> {formatDate(receipt.receipt_date)}</p>
        <p>
          <span className="font-bold text-navy-800">Receipt No:</span>{' '}
          <span className="font-semibold text-red-600">{receipt.receipt_no}</span>
        </p>
      </div>

      <div className="my-4 border-t border-dashed border-ink-300" />

      <table className="w-full text-sm">
        <tbody>
          {[
            ['Received From', receipt.received_from],
            ['Payment For', receipt.payment_for || '—'],
            ['Payment Method', receipt.method_name || '—'],
            ['Reference', receipt.reference || 'N/A'],
          ].map(([label, value]) => (
            <tr key={label}>
              <td className="w-44 py-1.5 font-bold text-navy-800">{label}</td>
              <td className="w-4 py-1.5">:</td>
              <td className="py-1.5">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="my-4 border-t border-dashed border-ink-300" />

      <table className="w-full text-sm">
        <thead>
          <tr className="bg-navy-900 text-white">
            <th className="px-3 py-2 text-left font-semibold">Item</th>
            <th className="px-3 py-2 text-center font-semibold">Qty</th>
            <th className="px-3 py-2 text-right font-semibold">Amount (USD)</th>
          </tr>
        </thead>
        <tbody>
          {(receipt.items ?? []).map((it, i) => (
            <tr key={it.id ?? i} className="border-b border-dashed border-ink-200">
              <td className="px-3 py-2">{it.description}</td>
              <td className="px-3 py-2 text-center tabular">{Number(it.qty)}</td>
              <td className="px-3 py-2 text-right tabular">{money(it.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex items-center justify-between border-2 border-navy-900 px-4 py-3">
        <span className="text-xl font-bold text-navy-900">TOTAL</span>
        <span className="text-xl font-bold tabular text-navy-900">{money(receipt.total)}</span>
      </div>

      <div className="mt-4">
        <p className="text-sm font-bold text-navy-800">Amount in Words:</p>
        <p className="text-sm">{amountInWords(receipt.total)}</p>
      </div>

      <div className="mt-8 flex items-end justify-between gap-6">
        <canvas ref={canvasRef} className="h-24 w-24" />
        <span className="font-serif text-xl italic text-navy-800">Thank you!</span>
        <div className="w-56 border-t border-ink-400 pt-1 text-center text-xs text-ink-600">
          Authorized Signature
        </div>
      </div>
    </div>
  )
}
