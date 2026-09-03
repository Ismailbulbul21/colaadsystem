/**
 * Money written out in Somali words, for the line every notary document
 * carries under its amount:
 *
 *   $30,000.00  ->  Soddon Kun oo Doolar Mareykan ah
 *   $8,050.00   ->  Siddeed Kun iyo Konton oo Doolar Mareykan ah
 *
 * Somali puts the unit BEFORE the ten and joins with "iyo": 25 is
 * "shan iyo labaatan" (five and twenty), not "labaatan shan". The office's
 * own files disagree with each other on this -- one reads "Shan iyo Labaatan"
 * and another "Afartan iyo Afar" -- and the office chose the standard
 * units-first form everywhere.
 */

const UNITS = ['', 'kow', 'laba', 'saddex', 'afar', 'shan', 'lix', 'toddoba',
  'siddeed', 'sagaal']

const TENS = ['', 'toban', 'labaatan', 'soddon', 'afartan', 'konton', 'lixdan',
  'toddobaatan', 'siddeetan', 'sagaashan']

/** 1-99. Units come first: 25 = "shan iyo labaatan". */
function underHundred(n) {
  if (n < 10) return UNITS[n]
  if (n % 10 === 0) return TENS[Math.floor(n / 10)]
  return `${UNITS[n % 10]} iyo ${TENS[Math.floor(n / 10)]}`
}

/** 1-999. One hundred is plain "boqol", never "kow boqol". */
function underThousand(n) {
  const hundreds = Math.floor(n / 100)
  const rest = n % 100
  const parts = []
  if (hundreds === 1) parts.push('boqol')
  else if (hundreds > 1) parts.push(`${UNITS[hundreds]} boqol`)
  if (rest) parts.push(underHundred(rest))
  return parts.join(' iyo ')
}

/** Whole numbers of any size the office will realistically write. */
export function somaliNumber(value) {
  const n = Math.floor(Math.abs(Number(value) || 0))
  if (n === 0) return 'eber'

  const groups = [
    [1_000_000_000, 'balyan'],
    [1_000_000, 'malyan'],
    [1_000, 'kun'],
  ]

  const parts = []
  let rest = n
  for (const [size, label] of groups) {
    const count = Math.floor(rest / size)
    if (count) {
      // "kun" alone for exactly one thousand, as Somali does not say
      // "kow kun"; the same for a single million.
      parts.push(count === 1 ? label : `${underThousand(count)} ${label}`)
      rest %= size
    }
  }
  if (rest) parts.push(underThousand(rest))

  return parts.join(' iyo ')
}

// Joining words stay lower case, the way the office writes them:
// "Soddon Kun oo Doolar Mareykan ah", not "Soddon Kun Oo Doolar Mareykan Ah".
const CONNECTORS = new Set(['iyo', 'oo', 'ah'])

function titleCase(text) {
  return text
    .split(' ')
    .map((w) => (CONNECTORS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
}

/**
 * The full line as it appears on the document.
 *
 * Cents close their own phrase rather than trailing the dollars, because
 * "kow iyo konton senti" reads as fifty-one cents when it means one dollar
 * fifty. The office's documents are all whole dollars, so nothing is printed
 * about cents unless there actually are some.
 */
export function somaliMoneyWords(value, { capitalise = true } = {}) {
  const amount = Math.abs(Number(value) || 0)
  const whole = Math.floor(amount)
  const cents = Math.round((amount - whole) * 100)

  let words = `${somaliNumber(whole)} oo Doolar Mareykan ah`
  if (cents > 0) words += ` iyo ${somaliNumber(cents)} oo Senti ah`

  return capitalise ? titleCase(words) : words
}
