// Badge renderer for dsh-plugin-doctor "verified" entries.
// The registry (data/verified.json) is the only source of truth; this script
// never invents a result. Usage: node scripts/badge.mjs <owner>/<repo> [outfile]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const LABEL = 'dsh-doctor'
export const COLORS = { pass: '#2da44e', warn: '#bf8700', fail: '#cf222e', 'no-data': '#6e7781' }
export const MESSAGES = { pass: 'R+K pass', warn: 'R+K warn', fail: 'R+K fail', 'no-data': 'no-data' }

const escape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const width = (text) => Math.round(11 + text.length * 6.6)

export function renderBadge(result) {
  const state = Object.hasOwn(COLORS, result) ? result : 'no-data'
  const message = MESSAGES[state]
  const color = COLORS[state]
  const w1 = width(LABEL)
  const w2 = width(message)
  const total = w1 + w2
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="20" role="img" aria-label="${escape(LABEL)}: ${escape(message)}">
  <linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
  <clipPath id="r"><rect width="${total}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)"><rect width="${w1}" height="20" fill="#3b3f46"/><rect x="${w1}" width="${w2}" height="20" fill="${color}"/><rect width="${total}" height="20" fill="url(#s)"/></g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${w1 / 2}" y="14">${escape(LABEL)}</text><text x="${w1 + w2 / 2}" y="14">${escape(message)}</text>
  </g>
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
