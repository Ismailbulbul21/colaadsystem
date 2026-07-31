import { useT } from '../../contexts/LanguageContext'

export default function FullPageLoader({ label }) {
  const t = useT()
  const text = label ?? t('app.loading')
  return (
    <div className="min-h-screen grid place-items-center bg-surface-muted">
      <div className="flex flex-col items-center gap-4">
        <div className="relative h-14 w-14">
          <div className="absolute inset-0 grid place-items-center rounded-2xl bg-white p-1.5 shadow-card">
            <img src="/logo.jpg" alt="" className="h-full w-full object-contain" />
          </div>
          <div className="absolute -inset-1.5 rounded-2xl border-2 border-navy-200 border-t-navy-700 animate-spin" />
        </div>
        <p className="text-sm text-slate-500">{text}…</p>
      </div>
    </div>
  )
}
