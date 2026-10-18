import "server-only"

import { lookup as dnsLookup } from "node:dns/promises"
import { BlockList, isIP } from "node:net"

/**
 * Addresses an admin-entered SMTP host may never reach in production: the
 * app's own loopback, link-local (incl. the cloud metadata service at
 * 169.254.169.254) and other metadata endpoints. RFC 1918 stays allowed:
 * on-premises mail relays are common.
 */
const BLOCKED = new BlockList()
BLOCKED.addSubnet("127.0.0.0", 8, "ipv4")
BLOCKED.addSubnet("0.0.0.0", 8, "ipv4")
BLOCKED.addSubnet("169.254.0.0", 16, "ipv4")
BLOCKED.addAddress("100.100.100.200", "ipv4") // Alibaba Cloud metadata
BLOCKED.addAddress("::1", "ipv6")
BLOCKED.addAddress("::", "ipv6")
BLOCKED.addSubnet("fe80::", 10, "ipv6")
BLOCKED.addAddress("fd00:ec2::254", "ipv6") // AWS IMDS over IPv6

const MAPPED_V4 = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i

export function isBlockedSmtpAddress(address: string): boolean {
  const bare = address.replace(/^\[|\]$/g, "")
  const mapped = MAPPED_V4.exec(bare)
  if (mapped) return BLOCKED.check(mapped[1], "ipv4")
  const family = isIP(bare)
  if (family === 4) return BLOCKED.check(bare, "ipv4")
  if (family === 6) return BLOCKED.check(bare, "ipv6")
  return false
}

const isLocalhostName = (host: string) => {
  const name = host.toLowerCase().replace(/\.$/, "")
  return name === "localhost" || name.endsWith(".localhost")
}

/** Literal loopback (no DNS): localhost, 127.0.0.0/8, ::1. */
export function isLoopbackHost(host: string): boolean {
  if (isLocalhostName(host)) return true
  const bare = host.replace(/^\[|\]$/g, "")
  const mapped = MAPPED_V4.exec(bare)
  const v4 = mapped ? mapped[1] : bare
  if (isIP(v4) === 4) return v4.startsWith("127.")
  return bare === "::1"
}

export type SmtpTarget =
  { kind: "ok"; address: string } | { kind: "blocked" } | { kind: "unresolved" }

export type LookupAll = (
  host: string
) => Promise<ReadonlyArray<{ address: string }>>

const lookupAll: LookupAll = (host) =>
  dnsLookup(host, { all: true, verbatim: true })

/**
 * Lead emails are sent inline in the public POST, so a slow resolver must
 * not hold the visitor's request: past this the host counts as unresolved.
 */
export const SMTP_LOOKUP_TIMEOUT_MS = 3_000

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("DNS lookup timed out")), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

export const isProduction = () => process.env.NODE_ENV === "production"

/**
 * Where to connect for `host`. Outside production (dev Mailpit on
 * 127.0.0.1) the host is used as is. In production every resolved address
 * must be allowed, and the caller connects to the returned address (no
 * second lookup, so DNS cannot be rebound between check and connect).
 */
export async function resolveSmtpTarget(
  host: string,
  opts: { production?: boolean; lookup?: LookupAll; timeoutMs?: number } = {}
): Promise<SmtpTarget> {
  if (!(opts.production ?? isProduction())) return { kind: "ok", address: host }
  if (isLocalhostName(host)) return { kind: "blocked" }
  if (isIP(host.replace(/^\[|\]$/g, "")))
    return isBlockedSmtpAddress(host)
      ? { kind: "blocked" }
      : { kind: "ok", address: host }
  let addresses: ReadonlyArray<{ address: string }>
  try {
    addresses = await withTimeout(
      (opts.lookup ?? lookupAll)(host),
      opts.timeoutMs ?? SMTP_LOOKUP_TIMEOUT_MS
    )
  } catch {
    return { kind: "unresolved" }
  }
  if (addresses.length === 0) return { kind: "unresolved" }
  if (addresses.some((a) => isBlockedSmtpAddress(a.address)))
    return { kind: "blocked" }
  return { kind: "ok", address: addresses[0].address }
}
