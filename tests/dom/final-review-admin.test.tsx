/* eslint-disable @next/next/no-html-link-for-pages -- plain <a> links exercise the guard's document-level click interception */
import { QueryClientProvider } from "@tanstack/react-query"
import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderToStaticMarkup } from "react-dom/server"
import { useState } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

// Final review 3 (admin UI/UX/a11y): the shared pieces behind I1–I8.
const { push, replace } = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
}))
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/pages/home",
  useRouter: () => ({ push, replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}))

import AdminError from "@/app/(admin)/admin/error"
import GlobalError from "@/app/global-error"
import { ProfileForm } from "@/components/admin/account/profile-form"
import {
  DataTable,
  type DataTableParams,
  columnsFor,
  type DataTableColumns,
} from "@/components/admin/data-table/data-table"
import { useListHref } from "@/components/admin/data-table/list-url"
import { SaveStateIndicator } from "@/components/admin/editor/save-state"
import {
  formChanged,
  UnsavedChangesProvider,
  UnsavedGuard,
  useConfirmLeave,
} from "@/components/admin/editor/unsaved-guard"
import { makeQueryClient } from "@/components/admin/providers"
import {
  SectionTabs,
  SectionTabsPanel,
} from "@/components/admin/section-tabs/section-tabs"
import { AdminShell } from "@/components/admin/shell/admin-shell"
import { SortableList } from "@/components/admin/sortable-list"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { useAutosave } from "@/hooks/use-autosave"

beforeEach(() => {
  push.mockReset()
  replace.mockReset()
})

describe("Sheet primitive widths (I1)", () => {
  it("lets the caller's width win and is full width on phones by default", () => {
    render(
      <Sheet open>
        <SheetContent side="right" className="sm:max-w-2xl">
          <SheetTitle>Wide</SheetTitle>
        </SheetContent>
      </Sheet>
    )
    const sheet = screen.getByRole("dialog", { name: "Wide" })
    expect(sheet).toHaveClass("w-full", "sm:max-w-2xl")
    expect(sheet).not.toHaveClass("sm:max-w-sm")
    expect(sheet.className).not.toMatch(/data-\[side=right\]:(w-3\/4|sm:max-w)/)
    // The close button is 44 px on touch screens (I4).
    expect(screen.getByRole("button", { name: "Close" })).toHaveClass(
      "pointer-coarse:size-11"
    )
  })

  it("keeps a narrow default for sheets that set no width", () => {
    render(
      <Sheet open>
        <SheetContent side="left">
          <SheetTitle>Nav</SheetTitle>
        </SheetContent>
      </Sheet>
    )
    expect(screen.getByRole("dialog", { name: "Nav" })).toHaveClass(
      "w-full",
      "sm:max-w-sm"
    )
  })
})

function Dirty({ initial = true }: { initial?: boolean }) {
  const [dirty, setDirty] = useState(initial)
  const confirmLeave = useConfirmLeave()
  const [answer, setAnswer] = useState("")
  return (
    <>
      <UnsavedGuard when={dirty} />
      <a href="/admin/services">Services</a>
      <button type="button" onClick={() => setDirty(false)}>
        Mark saved
      </button>
      <button
        type="button"
        onClick={() =>
          void confirmLeave().then((leave) => setAnswer(String(leave)))
        }
      >
        Sign out
      </button>
      <output>{answer}</output>
    </>
  )
}

const renderGuarded = (initial = true) =>
  render(
    <UnsavedChangesProvider>
      <Dirty initial={initial} />
    </UnsavedChangesProvider>
  )

