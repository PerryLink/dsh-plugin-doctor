// Shared by tests/spec-drift.mjs (the guard) and tests/spec-drift-meta.mjs (the
// guard's own test). Kept in its own module with no side effects, so importing
// it cannot trigger a test run or a process.exit.

/** Matches a single ID, or an ID range written with an en/em dash or a hyphen. */
export const ID_TOKEN = /[A-Z]{1,3}\d+(?:\s*[\u2013\u2014-]\s*[A-Z]{1,3}\d+)?/gu

/**
 * Expand one token from a SPEC §1 list.
 * `K1–K9` -> ['K1'…'K9']; `R0` -> ['R0'].
 * A range spanning two different prefixes is returned unexpanded rather than
 * guessed at, so a malformed declaration cannot silently become a valid one.
 * @param {string} token
 * @returns {string[]}
 */
export function expandIdToken(token) {
  const range = token.match(/^([A-Z]{1,3})(\d+)\s*[\u2013\u2014-]\s*([A-Z]{1,3})(\d+)$/u)
  if (!range) return [token]
  const [, p1, n1, p2, n2] = range
  if (p1 !== p2) return [token]
  const out = []
  for (let n = Number(n1); n <= Number(n2); n++) out.push(`${p1}${n}`)
  return out
}

/** Parse a SPEC §1 backticked token list into individual check IDs. */
export function parseGateList(tokenList) {
  return [...tokenList.matchAll(ID_TOKEN)].flatMap((m) => expandIdToken(m[0].replace(/\s+/gu, '')))
}
