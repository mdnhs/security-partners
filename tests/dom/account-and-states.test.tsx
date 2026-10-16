import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import PanelError from "@/app/(admin)/admin/(panel)/error"
import Forbidden from "@/app/(admin)/admin/forbidden"
import AdminNotFound from "@/app/(admin)/admin/not-found"
import { ThemePreference } from "@/components/admin/account/theme-preference"
import { AdminThemeProvider } from "@/components/admin/theme-provider"

describe("ThemePreference", () => {
  it("chooses light, dark or system for the admin", async () => {
    const user = userEvent.setup()
    render(
      <AdminThemeProvider defaultTheme="system">
        <ThemePreference />
      </AdminThemeProvider>
    )
    const group = await screen.findByRole("group", { name: "Theme" })
    expect(
      within(group)
        .getAllByRole("button")
        .map((b) => b.textContent?.trim())
    ).toEqual(["Light", "Dark", "System"])
    await user.click(within(group).getByRole("button", { name: "Dark" }))
    expect(localStorage.getItem("sp-admin-theme")).toBe("dark")
    expect(within(group).getByRole("button", { name: "Dark" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
  })
})

describe("panel error boundary", () => {
  it("says what happened, shows the digest and retries", async () => {
    const retry = vi.fn()
    const user = userEvent.setup()
    render(
      <PanelError
        error={Object.assign(new Error("boom"), { digest: "abc123" })}
        retry={retry}
      />
    )
    const alert = screen.getByRole("alert")
    expect(within(alert).getByRole("heading", { level: 1 })).toHaveTextContent(
      "Something went wrong"
    )
    expect(alert).toHaveTextContent("abc123")
    expect(alert).not.toHaveTextContent("boom")
    await user.click(within(alert).getByRole("button", { name: "Try again" }))
    expect(retry).toHaveBeenCalled()
  })
})

describe("admin 404 and 403", () => {
  it("not found: a card with a way back to the dashboard", () => {
    render(<AdminNotFound />)
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "That page doesn't exist"
    )
    expect(
      screen.getByRole("link", { name: "Back to the dashboard" })
    ).toHaveAttribute("href", "/admin")
  })

  it("forbidden: keeps its heading and offers the dashboard", () => {
    render(<Forbidden />)
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "You do not have access to this page"
    )
    expect(
      screen.getByRole("link", { name: "Back to the dashboard" })
    ).toHaveAttribute("href", "/admin")
  })
})