describe("shell unsaved-changes registry (I2/I3)", () => {
  it("asks with a styled dialog before an in-app link leaves", async () => {
    const user = userEvent.setup()
    renderGuarded()
    await user.click(screen.getByRole("link", { name: "Services" }))
    const dialog = await screen.findByRole("alertdialog", {
      name: "Leave without saving?",
    })
    await user.click(
      within(dialog).getByRole("button", { name: "Keep editing" })
    )
    expect(push).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()

    await user.click(screen.getByRole("link", { name: "Services" }))
    await user.click(
      within(
        await screen.findByRole("alertdialog", {
          name: "Leave without saving?",
        })
      ).getByRole("button", { name: "Leave page" })
    )
    // On the guard's own history entry: replaced, so Back skips it.
    expect(replace).toHaveBeenCalledWith("/admin/services")
  })

  it("lets programmatic leaves (sign-out) ask too", async () => {
    const user = userEvent.setup()
    renderGuarded()
    await user.click(screen.getByRole("button", { name: "Sign out" }))
    await user.click(
      within(
        await screen.findByRole("alertdialog", {
          name: "Leave without saving?",
        })
      ).getByRole("button", { name: "Keep editing" })
    )
    expect(await screen.findByRole("status")).toHaveTextContent("false")
  })

  it("answers at once when nothing is unsaved", async () => {
    const user = userEvent.setup()
    renderGuarded(false)
    await user.click(screen.getByRole("button", { name: "Sign out" }))
    expect(await screen.findByRole("status")).toHaveTextContent("true")
    expect(screen.queryByRole("alertdialog")).toBeNull()
  })

  it("guards the browser's Back button with a same-page history entry", async () => {
    const user = userEvent.setup()
    const pushState = vi.spyOn(window.history, "pushState")
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {})
    renderGuarded()
    await waitFor(() =>
      expect(pushState).toHaveBeenCalledWith(
        expect.objectContaining({ __spUnsaved: true }),
        "",
        window.location.href
      )
    )
    // Back lands on the page's own entry (same URL): the dialog asks.
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"))
    })
    const dialog = await screen.findByRole("alertdialog", {
      name: "Leave without saving?",
    })
    await user.click(
      within(dialog).getByRole("button", { name: "Keep editing" })
    )
    // Staying puts the guard entry back.
    expect(pushState).toHaveBeenCalledTimes(2)
    expect(back).not.toHaveBeenCalled()

    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"))
    })
    await user.click(
      within(
        await screen.findByRole("alertdialog", {
          name: "Leave without saving?",
        })
      ).getByRole("button", { name: "Leave page" })
    )
    expect(back).toHaveBeenCalledTimes(1)
    pushState.mockRestore()
    back.mockRestore()
  })

  it("passes a Back press through once the edits are saved", async () => {
    const user = userEvent.setup()
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {})
    renderGuarded()
    await user.click(screen.getByRole("button", { name: "Mark saved" }))
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"))
    })
    expect(screen.queryByRole("alertdialog")).toBeNull()
    expect(back).toHaveBeenCalledTimes(1)
    back.mockRestore()
  })

  it("routes ⌘K navigation through the same guard", async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ items: [] }), {
            status: 200,
            headers: { "content-type": "application/json" },
          })
      )
    )
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
        <UnsavedGuard when />
      </AdminShell>
    )
    await user.keyboard("{Control>}k{/Control}")
    const palette = await screen.findByRole("dialog", {
      name: "Search the admin",
    })
    await user.click(
      await within(palette).findByRole("option", { name: /^Services/ })
    )
    expect(
      await screen.findByRole("alertdialog", { name: "Leave without saving?" })
    ).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })

  it("dock and menu sign-out ask first while something is unsaved", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(
      // Typed for mock.calls (the sign-out URL is checked below).
      async (input: RequestInfo | URL) => {
        void input
        return new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      }
    )
    vi.stubGlobal("fetch", fetchMock)
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
        <UnsavedGuard when />
      </AdminShell>
    )
    await user.click(screen.getAllByRole("button", { name: "Log out" })[0])
    await user.click(
      within(
        await screen.findByRole("alertdialog", {
          name: "Leave without saving?",
        })
      ).getByRole("button", { name: "Keep editing" })
    )
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes("/api/auth/sign-out")
      )
    ).toBe(false)
  })

  it("account forms count as unsaved once a field changes", async () => {
    const user = userEvent.setup()
    render(
      <UnsavedChangesProvider>
        <ProfileForm name="Edith" email="e@x.test" title={null} />
        <a href="/admin">Dashboard</a>
      </UnsavedChangesProvider>
    )
    await user.type(screen.getByLabelText("Job title"), "Editor")
    await user.click(screen.getByRole("link", { name: "Dashboard" }))
    expect(
      await screen.findByRole("alertdialog", { name: "Leave without saving?" })
    ).toBeInTheDocument()
  })

  it("formChanged compares fields with their initial values", () => {
    const form = document.createElement("form")
    form.innerHTML =
      '<input name="a" value="x"><textarea name="b">y</textarea><select name="c"><option>1</option><option>2</option></select>'
    document.body.append(form)
    expect(formChanged(form)).toBe(false)
    ;(form.elements.namedItem("c") as HTMLSelectElement).value = "2"
    expect(formChanged(form)).toBe(true)
    form.remove()
  })
})

describe("touch targets (I4)", () => {
  it("SectionTabs tabs, sortable move buttons and dialog footers grow to 44 px on touch", () => {
    render(
      <>
        <SectionTabs
          ariaLabel="Sections"
          items={[
            { id: "a", label: "First" },
            { id: "b", label: "Second" },
          ]}
        >
          <SectionTabsPanel id="a">A</SectionTabsPanel>
          <SectionTabsPanel id="b">B</SectionTabsPanel>
        </SectionTabs>
        <SortableList
          label="Order"
          items={[
            { id: "1", label: "One" },
            { id: "2", label: "Two" },
          ]}
          onReorder={() => {}}
        />
      </>
    )
    for (const tab of screen.getAllByRole("tab"))
      expect(tab).toHaveClass("pointer-coarse:h-11")
    expect(screen.getByRole("button", { name: "Move One down" })).toHaveClass(
      "pointer-coarse:size-11"
    )
  })

  it("DialogFooter makes its buttons 44 px on touch screens", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Publish</DialogTitle>
          <DialogFooter>
            <Button>Publish</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
    expect(
      screen.getByRole("button", { name: "Publish" }).parentElement
    ).toHaveClass("pointer-coarse:**:data-[slot=button]:h-11")
  })
})

