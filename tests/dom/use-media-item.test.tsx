import { QueryClientProvider } from "@tanstack/react-query"
import { render, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useMediaItem } from "@/components/admin/media/use-media-item"
import { makeQueryClient } from "@/components/admin/providers"

const ID = "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b"

const fetchMock = vi.fn(
  async () =>
    new Response(JSON.stringify({ id: ID, url: "/images/x.png", alt: "" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
)

beforeEach(() => {
  fetchMock.mockClear()
  vi.stubGlobal("fetch", fetchMock)
})

function Probe({ id }: { id: string | null | undefined }) {
  useMediaItem(id)
  return null
}

const renderProbe = (id: string | null | undefined) =>
  render(
    <QueryClientProvider client={makeQueryClient()}>
      <Probe id={id} />
    </QueryClientProvider>
  )

describe("useMediaItem only fetches media ids (review D1.3 minor 5)", () => {
  it.each([".", "..", "", "../users", "x?role=admin", null, undefined])(
    "%j makes no request",
    async (id) => {
      renderProbe(id)
      // Give an enabled query the chance to fire.
      await new Promise((resolve) => setTimeout(resolve, 20))
      expect(fetchMock).not.toHaveBeenCalled()
    }
  )

  it("a UUID is fetched from /media/<id>", async () => {
    renderProbe(ID)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain(
      `/api/v1/admin/media/${ID}`
    )
  })
})
