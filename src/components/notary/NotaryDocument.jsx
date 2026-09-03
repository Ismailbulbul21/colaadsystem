import { Letterhead } from '../finance/PrintableDocs'
import { formatDate } from '../../utils/format'

/**
 * Some of the office's deeds lay the land details out as a boxed table rather
 * than a paragraph — Hibo and the Munijibaale sale both do. A template marks
 * one up as
 *
 *   [[TABLE:TILMAAMAHA DHULKA]]
 *   Ku yaalla|Hodan, Muqdisho
 *   Lotto No|1752-K
 *   [[/TABLE]]
 *
 * so the wording and the layout both stay in the editable template instead of
 * being hard-coded per document type.
 */
const TABLE_BLOCK = /\[\[TABLE(?::([^\]]*))?\]\]\n?([\s\S]*?)\[\[\/TABLE\]\]/g

function splitIntoBlocks(text) {
  const blocks = []
  let last = 0
  for (const m of (text ?? '').matchAll(TABLE_BLOCK)) {
    if (m.index > last) blocks.push({ kind: 'text', text: text.slice(last, m.index) })
    blocks.push({
      kind: 'table',
      caption: (m[1] ?? '').trim(),
      rows: m[2].split('\n')
        .map((l) => l.trim()).filter(Boolean)
        .map((l) => { const i = l.indexOf('|'); return i === -1 ? [l, ''] : [l.slice(0, i).trim(), l.slice(i + 1).trim()] }),
    })
    last = m.index + m[0].length
  }
  if (last < (text ?? '').length) blocks.push({ kind: 'text', text: text.slice(last) })
  return blocks
}

function LandTable({ caption, rows }) {
  return (
    <table className="w-full border border-ink-800 text-[12px]">
      {caption && (
        <thead>
          <tr>
            <th colSpan={2}
                className="border border-ink-800 bg-ink-100 px-2 py-1 text-center font-bold uppercase">
              {caption}
            </th>
          </tr>
        </thead>
      )}
      <tbody>
        {rows.map(([label, value], i) => (
          <tr key={i}>
            <td className="w-2/5 border border-ink-800 px-2 py-1 font-semibold">{label}</td>
            <td className="border border-ink-800 px-2 py-1">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Text and tables in the order the template puts them. */
function DocumentBody({ text }) {
  const blocks = splitIntoBlocks(text)
  // Consecutive tables sit side by side, as they do on the office's paper.
  const out = []
  for (let i = 0; i < blocks.length; i += 1) {
    const b = blocks[i]
    if (b.kind === 'table' && blocks[i + 1]?.kind === 'table') {
      out.push(
        <div key={i} className="my-4 grid gap-3 sm:grid-cols-2">
          <LandTable {...b} />
          <LandTable {...blocks[i + 1]} />
        </div>,
      )
      i += 1
    } else if (b.kind === 'table') {
      out.push(<div key={i} className="my-4"><LandTable {...b} /></div>)
    } else if (b.text.trim()) {
      out.push(<div key={i} className="whitespace-pre-line">{b.text.trim()}</div>)
    }
  }
  return <div className="space-y-3">{out}</div>
}

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

      <div className="mt-5 text-[13px] leading-[1.9]">
        <DocumentBody text={bodyText} />
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
