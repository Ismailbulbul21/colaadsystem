import { Letterhead } from '../finance/PrintableDocs'
import { formatDate } from '../../utils/format'

/**
 * The legal document as it prints.
 *
 * Once finalised the wording comes from the stored text, never from the
 * template — so editing a template next year cannot restate a deed the
 * parties already signed. Before that it renders whatever the officer has
 * typed so far, which is what the preview step shows.
 */
export default function NotaryDocument({
  title, bodyText, attestationText, service, reference, notaryName,
}) {
  const witnesses = (service?.witnesses ?? []).filter(Boolean)
  const p1 = service?.party1 ?? {}
  const p2 = service?.party2 ?? {}
  const agent = service?.agent ?? {}
  const hasAgent = agent?.has_agent && agent?.name

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-ink-900">
      <Letterhead />

      <h2 className="mt-6 text-center text-base font-bold uppercase underline">
        UJEEDO : {title}
      </h2>

      <div className="mt-5 whitespace-pre-line text-[13px] leading-[1.9]">
        {bodyText}
      </div>

      {/* ---------------- signatures ---------------- */}
      <div className="mt-8 space-y-4 text-[13px]">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <span>
            <strong>{service?.party1_label ?? 'Iska Iibiyaha'}:</strong>{' '}
            {p1.name} <span className="text-ink-400">_______________</span>
          </span>
          <span>
            <strong>
              {hasAgent ? 'W/beeca' : (service?.party2_label ?? 'Gataha')}:
            </strong>{' '}
            {hasAgent ? agent.name : p2.name}{' '}
            <span className="text-ink-400">_______________</span>
          </span>
        </div>

        {witnesses.length > 0 && (
          <div className="flex flex-wrap gap-x-10 gap-y-3">
            {witnesses.map((w, i) => (
              <span key={i}>
                <strong>Marag{i + 1}:</strong> {w}{' '}
                <span className="text-ink-400">___________</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ---------------- reference block ---------------- */}
      <div className="mt-8 flex items-end justify-between text-[13px] font-semibold">
        <span>Rep. No. {reference ?? '—'}</span>
        <span>Tr. {formatDate(service?.document_date)}</span>
      </div>

      <p className="mt-6 text-center text-sm font-bold underline">
        SUGITAANKA XAFIISKA NOOTAAYADA COLAAD
      </p>

      <div className="mt-3 whitespace-pre-line text-[13px] leading-[1.9]">
        {attestationText}
      </div>

      <p className="mt-8 text-center text-[13px] font-semibold">
        {notaryName ?? service?.notary_name ?? 'Dr. Mohamed Abdi Dahir'}
      </p>
    </div>
  )
}
