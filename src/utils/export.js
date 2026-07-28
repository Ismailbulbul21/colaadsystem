/**
 * CSV export. Values are quoted and internal quotes doubled so that a client
 * name containing a comma (very common here) cannot break the file.
 */
function escapeCell(value) {
  if (value == null) return ''
  const s = String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function plainValue(row, column) {
  if (column.exportValue) return column.exportValue(row)
  const raw = row[column.key]
  if (raw == null) return ''
  if (typeof raw === 'object') return JSON.stringify(raw)
  return raw
}

export function exportToCsv(rows, columns, fileName = 'export') {
  const header = columns.map((c) => escapeCell(c.header)).join(',')
  const body = rows
    .map((row) => columns.map((c) => escapeCell(plainValue(row, c))).join(','))
    .join('\n')

  // BOM so Excel opens Somali and accented characters correctly
  const blob = new Blob(['﻿' + header + '\n' + body], {
    type: 'text/csv;charset=utf-8;',
  })
  downloadBlob(blob, `${fileName}-${new Date().toISOString().slice(0, 10)}.csv`)
}

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Revoking immediately can cancel the download in Firefox
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * PDF export of a printable node. jsPDF and html2canvas are ~600 KB together,
 * so they are imported only when an employee actually clicks Download PDF.
 */
export async function exportNodeToPdf(node, fileName = 'document') {
  if (!node) throw new Error('Nothing to export.')
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ])

  const canvas = await html2canvas(node, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  })

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 10
  const usableWidth = pageWidth - margin * 2
  const imgHeight = (canvas.height * usableWidth) / canvas.width
  const image = canvas.toDataURL('image/png')

  if (imgHeight <= pageHeight - margin * 2) {
    pdf.addImage(image, 'PNG', margin, margin, usableWidth, imgHeight)
  } else {
    // Long reports spill onto extra pages instead of being squashed
    let remaining = imgHeight
    let position = margin
    while (remaining > 0) {
      pdf.addImage(image, 'PNG', margin, position, usableWidth, imgHeight)
      remaining -= pageHeight - margin * 2
      if (remaining > 0) {
        pdf.addPage()
        position = margin - (imgHeight - remaining)
      }
    }
  }

  pdf.save(`${fileName}.pdf`)
}
