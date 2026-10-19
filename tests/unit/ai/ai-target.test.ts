import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const dnsLookup = vi.hoisted(() => vi.fn())
vi.mock("node:dns/promises", () => ({
  default: { lookup: dnsLookup },
  lookup: dnsLookup,
}))

import { isBlockedIpAddress } from "@/lib/ai/base-url"
import {
  AiTargetBlockedError,
  createGuardedFetch,
  guardedFetch,
  isAiTargetBlocked,
} from "@/server/lib/ai-target"

type Hits = { count: number; hosts: string[] }

const servers: Server[] = []

/** A local HTTP server; `reply` writes the response. */
async function serve(
  host: string,
  reply: (res: import("node:http").ServerResponse) => void,
  port = 0
): Promise<{ port: number; hits: Hits }> {
  const hits: Hits = { count: 0, hosts: [] }
  const server = createServer((req, res) => {
    hits.count += 1
    hits.hosts.push(String(req.headers.host))
    reply(res)
  })
  servers.push(server)
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(port, host, () => resolve())
  })
  return { port: (server.address() as AddressInfo).port, hits }
}

const ok = (res: import("node:http").ServerResponse) => {
  res.setHeader("connection", "close")
  res.setHeader("content-type", "application/json")
  res.end(JSON.stringify({ data: [{ id: "m" }] }))
}

const addresses = (...list: string[]) =>
  list.map((address) => ({ address, family: address.includes(":") ? 6 : 4 }))

/** Treats 127.0.0.1 as the "public" test server; everything else as usual. */
const loopbackIsPublic = (a: string) =>
  a === "127.0.0.1" ? false : isBlockedIpAddress(a)

beforeEach(() => {
  dnsLookup.mockReset()
})

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (s) =>
        new Promise<void>((resolve) => {
          s.closeAllConnections()
          s.close(() => resolve())
        })
    )
  )
})

