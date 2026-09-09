// Badge renderer for dsh-plugin-doctor "verified" entries.
// The registry (data/verified.json) is the only source of truth; this script
// never invents a result. Usage: node scripts/badge.mjs <owner>/<repo> [outfile]
//
// Design (2026-09-09, chosen with a vision-model review of rendered candidates):
//   label  platinum/silver metallic field + deep-navy text
//          (五行: 金行主导 = 白/银/铂金; 水行 = 墨蓝)
//   value  GitHub-conventional status colors: green / amber / red / grey
//   text   passing / warning / failing / no data  (shields + GitHub Actions wording)
//   glyph  check / bang / cross drawn as paths, so the state never depends on
//          color alone and no font glyph is required
// The 1px outer border is load-bearing: without it the silver label vanishes on
// a white README surface (verified by rendering both variants side by side).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const LABEL = 'dsh-doctor'
export const LABEL_FILL = ['#f8fafc', '#cbd5e1'] // 银白 → 铂金（金行）
export const LABEL_TEXT = '#0b1f3a' // 墨蓝（水行）
export const LABEL_BORDER = '#8fa0b5'
export const COLORS = {
  pass: ['#047857', '#065f46'],
  warn: ['#ea580c', '#c2410c'],
  fail: ['#dc2626', '#b91c1c'],
  'no-data': ['#6b7280', '#4b5563'],
}
export const MESSAGES = { pass: 'passing', warn: 'warning', fail: 'failing', 'no-data': 'no data' }

const GLYPHS = {
  pass: (x, y, s, c) =>
    `<path d="M${x} ${y} l${1.8 * s} ${1.9 * s} l${3.2 * s} ${-3.7 * s}" fill="none" stroke="${c}" stroke-width="${1.6 * s}" stroke-linecap="round" stroke-linejoin="round"/>`,
  warn: (x, y, s, c) =>
    `<path d="M${x + 2.8 * s} ${y - 2.2 * s} v${3.9 * s}" stroke="${c}" stroke-width="${1.7 * s}" stroke-linecap="round"/><circle cx="${x + 2.8 * s}" cy="${y + 3.4 * s}" r="${1.0 * s}" fill="${c}"/>`,
  fail: (x, y, s, c) =>
    `<path d="M${x} ${y - 1.9 * s} l${4.1 * s} ${4.1 * s} M${x + 4.1 * s} ${y - 1.9 * s} l${-4.1 * s} ${4.1 * s}" stroke="${c}" stroke-width="${1.7 * s}" stroke-linecap="round"/>`,
  'no-data': (x, y, s, c) =>
    `<path d="M${x} ${y + 1.6 * s} h${4.4 * s}" stroke="${c}" stroke-width="${1.7 * s}" stroke-linecap="round"/>`,
}

const escape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const width = (text) => Math.round(11 + text.length * 6.6)

export function renderBadge(result) {
  const state = Object.hasOwn(COLORS, result) ? result : 'no-data'
  const message = MESSAGES[state]
  const [v1, v2] = COLORS[state]
  const [l1, l2] = LABEL_FILL
  const w1 = width(LABEL)
  const w2 = width(message) + 13
  const total = w1 + w2
  const h = 20
  const textX = w1 + 13 + (w2 - 13) / 2
  // Per-state ids: several badges inlined into one document must not share
  // gradient/clip ids (SVG ids are document-global and the first wins).
  const uid = state.replace(/[^a-z]/gi, '')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="${h}" role="img" aria-label="${escape(LABEL)}: ${escape(message)}">
  <title>${escape(LABEL)}: ${escape(message)}</title>
  <defs>
    <linearGradient id="dL-${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${l1}"/><stop offset="1" stop-color="${l2}"/></linearGradient>
    <linearGradient id="dV-${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${v1}"/><stop offset="1" stop-color="${v2}"/></linearGradient>
  </defs>
  <clipPath id="dR-${uid}"><rect width="${total}" height="${h}" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#dR-${uid})">
    <rect width="${w1}" height="${h}" fill="url(#dL-${uid})"/>
    <rect width="${w1}" height="9" fill="#ffffff" opacity="0.45"/>
    <rect y="${h - 2}" width="${w1}" height="2" fill="#0b1f3a" opacity="0.10"/>
    <rect x="${w1}" width="${w2}" height="${h}" fill="url(#dV-${uid})"/>
    <rect width="${total}" height="1" fill="#ffffff" opacity="0.14"/>
  </g>
  <rect x="0.5" y="0.5" width="${total - 1}" height="${h - 1}" rx="3" fill="none" stroke="${LABEL_BORDER}" stroke-opacity="0.85"/>
  <g fill="${LABEL_TEXT}" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11"><text x="${w1 / 2}" y="14">${escape(LABEL)}</text></g>
  <g fill="#ffffff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11"><text x="${textX}" y="14">${escape(message)}</text></g>
  ${GLYPHS[state](w1 + 8, h / 2 - 1.2, 0.95, '#ffffff')}
</svg>
`
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const root = path.resolve(import.meta.dirname, '..')
  const target = process.argv[2]
  if (!target) {
    console.error('usage: node scripts/badge.mjs <owner>/<repo> [outfile]')
    process.exit(1)
  }
  const registry = JSON.parse(fs.readFileSync(path.join(root, 'data/verified.json'), 'utf8'))
  const entry = registry.entries.find((e) => e.repo === target)
  const state = entry ? entry.result : 'no-data'
  const out = process.argv[3] || path.join(root, 'badges', `${target.replace('/', '__')}.svg`)
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, renderBadge(state))
  console.log(`${target}: ${state} -> ${out}`)
}
