import { useEffect, useState } from 'react'

/**
 * Renders a QR code as a plain <img>, which is what printing and the
 * html2canvas PDF path both handle reliably — a <canvas> often comes out
 * blank in one or the other.
 *
 * The library is imported lazily so it stays out of the main bundle; only
 * screens that actually show a receipt or invoice pay for it.
 */
export default function QrCode({ value, size = 96, className }) {
  const [dataUrl, setDataUrl] = useState(null)

  useEffect(() => {
    let cancelled = false
    if (!value) {
      setDataUrl(null)
      return
    }

    import('qrcode')
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(String(value), {
          width: size * 2, // drawn at 2x so it stays sharp on paper
          margin: 1,
          errorCorrectionLevel: 'M',
          color: { dark: '#0F2444', light: '#FFFFFF' },
        }),
      )
      .then((url) => !cancelled && setDataUrl(url))
      .catch(() => !cancelled && setDataUrl(null))

    return () => {
      cancelled = true
    }
  }, [value, size])

  if (!value) return null

  // Reserve the space while encoding so the printed layout never jumps
  if (!dataUrl) {
    return <div className={className} style={{ width: size, height: size }} aria-hidden />
  }

  return (
    <img
      src={dataUrl}
      alt="QR code"
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size }}
    />
  )
}
