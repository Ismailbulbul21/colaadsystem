import { useMemo } from 'react'
import { Input, Textarea, Select, Checkbox } from '../ui/Field'
import { Skeleton } from '../feedback/Skeleton'

/**
 * Renders whatever the Admin has defined for the selected service.
 * Nothing about House Transfer, Power of Attorney or any other document is
 * written into this component — it only knows how to draw a field.
 */
export default function DynamicServiceFields({ fields, values, onChange, errors = {}, loading }) {
  const sections = useMemo(() => {
    const map = new Map()
    for (const f of fields ?? []) {
      const key = f.section || 'Service Information'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(f)
    }
    return Array.from(map, ([name, items]) => ({ name, items }))
  }, [fields])

  if (loading) {
    return (
      <div className="card p-6 space-y-4">
        <Skeleton className="h-4 w-40" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="mb-2 h-3.5 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!fields?.length) {
    return (
      <div className="card border-dashed p-6 text-center">
        <p className="text-sm text-slate-500">
          This service has no extra information fields yet.
        </p>
        <p className="mt-1 text-xs text-slate-400">
          An Administrator can add them under Services → Fields, with no code change.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {sections.map((section) => (
        <div key={section.name} className="card p-6">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">{section.name}</h3>

          <div className="grid gap-4 sm:grid-cols-2">
            {section.items.map((f) => {
              const value = values[f.field_key] ?? ''
              const error = errors[f.field_key]
              const common = {
                key: f.id,
                label: f.label,
                required: f.is_required,
                error,
                hint: f.help_text,
                placeholder: f.placeholder || undefined,
              }

              switch (f.field_type) {
                case 'textarea':
                  return (
                    <Textarea
                      {...common}
                      wrapperClassName="sm:col-span-2"
                      value={value}
                      onChange={(e) => onChange(f.field_key, e.target.value)}
                    />
                  )
                case 'select':
                  return (
                    <Select
                      {...common}
                      placeholder="Select…"
                      options={(Array.isArray(f.options) ? f.options : []).map((o) =>
                        typeof o === 'string' ? { value: o, label: o } : o,
                      )}
                      value={value}
                      onChange={(e) => onChange(f.field_key, e.target.value)}
                    />
                  )
                case 'checkbox':
                  return (
                    <Checkbox
                      key={f.id}
                      label={f.label}
                      hint={f.help_text}
                      checked={value === 'true' || value === true}
                      onChange={(e) => onChange(f.field_key, String(e.target.checked))}
                    />
                  )
                case 'number':
                  return (
                    <Input
                      {...common}
                      type="number"
                      step="any"
                      value={value}
                      onChange={(e) => onChange(f.field_key, e.target.value)}
                    />
                  )
                case 'date':
                  return (
                    <Input
                      {...common}
                      type="date"
                      value={value}
                      onChange={(e) => onChange(f.field_key, e.target.value)}
                    />
                  )
                case 'phone':
                  return (
                    <Input
                      {...common}
                      type="tel"
                      inputMode="tel"
                      value={value}
                      onChange={(e) => onChange(f.field_key, e.target.value)}
                    />
                  )
                default:
                  return (
                    <Input
                      {...common}
                      value={value}
                      onChange={(e) => onChange(f.field_key, e.target.value)}
                    />
                  )
              }
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
