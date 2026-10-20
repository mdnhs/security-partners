import "server-only"

import { lookup as dnsLookup } from "node:dns/promises"
import type { LookupAddress, LookupOptions } from "node:dns"
import { isIP } from "node:net"

import { Agent, fetch as undiciFetch } from "undici"

import { isBlockedIpAddress } from "@/lib/ai/base-url"
import { allowLocalAiHttp } from "@/lib/schemas/integrations"

/**
 * SSRF guard for requests to a user-set AI base URL (OpenAI-compatible):
 * the saved API key travels with them, so they may never reach a private,
 * loopback, link-local or metadata address (review C6, Important 1).
 *
 * - Redirects are refused (a 307 keeps the method, body and key).
 * - A host name is resolved once per connection; if ANY address is blocked
 *   the connection is refused, otherwise the socket connects to exactly the
 *   checked addresses (undici `connect.lookup`), so DNS cannot be rebound
 *   between check and connect. TLS still verifies the certificate for, and
 *   sends SNI with, the host name.
 * - An IP literal host is checked before anything is sent.
 * - Development only: http://localhost and loopback literals are allowed
 *   unchecked, as `baseUrlProblem` allows them (a local model server).
 */

/** The target address is refused; never carries the address or the URL. */
export class AiTargetBlockedError extends Error {
  constructor() {
    super("This address is not allowed (private, local or metadata address)")
    this.name = "AiTargetBlockedError"
  }
}

/** Whether `error` (or any error in its `cause` chain) is a refused target. */
export function isAiTargetBlocked(error: unknown): boolean {
  let current: unknown = error
  for (let depth = 0; current && depth < 8; depth++) {
    if (current instanceof AiTargetBlockedError) return true
    current = (current as { cause?: unknown }).cause
  }
  return false
}

export type LookupAll = (
  host: string
) => Promise<ReadonlyArray<{ address: string; family?: number }>>

const lookupAll: LookupAll = (host) =>
  dnsLookup(host, { all: true, verbatim: true })

export const AI_LOOKUP_TIMEOUT_MS = 5_000

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("DNS lookup timed out")), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

const bareHost = (hostname: string) =>
  hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "")

const isLocalhost = (host: string) =>
  host === "localhost" || host === "127.0.0.1" || host === "::1"

type GuardOptions = {
  /** Resolver (tests inject one). Default: dns.lookup, all addresses. */
  lookup?: LookupAll
  /** Address policy (tests inject one). Default: isBlockedIpAddress. */
  isBlocked?: (address: string) => boolean
  /** Development localhost bypass. Default: allowLocalAiHttp(). */
  allowLocal?: () => boolean
  /** Plain http to a checked host (tests only). Default: false. */
  allowHttp?: boolean
  timeoutMs?: number
}

type LookupCallback = (
  error: Error | null,
  address: string | LookupAddress[],
  family?: number
) => void

/**
 * A `fetch` for user-set AI base URLs. Pass it to the provider factory
 * (`createOpenAICompatible({ fetch })`) and use it for "List models" and
 * "Test connection". A refused target rejects with AiTargetBlockedError.
 */
export function createGuardedFetch(opts: GuardOptions = {}): typeof fetch {
  const lookup = opts.lookup ?? lookupAll
  const isBlocked = opts.isBlocked ?? isBlockedIpAddress
  const allowLocal = opts.allowLocal ?? allowLocalAiHttp
  const timeoutMs = opts.timeoutMs ?? AI_LOOKUP_TIMEOUT_MS

  // Every connection of this agent resolves through here: the addresses it
  // checks are the addresses the socket connects to.
  const checkedLookup = (
    hostname: string,
    options: LookupOptions,
    callback: LookupCallback
  ) => {
    withTimeout(lookup(bareHost(hostname)), timeoutMs).then(
      (found) => {
        if (found.length === 0)
          return callback(
            Object.assign(new Error("No address"), { code: "ENOTFOUND" }),
            []
          )
        if (found.some((a) => isBlocked(a.address)))
          return callback(new AiTargetBlockedError(), [])
        const all = found.map((a) => ({
          address: a.address,
          family: a.family ?? (isIP(a.address) || 4),
        }))
        const wanted =
          options.family === 4 || options.family === 6
            ? all.filter((a) => a.family === options.family)
            : all
        if (wanted.length === 0)
          return callback(
            Object.assign(new Error("No address"), { code: "ENOTFOUND" }),
            []
          )
        if (options.all) return callback(null, wanted)
        callback(null, wanted[0].address, wanted[0].family)
      },
      (error: unknown) =>
        callback(
          error instanceof Error ? error : new Error("DNS lookup failed"),
          []
        )
    )
  }
  const agent = new Agent({ connect: { lookup: checkedLookup } })

  return (async (input: string | URL | Request, init?: RequestInit) => {
    if (typeof input !== "string" && !(input instanceof URL))
      throw new TypeError("The guarded fetch takes a URL")
    const url = new URL(String(input))
    const host = bareHost(url.hostname)
    const request = { ...init, redirect: "error" } as const

    if (url.protocol === "http:" || url.protocol === "https:") {
      if (allowLocal() && isLocalhost(host))
        return (await undiciFetch(
          url,
          request as Parameters<typeof undiciFetch>[1]
        )) as unknown as Response
    }
    if (
      url.protocol !== "https:" &&
      !(opts.allowHttp && url.protocol === "http:")
    )
      throw new TypeError("Only https:// addresses are allowed")
    if (url.username || url.password)
      throw new TypeError("Credentials in the address are not allowed")
    // An IP literal is connected to without a lookup: check it here.
    if (isIP(host) && isBlocked(host)) throw new AiTargetBlockedError()
    try {
      return (await undiciFetch(url, {
        ...(request as Parameters<typeof undiciFetch>[1]),
        dispatcher: agent,
      })) as unknown as Response
    } catch (error) {
      if (isAiTargetBlocked(error)) throw new AiTargetBlockedError()
      throw error
    }
  }) as typeof fetch
}

/** The guarded fetch the app uses (one connection pool). */
export const guardedFetch = createGuardedFetch()
