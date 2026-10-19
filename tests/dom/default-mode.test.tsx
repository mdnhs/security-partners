import { act, render, screen } from "@testing-library/react"
import { useTheme } from "next-themes"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  ADMIN_THEME_AUTO_KEY,
  DefaultMode,
  modeScript,
} from "@/components/admin/theme/default-mode"
import {
  ADMIN_THEME_STORAGE_KEY,
  AdminThemeProvider,
} from "@/components/admin/theme-provider"

type Mode = "system" | "light" | "dark"

function Probe() {
  const { theme } = useTheme()
  return <p data-testid="theme">{theme}</p>
}

// render() commits inside act, so DefaultMode's effect (and next-themes'
// state update) has run once this resolves; the extra act flushes any
// follow-up render.
async function renderMode(mode: Mode) {
  const view = render(
    <AdminThemeProvider>
      <DefaultMode mode={mode} />
      <Probe />
    </AdminThemeProvider>
  )
  await act(async () => {})
  return view
}

const theme = () => screen.getByTestId("theme").textContent

function resetHtml() {
  document.documentElement.className = ""
  document.documentElement.style.colorScheme = ""
}

beforeEach(() => {
  localStorage.clear()
  resetHtml()
})

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
  resetHtml()
})

describe("DefaultMode", () => {
  it("applies the published mode when the user never chose", async () => {
    await renderMode("dark")
    expect(theme()).toBe("dark")
    expect(localStorage.getItem(ADMIN_THEME_STORAGE_KEY)).toBe("dark")
    expect(localStorage.getItem(ADMIN_THEME_AUTO_KEY)).toBe("dark")
  })

  it("follows a newly published mode while the stored theme is its own", async () => {
    localStorage.setItem(ADMIN_THEME_STORAGE_KEY, "dark")
    localStorage.setItem(ADMIN_THEME_AUTO_KEY, "dark")
    await renderMode("light")
    expect(theme()).toBe("light")
    expect(localStorage.getItem(ADMIN_THEME_STORAGE_KEY)).toBe("light")
    expect(localStorage.getItem(ADMIN_THEME_AUTO_KEY)).toBe("light")
  })

  it("keeps the user's own choice", async () => {
    localStorage.setItem(ADMIN_THEME_STORAGE_KEY, "light")
    await renderMode("dark")
    expect(theme()).toBe("light")
    expect(localStorage.getItem(ADMIN_THEME_STORAGE_KEY)).toBe("light")
    expect(localStorage.getItem(ADMIN_THEME_AUTO_KEY)).toBeNull()
  })

  it("keeps a choice made after an applied default", async () => {
    localStorage.setItem(ADMIN_THEME_STORAGE_KEY, "light")
    localStorage.setItem(ADMIN_THEME_AUTO_KEY, "dark")
    await renderMode("dark")
    expect(theme()).toBe("light")
    expect(localStorage.getItem(ADMIN_THEME_STORAGE_KEY)).toBe("light")
  })

  it("survives localStorage throwing", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError")
    })
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("SecurityError")
    })
    await renderMode("dark")
    // Nothing can be stored, so no own choice can exist: the default applies.
    expect(theme()).toBe("dark")
  })

  it("a client-side mount renders no script (React would never run it)", async () => {
    const { container } = await renderMode("dark")
    // (next-themes renders its own script; none of DefaultMode's.)
    const scripts = [...container.querySelectorAll("script")]
    expect(
      scripts.some((s) => s.innerHTML.includes(ADMIN_THEME_AUTO_KEY))
    ).toBe(false)
  })
})

describe("modeScript (pre-paint, in the server HTML)", () => {
  // The inline script runs as written in the HTML: evaluate it the same way.
  const run = (mode: Mode) => new Function(modeScript(mode))()
  const html = document.documentElement

  it("never chose: stores the mode + marker and sets the class before paint", () => {
    run("dark")
    expect(localStorage.getItem(ADMIN_THEME_STORAGE_KEY)).toBe("dark")
    expect(localStorage.getItem(ADMIN_THEME_AUTO_KEY)).toBe("dark")
    expect(html).toHaveClass("dark")
    expect(html.style.colorScheme).toBe("dark")
  })

  it("system resolves through prefers-color-scheme (light here)", () => {
    html.classList.add("dark")
    run("system")
    expect(localStorage.getItem(ADMIN_THEME_STORAGE_KEY)).toBe("system")
    expect(html).toHaveClass("light")
    expect(html).not.toHaveClass("dark")
  })

  it("follows a newly published mode over its own earlier value", () => {
    localStorage.setItem(ADMIN_THEME_STORAGE_KEY, "dark")
    localStorage.setItem(ADMIN_THEME_AUTO_KEY, "dark")
    run("light")
    expect(localStorage.getItem(ADMIN_THEME_STORAGE_KEY)).toBe("light")
    expect(html).toHaveClass("light")
  })

  it("leaves the user's own choice (and the page) alone", () => {
    localStorage.setItem(ADMIN_THEME_STORAGE_KEY, "light")
    localStorage.setItem(ADMIN_THEME_AUTO_KEY, "dark")
    run("dark")
    expect(localStorage.getItem(ADMIN_THEME_STORAGE_KEY)).toBe("light")
    expect(html.className).toBe("")
  })

  it("never throws when storage does", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError")
    })
    expect(() => run("dark")).not.toThrow()
  })
})
