import { useQueryClient } from "@tanstack/react-query"
import { render } from "@testing-library/react"
import type { QueryClient } from "@tanstack/react-query"
import { describe, expect, it } from "vitest"

import {
  AdminProviders,
  getQueryClient,
  makeQueryClient,
} from "@/components/admin/providers"
import { ApiError } from "@/lib/api-client"

describe("getQueryClient (browser singleton per identity)", () => {
  it("reuses the client for one identity and starts fresh for another", () => {
    const first = getQueryClient("u1:")
    expect(getQueryClient("u1:")).toBe(first)
    const impersonating = getQueryClient("u2:owner-1")
    expect(impersonating).not.toBe(first)
    expect(getQueryClient("u1:")).not.toBe(first)
  })

  it("AdminProviders hands a fresh client to the tree when the key changes", () => {
    const seen: QueryClient[] = []
    function Probe() {
      seen.push(useQueryClient())
      return null
    }
    const { rerender } = render(
      <AdminProviders cacheKey="a1:">
        <Probe />
      </AdminProviders>
    )
    rerender(
      <AdminProviders cacheKey="a1:">
        <Probe />
      </AdminProviders>
    )
    rerender(
      <AdminProviders cacheKey="b2:a1">
        <Probe />
      </AdminProviders>
    )
    expect(seen).toHaveLength(3)
    expect(seen[1]).toBe(seen[0])
    expect(seen[2]).not.toBe(seen[0])
  })
})

describe("makeQueryClient retry", () => {
  const retry = makeQueryClient().getDefaultOptions().queries?.retry as (
    failureCount: number,
    error: unknown
  ) => boolean
  const apiError = (status: number) =>
    new ApiError(status, { error: { code: "X", message: "x" } })

  it("never retries a 4xx answer", () => {
    expect(retry(0, apiError(403))).toBe(false)
    expect(retry(0, apiError(404))).toBe(false)
    expect(retry(0, apiError(422))).toBe(false)
  })

  it("retries 5xx and network errors up to twice", () => {
    expect(retry(0, apiError(500))).toBe(true)
    expect(retry(1, new TypeError("fetch failed"))).toBe(true)
    expect(retry(2, apiError(503))).toBe(false)
    expect(retry(2, new TypeError("fetch failed"))).toBe(false)
  })
})