describe("save status announcements (M4)", () => {
  const live = () =>
    document.querySelector('[aria-live="polite"]') as HTMLElement

  it("the pill is not a live region; autosave cycles stay silent", () => {
    const { rerender } = render(<SaveStateIndicator state="unsaved" />)
    const pill = screen.getByRole("status", { name: /^Save status/ })
    expect(pill).toHaveAttribute("aria-live", "off")
    expect(live()).toBeEmptyDOMElement()
    rerender(<SaveStateIndicator state="saving" />)
    rerender(<SaveStateIndicator state="saved" />)
    expect(live()).toBeEmptyDOMElement()
  })

  it("announces failures and conflicts, and Saved after ⌘S", () => {
    const { rerender } = render(<SaveStateIndicator state="error" />)
    expect(live()).toHaveTextContent("Not saved")
    rerender(<SaveStateIndicator state="conflict" />)
    expect(live()).toHaveTextContent("Conflict")
    rerender(<SaveStateIndicator state="saved" savedOnRequest />)
    expect(live()).toHaveTextContent("Saved")
  })
})

describe("autosave validation cost (M3)", () => {
  it("parses once per changed value, never for a saved one", () => {
    const isValid = vi.fn(() => true)
    const save = vi.fn(async () => {})
    const saved = { a: 1 }
    const { rerender } = renderHook(
      ({ value }) => useAutosave({ value, savedValue: saved, save, isValid }),
      { initialProps: { value: saved } }
    )
    expect(isValid).not.toHaveBeenCalled()
    const edited = { a: 2 }
    rerender({ value: edited })
    rerender({ value: edited })
    rerender({ value: edited })
    expect(isValid).toHaveBeenCalledTimes(1)
  })
})

type Row = { id: string; name: string } & Record<string, unknown>
const ch = columnsFor<Row>()
const COLUMNS = ch.columns([
  ch.accessor("name", { header: "Name" }),
]) as unknown as DataTableColumns<Row>

function BackLink() {
  return <a href={useListHref("/admin/pages/home")}>Back to list</a>
}

describe("list state in the URL (I8)", () => {
  it("starts from ?page=&sort=&q= and writes changes back with replace", async () => {
    const user = userEvent.setup()
    window.history.replaceState(
      null,
      "",
      "/admin/pages/home?status=open&page=2&sort=name:desc&q=ann"
    )
    const fetchPage = vi.fn(async (params: DataTableParams) => ({
      items: [{ id: "1", name: "Ann" }],
      page: params.page,
      pageSize: params.pageSize,
      total: 60,
    }))
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <DataTable<Row>
          syncUrl
          label="People"
          queryKey={["people"]}
          fetchPage={fetchPage}
          columns={COLUMNS}
          renderCard={(row) => row.name}
          empty="Nobody"
        />
      </QueryClientProvider>
    )
    await screen.findByRole("table", { name: "People" })
    expect(fetchPage).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, sort: "name:desc", q: "ann" })
    )
    expect(screen.getByRole("searchbox")).toHaveValue("ann")

    await user.click(screen.getByRole("button", { name: "Next page" }))
    await waitFor(() =>
      expect(window.location.search).toBe(
        "?status=open&page=3&sort=name%3Adesc&q=ann"
      )
    )
    // Replaced in place: Back still leaves the list.
    expect(push).not.toHaveBeenCalled()

    render(<BackLink />)
    expect(screen.getByRole("link", { name: "Back to list" })).toHaveAttribute(
      "href",
      "/admin/pages/home?status=open&page=3&sort=name%3Adesc&q=ann"
    )
  })
})

describe("error boundaries (I7)", () => {
  it("the admin-level boundary shows the styled card with Try again", async () => {
    const user = userEvent.setup()
    const retry = vi.fn()
    render(
      <AdminError
        error={Object.assign(new Error("db down"), { digest: "abc123" })}
        retry={retry}
      />
    )
    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent("Something went wrong")
    expect(alert).toHaveTextContent("abc123")
    await user.click(screen.getByRole("button", { name: "Try again" }))
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it("global-error renders its own document with retry", () => {
    const html = renderToStaticMarkup(
      <GlobalError
        error={Object.assign(new Error("x"), { digest: "d1" })}
        retry={() => {}}
      />
    )
    expect(html).toMatch(/^<html lang="en-IE">/)
    expect(html).toContain('role="alert"')
    expect(html).toContain("Try again")
    expect(html).toContain("d1")
  })
})
