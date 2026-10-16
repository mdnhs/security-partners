import { render, screen, within } from "@testing-library/react"
import type { ComponentProps } from "react"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/link", () => ({
  default: ({ href, ...props }: ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props} />
  ),
}))

import { EditorLayout } from "@/components/admin/editor/editor-layout"
import { SaveStateIndicator } from "@/components/admin/editor/save-state"

describe("EditorLayout (JW page-builder header)", () => {
  it("back link, title, path, status pills, save state and actions", () => {
    render(
      <main>
        <EditorLayout
          backHref="/admin/pages"
          backLabel="Pages"
          title="Home"
          path="/"
          status={{ published: {}, dirty: true }}
          saveState={<SaveStateIndicator state="saved" />}
          actions={<button type="button">Publish</button>}
        >
          <p>Form</p>
        </EditorLayout>
      </main>
    )
    const bar = document.querySelector(
      '[data-slot="editor-bar"]'
    ) as HTMLElement
    // A sticky card of its own (outside section tabs).
    expect(bar).toHaveClass("sticky", "bg-card", "rounded-card")
    expect(within(bar).getByRole("link", { name: "Pages" })).toHaveAttribute(
      "href",
      "/admin/pages"
    )
    expect(within(bar).getByRole("heading", { level: 1 })).toHaveTextContent(
      "Home"
    )
    expect(within(bar).getByText("/", { selector: "code" })).toBeInTheDocument()
    expect(bar).toHaveTextContent("PublishedUnpublished changes")
    expect(
      within(bar).getByRole("button", { name: "Publish" })
    ).toBeInTheDocument()
    expect(
      screen.getByText("Form").closest('[data-slot="editor-form"]')
    ).not.toBeNull()
  })

  it("no back link or path when none is given (Settings)", () => {
    render(
      <EditorLayout
        title="Contact details"
        status={{ published: null, dirty: false }}
        saveState={null}
        actions={null}
      >
        <p>Form</p>
      </EditorLayout>
    )
    const bar = document.querySelector(
      '[data-slot="editor-bar"]'
    ) as HTMLElement
    expect(within(bar).queryByRole("link")).toBeNull()
    expect(bar.querySelector("code")).toBeNull()
    expect(bar).toHaveTextContent("Draft")
  })
})

describe("SaveStateIndicator (JW pill with a coloured dot)", () => {
  it.each([
    ["saved", "Saved", "bg-success"],
    ["saving", "Saving…", "bg-primary"],
    ["unsaved", "Unsaved changes", "bg-warning"],
    ["invalid", "Fix errors to save", "bg-danger"],
    ["conflict", "Conflict", "bg-danger"],
    ["error", "Not saved", "bg-danger"],
  ] as const)("%s → %s with a %s dot", (state, label, dot) => {
    render(<SaveStateIndicator state={state} />)
    const status = screen.getByRole("status", { name: `Save status: ${label}` })
    expect(status).toHaveTextContent(label)
    expect(status).toHaveClass("rounded-full")
    expect(status.querySelector("[aria-hidden]")).toHaveClass(dot)
  })

  it("offers Retry after a failed save", () => {
    const onRetry = vi.fn()
    render(<SaveStateIndicator state="error" onRetry={onRetry} />)
    screen.getByRole("button", { name: "Retry" }).click()
    expect(onRetry).toHaveBeenCalled()
  })
})
