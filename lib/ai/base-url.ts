/**
 * SSRF guard for the OpenAI-compatible base URL (the saved API key is sent
 * there). Isomorphic: the settings form shows the same message the API
 * returns. A literal check only: host names are not resolved here.
 */

export const AI_BASE_URL_MAX = 500

/** IPv4 ranges a base URL may never point at: [network, prefix bits]. */
const BLOCKED_V4: readonly (readonly [string, number])[] = [
  ["0.0.0.0", 8], // "this network", incl. 0.0.0.0
  ["10.0.0.0", 8],
  ["100.64.0.0", 10], // carrier-grade NAT, incl. cloud metadata 100.100.100.200
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // link-local, incl. cloud metadata 169.254.169.254
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
]

const v4Number = (ip: string): number | null => {
  const parts = ip.split(".")
  if (parts.length !== 4) return null
  let n = 0
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null
    const octet = Number(part)
    if (octet > 255) return null
    n = n * 256 + octet
  }
  return n
}

const inV4Range = (ip: number, [network, bits]: readonly [string, number]) => {
  const size = 2 ** (32 - bits)
  const start = v4Number(network)!
  return ip >= start && ip < start + size
}

const blockedV4 = (n: number) => BLOCKED_V4.some((range) => inV4Range(n, range))

/** Eight 16-bit groups of an IPv6 literal (as the URL parser prints it), or null. */
function v6Groups(ip: string): number[] | null {
  let text = ip.toLowerCase()
  // A trailing dotted IPv4 part (the URL parser rewrites it, but be safe).
  const dotted = /^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/.exec(text)
  if (dotted) {
    const n = v4Number(dotted[2])
    if (n === null) return null
    text = `${dotted[1]}${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`
  }
  const halves = text.split("::")
  if (halves.length > 2) return null
  const head = halves[0] ? halves[0].split(":") : []
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : []
  const missing = 8 - head.length - tail.length
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null
  const groups = [...head, ...Array<string>(missing).fill("0"), ...tail]
  if (!groups.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return null
  return groups.map((g) => parseInt(g, 16))
}

function blockedV6(groups: number[]): boolean {
  if (groups.slice(0, 7).every((g) => g === 0))
    return groups[7] === 0 || groups[7] === 1 // :: and ::1
  // IPv4-mapped ::ffff:a.b.c.d
  if (groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff)
    return blockedV4(groups[6] * 65536 + groups[7])
  if ((groups[0] & 0xfe00) === 0xfc00) return true // fc00::/7 unique local
  if ((groups[0] & 0xffc0) === 0xfe80) return true // fe80::/10 link-local
  return false
}

const LOCAL_NAME = /(^|\.)(localhost|local|internal)$/

const isLocalhost = (host: string) =>
  host === "localhost" || host === "127.0.0.1" || host === "[::1]"

/** Trims and drops trailing "/". */
export function normaliseBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, "")
}

/**
 * Why `raw` cannot be used as a base URL, or null when it can: https only,
 * no credentials, query or fragment, and no private, loopback, link-local or
 * internal host. `allowLocalHttp` (development only) also allows
 * http://localhost, for a model server on the developer's machine.
 */
export function baseUrlProblem(
  raw: string,
  opts: { allowLocalHttp: boolean }
): string | null {
  const text = raw.trim()
  if (text === "") return "Enter the provider's base URL"
  if (text.length > AI_BASE_URL_MAX)
    return `At most ${AI_BASE_URL_MAX} characters`
  let url: URL
  try {
    url = new URL(text)
  } catch {
    return "Enter a full URL, like https://api.example.com/v1"
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "")
  const devLocal = opts.allowLocalHttp && isLocalhost(host)
  if (url.protocol !== "https:" && !(url.protocol === "http:" && devLocal))
    return "Use an https:// address"
  if (url.username || url.password)
    return "Leave the user name and password out of the address"
  if (url.search || url.hash || text.includes("?") || text.includes("#"))
    return "Leave out the ? and # parts"
  if (devLocal) return null

  const blocked =
    "This address is not allowed (private, local or metadata address)"
  if (host.startsWith("[")) {
    const groups = v6Groups(host.slice(1, -1))
    if (!groups || blockedV6(groups)) return blocked
    return null
  }
  const v4 = v4Number(host)
  if (v4 !== null) return blockedV4(v4) ? blocked : null
  if (LOCAL_NAME.test(host) || !host.includes(".")) return blocked
  return null
}
