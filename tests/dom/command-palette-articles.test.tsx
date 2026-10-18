import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
}))

import { makeQueryClient } from "@/components/admin/providers"
import { AdminShell } from "@/components/admin/shell/admin-shell"
import type { Role } from "@/lib/auth/roles"

function renderShell(roles: Role[]) {
  return render(
    <AdminShell
      queryClient={makeQueryClient()}
      session={{
        user: {
          id: "u1",
          name: "Arthur Author",
          email: "a@example.test",
          title: null,
          twoFactorEnabled: true,
        },
        roles,
        impersonatedBy: null,
      }}
    >
      <p>Body</p>
    </AdminShell>
  )
}

beforeEach(() => {
  push.mockReset()
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            items: [
              {
                type: "article",
                id: "a1",
                title: "Key Holding Explained",
                subtitle: "/blog/key-holding-explained",
                href: "/admin/articles/a1",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
    )
  )
})

async function openPalette() {
  const user = userEvent.setup()
  await user.keyboard("{Control>}k{/Control}")
  const dialog = await screen.findByRole("dialog", { name: "Search the admin" })
  return { user, dialog }
}

describe("⌘K palette and articles (Phase 5)", () => {
  it("offers Articles and New article to authors and opens article results", async () => {
    renderShell(["author"])
    const { user, dialog } = await openPalette()
    const labels = within(dialog)
      .getAllByRole("option")
      .map((o) => o.textContent)
    expect(labels).toEqual(expect.arrayContaining(["Articles", "New article"]))
    await user.click(
      within(dialog).getByRole("option", { name: "New article" })
    )
    expect(push).toHaveBeenCalledWith("/admin/articles/new")

    const again = await openPalette()
    await again.user.type(
      within(again.dialog).getByRole("combobox", { name: "Search" }),
      "key"
    )
    const result = await within(again.dialog).findByRole("option", {
      name: /Key Holding Explained/,
    })
    expect(result).toHaveTextContent("Article · /blog/key-holding-explained")
    await again.user.click(result)
    expect(push).toHaveBeenCalledWith("/admin/articles/a1")
  })

  it("viewers can find articles but get no New article action", async () => {
    renderShell(["viewer"])
    const { dialog } = await openPalette()
    const labels = within(dialog)
      .getAllByRole("option")
      .map((o) => o.textContent)
    expect(labels).toContain("Articles")
    expect(labels).not.toContain("New article")
  })
})
