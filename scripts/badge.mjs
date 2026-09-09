// Badge renderer for dsh-plugin-doctor "verified" entries.
// The registry (data/verified.json) is the only source of truth; this script
// never invents a result. Usage: node scripts/badge.mjs <owner>/<repo> [outfile]
//
// Design (2026-09-09, chosen by vision-model review of rendered candidates,
// benchmarked against the ecosystem's two modern badges — dsh.directory and
// awesome-dsh-plugin):
//   grammar  monospace UPPERCASE + letter-spacing + a mark + soft 5px corners
//   left     platinum/silver field + deep-navy text + shield-check mark
//            (五行 金行主导 = 白/银/铂金; 水行 = 墨蓝)
//   right    one solid state block, GitHub-conventional colors
//            (绿 / 橙 / 红 / 灰) with the state word + a drawn glyph
//   glyph    check / bang / cross / dash as paths, so the state never depends
//            on color alone and no font glyph is required
// The 1px outer border is load-bearing: without it the platinum field vanishes
// on a white README surface.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const LABEL = 'DSH DOCTOR'
export const PLATINUM = ['#ffffff', '#eef2f7', '#c9d4e2'] // 银白 → 铂金（金行）
export const LABEL_TEXT = '#0b1f3a' // 墨蓝（水行）
export const LABEL_BORDER = '#8fa0b5'
export const COLORS = {
  pass: ['#047857', '#065f46'],
  warn: ['#ea580c', '#c2410c'],
  fail: ['#dc2626', '#b91c1c'],
  'no-data': ['#6b7280', '#4b5563'],
}
export const MESSAGES = { pass: 'PASSING', warn: 'WARNING', fail: 'FAILING', 'no-data': 'NO DATA' }
const ARIA = { pass: 'passing', warn: 'warning', fail: 'failing', 'no-data': 'no data' }

const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace"
const CW = 7.2 // advance width of one monospace char at 10.5px with 0.9 letter-spacing

const GLYPHS = {
  pass: (x, y, s, c) =>
    `<path d="M${x} ${y} l${1.7 * s} ${1.8 * s} l${3.0 * s} ${-3.5 * s}" fill="none" stroke="${c}" stroke-width="${1.6 * s}" stroke-linecap="round" stroke-linejoin="round"/>`,
  warn: (x, y, s, c) =>
    `<path d="M${x + 2.6 * s} ${y - 2.0 * s} v${3.6 * s}" stroke="${c}" stroke-width="${1.7 * s}" stroke-linecap="round"/><circle cx="${x + 2.6 * s}" cy="${y + 3.2 * s}" r="${0.95 * s}" fill="${c}"/>`,
  fail: (x, y, s, c) =>
    `<path d="M${x} ${y - 1.8 * s} l${3.9 * s} ${3.9 * s} M${x + 3.9 * s} ${y - 1.8 * s} l${-3.9 * s} ${3.9 * s}" stroke="${c}" stroke-width="${1.7 * s}" stroke-linecap="round"/>`,
  'no-data': (x, y, s, c) =>
    `<path d="M${x} ${y + 1.5 * s} h${4.2 * s}" stroke="${c}" stroke-width="${1.7 * s}" stroke-linecap="round"/>`,
}
// shield-check mark, ~10x11
const shield = (x, y, color) => `<g transform="translate(${x},${y})">
  <path d="M5 0.6 L9.4 2.1 V5.6 C9.4 8 7.5 9.7 5 10.4 C2.5 9.7 0.6 8 0.6 5.6 V2.1 Z" fill="none" stroke="${color}" stroke-width="1.15" stroke-linejoin="round"/>
  <path d="M2.9 5.4 l1.5 1.6 l2.7 -3.1" fill="none" stroke="${color}" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round"/>
</g>`

const escape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const mw = (t) => Math.round(t.length * CW)

export function renderBadge(result) {
  const state = Object.hasOwn(COLORS, result) ? result : 'no-data'
  const message = MESSAGES[state]
  const [v1, v2] = COLORS[state]
  const [p0, p1, p2] = PLATINUM
  const lw = 20 + mw(LABEL) + 10
  const vw = 12 + mw(message) + 14
  const total = lw + vw
  const h = 20
  const uid = state.replace(/[^a-z]/gi, '')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="${h}" role="img" aria-label="dsh-doctor: ${escape(ARIA[state])}">
  <title>dsh-doctor: ${escape(ARIA[state])}</title>
  <defs>
    <linearGradient id="pL-${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p0}"/><stop offset="0.5" stop-color="${p1}"/><stop offset="1" stop-color="${p2}"/></linearGradient>
    <linearGradient id="pV-${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${v1}"/><stop offset="1" stop-color="${v2}"/></linearGradient>
  </defs>
  <clipPath id="pC-${uid}"><rect width="${total}" height="${h}" rx="5" fill="#fff"/></clipPath>
  <g clip-path="url(#pC-${uid})">
    <rect width="${lw}" height="${h}" fill="url(#pL-${uid})"/>
    <rect width="${lw}" height="1" fill="#ffffff" opacity="0.7"/>
    <rect x="${lw}" width="${vw}" height="${h}" fill="url(#pV-${uid})"/>
    <rect x="${lw}" width="${vw}" height="1" fill="#ffffff" opacity="0.22"/>
  </g>
  <rect x="0.5" y="0.5" width="${total - 1}" height="${h - 1}" rx="5" fill="none" stroke="${LABEL_BORDER}" stroke-opacity="0.85"/>
  ${shield(6, 4.6, '#1f3a5f')}
  <text x="20" y="14" font-family="${MONO}" font-size="10.5" font-weight="600" letter-spacing="0.9" fill="${LABEL_TEXT}">${escape(LABEL)}</text>
  ${GLYPHS[state](lw + 8, 8.8, 0.9, '#ffffff')}
  <text x="${lw + 13 + (vw - 13) / 2}" y="14" text-anchor="middle" font-family="${MONO}" font-size="10.5" font-weight="600" letter-spacing="0.9" fill="#ffffff">${escape(message)}</text>
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
