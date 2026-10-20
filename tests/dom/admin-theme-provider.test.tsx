import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useTheme } from "next-themes"
import { describe, expect, it } from "vitest"

import {
  ADMIN_THEME_STORAGE_KEY,
  AdminThemeProvider,
} from "@/components/admin/theme-provider"

function Probe() {
  const { theme, setTheme } = useTheme()
  return (
    <>
      <p data-testid="theme">{theme}</p>
      <button type="button" onClick={() => setTheme("dark")}>
        Dark
      </button>
      <input aria-label="Field" />
    </>
  )
}

describe("AdminThemeProvider", () => {
  it("stores the choice under the admin's own key", async () => {
    const user = userEvent.setup()
    render(
      <AdminThemeProvider>
        <Probe />
      </AdminThemeProvider>
    )
    await user.click(screen.getByRole("button", { name: "Dark" }))
    expect(localStorage.getItem(ADMIN_THEME_STORAGE_KEY)).toBe("dark")
    expect(localStorage.getItem("theme")).toBeNull()
  })

  it("has no single-key theme shortcut (WCAG 2.1.4)", async () => {
    localStorage.removeItem(ADMIN_THEME_STORAGE_KEY)
    const user = userEvent.setup()
    render(
      <AdminThemeProvider defaultTheme="light">
        <Probe />
      </AdminThemeProvider>
    )
    await user.keyboard("d")
    expect(screen.getByTestId("theme")).toHaveTextContent("light")
  })
})