describe("guardedFetch (SSRF guard for user-set AI base URLs)", () => {
  it.each([
    "https://169.254.169.254/latest/meta-data/",
    "https://10.0.0.1/v1/models",
    "https://127.0.0.1/v1/models",
    "https://[::1]/v1/models",
    "https://[fe80::1]/v1/models",
    "https://[fd00:ec2::254]/latest",
    "https://[::ffff:a9fe:a9fe]/latest", // IPv4-mapped metadata
    "https://[64:ff9b::a9fe:a9fe]/latest", // NAT64 metadata
    "https://[2002:a9fe:a9fe::1]/latest", // 6to4 metadata
    "https://[::a9fe:a9fe]/latest", // IPv4-compatible metadata
  ])("refuses the IP literal %s before connecting", async (url) => {
    // As in production: no development localhost bypass.
    const production = createGuardedFetch({ allowLocal: () => false })
    await expect(production(url)).rejects.toBeInstanceOf(AiTargetBlockedError)
    expect(dnsLookup).not.toHaveBeenCalled()
  })

  it("refuses a host name that resolves to 10.x (mocked DNS)", async () => {
    dnsLookup.mockResolvedValue(addresses("10.0.0.7"))
    const error = await guardedFetch("https://api.rebind.example/v1/models", {
      signal: AbortSignal.timeout(5_000),
    }).catch((e: unknown) => e)
    expect(isAiTargetBlocked(error)).toBe(true)
    expect(dnsLookup).toHaveBeenCalledWith("api.rebind.example", {
      all: true,
      verbatim: true,
    })
  })

  it.each([
    ["::1"],
    ["fe80::1%en0"],
    ["fd12:3456::1"],
    ["::ffff:169.254.169.254"],
    ["64:ff9b::a00:1"],
    ["2002:a00:1::1"],
  ])("refuses a host name that resolves to IPv6 %s", async (address) => {
    dnsLookup.mockResolvedValue(addresses(address))
    const error = await guardedFetch("https://api.v6.example/v1").catch(
      (e: unknown) => e
    )
    expect(isAiTargetBlocked(error)).toBe(true)
  })

  it("refuses when ANY resolved address is blocked", async () => {
    dnsLookup.mockResolvedValue(addresses("8.8.8.8", "169.254.169.254"))
    const error = await guardedFetch("https://mixed.example/v1").catch(
      (e: unknown) => e
    )
    expect(isAiTargetBlocked(error)).toBe(true)
  })

  it("connects to an allowed address, pinned to the checked IP", async () => {
    const target = await serve("127.0.0.1", ok)
    const lookup = vi.fn(async () => addresses("127.0.0.1"))
    const fetchGuarded = createGuardedFetch({
      lookup,
      isBlocked: loopbackIsPublic,
      allowHttp: true,
      allowLocal: () => false,
    })
    const res = await fetchGuarded(
      `http://api.public.example:${target.port}/v1/models`
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: [{ id: "m" }] })
    expect(target.hits.count).toBe(1)
    // Virtual hosting and TLS SNI still see the host name.
    expect(target.hits.hosts[0]).toBe(`api.public.example:${target.port}`)
    expect(lookup).toHaveBeenCalledWith("api.public.example")
  })

  it("DNS rebinding: public on the first lookup, private on the next → never reaches the private address", async () => {
    // Same port on two addresses: 127.0.0.1 plays "public", ::1 "private".
    const priv = await serve("::1", ok)
    const pub = await serve("127.0.0.1", ok, priv.port)
    const lookup = vi
      .fn()
      .mockResolvedValueOnce(addresses("127.0.0.1"))
      .mockResolvedValue(addresses("::1"))
    const fetchGuarded = createGuardedFetch({
      lookup,
      isBlocked: loopbackIsPublic,
      allowHttp: true,
      allowLocal: () => false,
    })
    const url = `http://rebind.example:${pub.port}/v1/models`
    expect((await fetchGuarded(url)).status).toBe(200)
    // The server closed the connection: the next request connects again.
    const second = await fetchGuarded(url).catch((e: unknown) => e)
    expect(isAiTargetBlocked(second)).toBe(true)
    expect(pub.hits.count).toBe(1)
    expect(priv.hits.count).toBe(0)
  })

  it("refuses redirects (307 to the metadata address) even when the caller asks to follow", async () => {
    const hop = await serve("127.0.0.1", (res) => {
      res.statusCode = 307
      res.setHeader("location", "http://169.254.169.254/latest/meta-data/")
      res.end()
    })
    const fetchGuarded = createGuardedFetch({
      lookup: async () => addresses("127.0.0.1"),
      isBlocked: loopbackIsPublic,
      allowHttp: true,
      allowLocal: () => false,
    })
    await expect(
      fetchGuarded(`http://hop.example:${hop.port}/v1/chat/completions`, {
        method: "POST",
        body: "{}",
        redirect: "follow",
      })
    ).rejects.toThrow()
    expect(hop.hits.count).toBe(1)
  })

  it("refuses redirects on the development localhost path too", async () => {
    const inner = await serve("127.0.0.1", ok)
    const hop = await serve("127.0.0.1", (res) => {
      res.statusCode = 307
      res.setHeader("location", `http://127.0.0.1:${inner.port}/secret`)
      res.end()
    })
    const fetchGuarded = createGuardedFetch({ allowLocal: () => true })
    await expect(
      fetchGuarded(`http://127.0.0.1:${hop.port}/v1/models`)
    ).rejects.toThrow()
    expect(inner.hits.count).toBe(0)
  })

  it("refuses plain http to a public host and non-http schemes", async () => {
    await expect(guardedFetch("http://api.example.com/v1")).rejects.toThrow()
    await expect(guardedFetch("file:///etc/passwd")).rejects.toThrow()
    expect(dnsLookup).not.toHaveBeenCalled()
  })

  it("treats an unresolvable name as unreachable, not blocked", async () => {
    dnsLookup.mockRejectedValue(
      Object.assign(new Error("getaddrinfo ENOTFOUND"), { code: "ENOTFOUND" })
    )
    const error = await guardedFetch("https://nowhere.example/v1").catch(
      (e: unknown) => e
    )
    expect(error).toBeInstanceOf(Error)
    expect(isAiTargetBlocked(error)).toBe(false)
  })
})
