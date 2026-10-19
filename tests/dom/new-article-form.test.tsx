import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/articles/new",
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

import { NewArticleForm } from "@/components/admin/articles/new-article-form"
import { makeQueryClient } from "@/components/admin/providers"
import { AdminShell } from "@/components/admin/shell/admin-shell"
import type { Role } from "@/lib/auth/roles"

import { pickOption } from "./select-helper"

const CATEGORY = "0190f0e0-0000-7000-8000-0000000000c1"
const IMAGE = {
  id: "0190f0e0-0000-7000-8000-0000000000e1",
  url: "/images/hero.jpg",
  alt: "Officer at night",
  mime: "image/jpeg",
  width: 1440,
  height: 748,
  size: 1,
  createdAt: "2026-10-16T00:00:00.000Z",
}
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

const posted: unknown[] = []
/** Byline candidates from /options (empty for authors) and the POST reply. */
let authors: { id: string; name: string; title: null }[]
let created: () => Response
beforeEach(() => {
  push.mockReset()
  posted.length = 0
  authors = [{ id: "u1", name: "Edith Editor", title: null }]
  created = () => json(201, { id: "0190f0e0-0000-7000-8000-0000000000a1" })
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), "http://localhost")
      if (url.pathname === "/api/v1/admin/articles/options")
        return json(200, {
          categories: [
            { id: CATEGORY, slug: "mobile-patrols", name: "Mobile Patrols" },
          ],
          authors,
        })
      if (
        url.pathname === "/api/v1/admin/articles" &&
        init?.method === "POST"
      ) {
        posted.push(JSON.parse(String(init.body)))
        return created()
      }
      if (url.pathname === `/api/v1/admin/media/${IMAGE.id}`)
        return json(200, IMAGE)
      if (url.pathname === "/api/v1/admin/media")
        return json(200, { items: [IMAGE], page: 1, pageSize: 24, total: 1 })
      return json(404, { error: { code: "NOT_FOUND", message: "x" } })
    })
  )
})

describe("new article (master 5.3)", () => {
  it("derives the address, requires a category and opens the new draft", async () => {
    const user = userEvent.setup()
    render(
      <AdminShell
        queryClient={makeQueryClient()}
        session={{
          user: {
            id: "u1",
            name: "Edith Editor",
            email: "e@example.test",
            title: null,
            twoFactorEnabled: true,
          },
          roles: ["editor"],
          impersonatedBy: null,
        }}
      >
        <NewArticleForm />
      </AdminShell>
    )
    await user.type(
      await screen.findByRole("textbox", { name: "Title" }),
      "Night Patrols & Key Holding"
    )
    expect(screen.getByLabelText("Address")).toHaveValue(
      "night-patrols-and-key-holding"
    )
    await user.type(
      screen.getByRole("textbox", { name: "Excerpt" }),
      "What a night patrol covers."
    )
    await user.click(
      screen.getByRole("button", { name: "Choose image: Cover image" })
    )
    const picker = await screen.findByRole("dialog", {
      name: "Choose: Cover image",
    })
    await user.click(
      await within(picker).findByRole("button", { name: /Officer at night/ })
    )
    await user.click(
      within(picker).getByRole("button", { name: "Use this image" })
    )

    await user.click(screen.getByRole("button", { name: "Create draft" }))
    expect(await screen.findByText("Choose a category")).toBeInTheDocument()
    expect(posted).toEqual([])

    await pickOption(
      user,
      screen.getByRole("combobox", { name: "Category" }),
      "Mobile Patrols"
    )
    expect(screen.getByRole("combobox", { name: "Byline" })).toHaveTextContent(
      "Edith Editor"
    )
    await user.click(screen.getByRole("button", { name: "Create draft" }))
    await waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]).toEqual({
      slug: "night-patrols-and-key-holding",
      categoryId: CATEGORY,
      authorId: "u1",
      draft: {
        title: "Night Patrols & Key Holding",
        excerpt: "What a night patrol covers.",
        cover: { mediaId: IMAGE.id },
        lead: null,
        tags: [],
        body: null,
      },
    })
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        "/admin/articles/0190f0e0-0000-7000-8000-0000000000a1"
      )
    )
  })

  it("shows a taken address inline and clears it on edit", async () => {
    const user = userEvent.setup()
    created = () =>
      json(409, {
        error: {
          code: "CONFLICT",
          message: "Another article already uses this address",
          fieldErrors: { slug: ["Already used by another article"] },
          requestId: "r1",
        },
      })
    renderForm(["editor"])
    await fillBasics(user)
    await user.click(screen.getByRole("button", { name: "Create draft" }))
    await waitFor(() => expect(posted).toHaveLength(1))
    const address = screen.getByLabelText("Address")
    expect(
      await screen.findByText("Already used by another article")
    ).toBeInTheDocument()
    expect(address).toHaveAttribute("aria-invalid", "true")
    expect(address.getAttribute("aria-describedby")).toContain(
      "new-article-slug-error"
    )
    expect(push).not.toHaveBeenCalled()
    await user.type(address, "-2")
    expect(screen.queryByText("Already used by another article")).toBeNull()
    expect(address).not.toHaveAttribute("aria-invalid")
  })

  it("authors get no byline choice and post no authorId", async () => {
    const user = userEvent.setup()
    authors = []
    renderForm(["author"])
    await fillBasics(user)
    expect(screen.queryByLabelText("Byline")).toBeNull()
    await user.click(screen.getByRole("button", { name: "Create draft" }))
    await waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]).not.toHaveProperty("authorId")
    expect(posted[0]).toMatchObject({
      slug: "night-patrols-and-key-holding",
      categoryId: CATEGORY,
    })
  })
})

function renderForm(roles: Role[]) {
  return render(
    <AdminShell
      queryClient={makeQueryClient()}
      session={{
        user: {
          id: "u1",
          name: "Edith Editor",
          email: "e@example.test",
          title: null,
          twoFactorEnabled: true,
        },
        roles,
        impersonatedBy: null,
      }}
    >
      <NewArticleForm />
    </AdminShell>
  )
}

/** Title, excerpt, cover and category: everything a draft needs. */
async function fillBasics(user: ReturnType<typeof userEvent.setup>) {
  await user.type(
    await screen.findByRole("textbox", { name: "Title" }),
    "Night Patrols & Key Holding"
  )
  await user.type(
    screen.getByRole("textbox", { name: "Excerpt" }),
    "What a night patrol covers."
  )
  await user.click(
    screen.getByRole("button", { name: "Choose image: Cover image" })
  )
  const picker = await screen.findByRole("dialog", {
    name: "Choose: Cover image",
  })
  await user.click(
    await within(picker).findByRole("button", { name: /Officer at night/ })
  )
  await user.click(
    within(picker).getByRole("button", { name: "Use this image" })
  )
  // The categories load before the pick (shadcn Select, MK parity A6).
  await pickOption(
    user,
    screen.getByRole("combobox", { name: "Category" }),
    "Mobile Patrols"
  )
}
