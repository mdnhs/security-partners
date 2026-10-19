import { render, screen, within } from "@testing-library/react"
import type { ComponentProps } from "react"
import { describe, expect, it, vi } from "vitest"

const { pathname } = vi.hoisted(() => ({
  pathname: { current: "/admin/collections/team" },
}))
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }))
vi.mock("next/link", () => ({
  default: ({ href, ...props }: ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props} />
  ),
}))

import { CollectionTabs } from "@/components/admin/collections/collection-tabs"
import { AdminSessionProvider } from "@/components/admin/session-provider"

const session = {
  user: {
    id: "u1",
    name: "Edith Editor",
    email: "edith@example.test",
    title: null,
    twoFactorEnabled: false,
  },
  roles: ["editor" as const],
  impersonatedBy: null,
}

describe("Collections section tabs", () => {
  it("lists the collections as route tabs and marks the current one", () => {
    pathname.current = "/admin/collections/clients"
    render(
      <AdminSessionProvider value={session}>
        <CollectionTabs>
          <p>Clients screen</p>
        </CollectionTabs>
      </AdminSessionProvider>
    )
    const nav = screen.getByRole("navigation", { name: "Collections" })
    expect(
      within(nav)
        .getAllByRole("link")
        .map((a) => a.textContent)
      // Categories moved to Insights (MK IA, spec §5.1).
    ).toEqual(["Team", "Clients", "Group companies"])
    expect(within(nav).getByRole("link", { name: "Clients" })).toHaveAttribute(
      "aria-current",
      "page"
    )
    expect(screen.getByText("Clients screen")).toBeInTheDocument()
  })
})
