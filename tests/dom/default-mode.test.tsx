import { render, screen, waitFor } from "@testing-library/react"
import { useTheme } from "next-themes"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  ADMIN_THEME_AUTO_KEY,
  DefaultMode,
} from "@/components/admin/theme/default-mode"
import {
  ADMIN_THEME_STORAGE_KEY,
  AdminThemeProvider,
} from "@/components/admin/theme-provider"

function Probe() {
  const { theme } = useTheme()
  return <p data-testid="theme">{theme}</p>
}

function renderMode(mode: "system" | "light" | "dark") {
  return render(
    <AdminThemeProvider>
      <DefaultMode mode={mode} />
      <Probe />
    </AdminThemeProvider>
  )
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe("DefaultMode", () => {
  it("applies the published mode when the user never chose", async () => {
    renderMode("dark")
    await waitFor(() =>
      expect(screen.getByTestId("theme")).toHaveTextContent("dark")
    )
    expect(localStorage.getItem(ADMIN_THEME_STORAGE_KEY)).toBe("dark")
    expect(localStorage.getItem(ADMIN_THEME_AUTO_KEY)).toBe("dark")
  })

  it("follows a newly published mode while the stored theme is its own", async () => {
    localStorage.setItem(ADMIN_THEME_STORAGE_KEY, "dark")
    localStorage.setItem(ADMIN_THEME_AUTO_KEY, "dark")
    renderMode("light")
    await waitFor(() =>
      expect(screen.getByTestId("theme")).toHaveTextContent("light")
    )
    expect(localStorage.getItem(ADMIN_THEME_STORAGE_KEY)).toBe("light")
    expect(localStorage.getItem(ADMIN_THEME_AUTO_KEY)).toBe("light")
  })

  it("keeps the user's own choice", async () => {
    localStorage.setItem(ADMIN_THEME_STORAGE_KEY, "light")
    renderMode("dark")
    expect(screen.getByTestId("theme")).toHaveTextContent("light")
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.getByTestId("theme")).toHaveTextContent("light")
    expect(localStorage.getItem(ADMIN_THEME_STORAGE_KEY)).toBe("light")
    expect(localStorage.getItem(ADMIN_THEME_AUTO_KEY)).toBeNull()
  })

  it("keeps a choice made after an applied default", async () => {
    localStorage.setItem(ADMIN_THEME_STORAGE_KEY, "light")
    localStorage.setItem(ADMIN_THEME_AUTO_KEY, "dark")
    renderMode("dark")
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.getByTestId("theme")).toHaveTextContent("light")
    expect(localStorage.getItem(ADMIN_THEME_STORAGE_KEY)).toBe("light")
  })

  it("survives localStorage throwing", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError")
    })
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("SecurityError")
    })
    expect(() => renderMode("dark")).not.toThrow()
    // Nothing can be stored, so no own choice can exist: the default applies.
    await waitFor(() =>
      expect(screen.getByTestId("theme")).toHaveTextContent("dark")
    )
  })
})
