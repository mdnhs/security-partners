import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AdminPreview } from "@/components/admin/appearance/admin-preview"
import { ColourField } from "@/components/admin/appearance/colour-field"
import { ContrastPanel } from "@/components/admin/appearance/contrast-panel"
import { PresetGallery } from "@/components/admin/appearance/preset-gallery"
import { useLiveAdmin } from "@/components/admin/appearance/use-live-admin"
import { AdminThemeProvider } from "@/components/admin/theme-provider"
import { checkTheme } from "@/lib/theme/checks"
import type { PresetId } from "@/lib/theme/presets"
import {
  DEFAULT_THEME,
  ThemeConfig,
  type AdminThemeConfig,
} from "@/lib/theme/schema"

describe("PresetGallery", () => {
  it("marks the current preset pressed and reports a pick", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    function Harness() {
      const [value, setValue] = useState<PresetId>("security-partners")
      return (
        <PresetGallery
          scope="site"
          label="Site preset"
          value={value}
          onChange={(p) => {
            onChange(p)
            setValue(p)
          }}
        />
      )
    }
    render(<Harness />)
    const group = screen.getByRole("group", { name: "Site preset" })
    expect(screen.getByText("Site preset")).toBeVisible()
    const sp = within(group).getByRole("button", { name: /Security Partners/ })
    const ocean = within(group).getByRole("button", { name: /Ocean/ })
    expect(sp).toHaveAttribute("aria-pressed", "true")
    expect(ocean).toHaveAttribute("aria-pressed", "false")
    expect(ocean.querySelectorAll("[data-swatch]")).toHaveLength(3)

    await user.click(ocean)
    expect(onChange).toHaveBeenCalledWith("ocean")
    expect(ocean).toHaveAttribute("aria-pressed", "true")
    expect(sp).toHaveAttribute("aria-pressed", "false")
  })

  it("draws admin swatches too", () => {
    render(
      <PresetGallery
        scope="admin"
        label="Admin preset"
        value="plum"
        onChange={() => undefined}
      />
    )
    const plum = screen.getByRole("button", { name: /Plum/ })
    expect(plum).toHaveAttribute("aria-pressed", "true")
    expect(plum.querySelectorAll("[data-swatch]")).toHaveLength(3)
  })
})

describe("ColourField", () => {
  it("commits a typed hex on Enter as canonical oklch", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <ColourField
        id="brand"
        label="Brand"
        value="#67bd31"
        onChange={onChange}
      />
    )
    const input = screen.getByRole("textbox", { name: "Brand" })
    expect(screen.getByText(/^oklch\(.*\) · #67bd31$/)).toBeInTheDocument()
    await user.clear(input)
    await user.type(input, "#2751a3{Enter}")
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0]![0]).toMatch(/^oklch\(/)
  })

  it("commits on blur", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <ColourField id="brand" label="Brand" value={null} onChange={onChange} />
    )
    const input = screen.getByRole("textbox", { name: "Brand" })
    await user.type(input, "#2751a3")
    expect(onChange).not.toHaveBeenCalled()
    await user.tab()
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it("shows the error for an invalid value and does not commit it", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <ColourField
        id="brand"
        label="Brand"
        value="#67bd31"
        onChange={onChange}
        description="Drives the green family."
      />
    )
    const input = screen.getByRole("textbox", { name: "Brand" })
    await user.clear(input)
    await user.type(input, "red;}body{{display:none{Enter}")
    expect(onChange).not.toHaveBeenCalled()
    expect(input).toHaveAttribute("aria-invalid", "true")
    expect(input).toHaveAccessibleDescription(
      /Use #rrggbb or oklch\(L C H\) colour/
    )
    expect(input).toHaveAccessibleDescription(/Drives the green family\./)
  })

  it("opens the picker from the swatch and shows the fallback while unset", async () => {
    const user = userEvent.setup()
    render(
      <ColourField
        id="primary"
        label="Primary"
        value={null}
        fallback="#367318"
        onChange={() => undefined}
      />
    )
    expect(screen.getByRole("textbox", { name: "Primary" })).toHaveValue(
      "#367318"
    )
    await user.click(screen.getByRole("button", { name: "Pick Primary" }))
    expect(
      (await screen.findAllByRole("slider")).length
    ).toBeGreaterThanOrEqual(2)
  })

  it("clears and toggles the lock", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const onLockChange = vi.fn()
    render(
      <ColourField
        id="ink"
        label="Body text"
        value="#4a5568"
        onChange={onChange}
        clearable
        locked={false}
        onLockChange={onLockChange}
      />
    )
    await user.click(screen.getByRole("button", { name: "Clear Body text" }))
    expect(onChange).toHaveBeenCalledWith(null)
    const lock = screen.getByRole("button", { name: "Lock Body text" })
    expect(lock).toHaveAttribute("aria-pressed", "false")
    await user.click(lock)
    expect(onLockChange).toHaveBeenCalledWith(true)
  })
})

describe("ContrastPanel", () => {
  const failing = ThemeConfig.parse({
    site: { tokens: { "brand-ink": "#eeeeee" } },
  })

  it("shows a failing pair with a per-row fix that clears it", async () => {
    const user = userEvent.setup()
    const onFix = vi.fn()
    render(<ContrastPanel config={failing} scope="site" onFix={onFix} />)
    const row = screen
      .getAllByRole("row")
      .find((r) => within(r).queryByText("Fails"))!
    expect(row).toBeDefined()
    expect(within(row).getByText(/^\d+\.\d{2}:1$/)).toBeInTheDocument()
    await user.click(
      within(row).getByRole("button", { name: /Fix automatically/ })
    )
    expect(onFix).toHaveBeenCalledTimes(1)
    const next = onFix.mock.calls[0]![0]
    expect(checkTheme(next).filter((i) => i.scope === "site")).toEqual([])
  })

  it("rates passing pairs and fixes all of this scope only", async () => {
    const user = userEvent.setup()
    const onFix = vi.fn()
    const both = ThemeConfig.parse({
      site: { tokens: { "brand-ink": "#eeeeee" } },
      admin: { primary: "#f4f4f4", tint: "primary" },
    })
    render(<ContrastPanel config={both} scope="site" onFix={onFix} />)
    expect(screen.getAllByText(/^(AAA|AA)$/).length).toBeGreaterThan(0)
    await user.click(screen.getByRole("button", { name: "Fix all" }))
    const next = onFix.mock.calls[0]![0]
    expect(checkTheme(next).filter((i) => i.scope === "site")).toEqual([])
    expect(next.admin).toEqual(both.admin)
  })

  it("disables Fix all when everything passes", () => {
    render(
      <ContrastPanel
        config={DEFAULT_THEME}
        scope="admin"
        onFix={() => undefined}
      />
    )
    expect(screen.queryByText("Fails")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Fix all" })).toBeDisabled()
  })
})

describe("AdminPreview", () => {
  it("renders the sample controls for the given mode", () => {
    render(<AdminPreview mode="dark" />)
    const card = screen.getByRole("group", { name: "Admin preview" })
    expect(card).toHaveAttribute("data-mode", "dark")
    for (const name of ["Primary", "Secondary", "Outline"])
      expect(within(card).getByRole("button", { name })).toBeInTheDocument()
    expect(within(card).getByRole("textbox")).toBeInTheDocument()
    expect(within(card).getByRole("switch")).toBeInTheDocument()
    expect(card.querySelectorAll("[data-slot=status-pill]").length).toBe(3)
    expect(card.querySelectorAll("[data-chart-swatch]").length).toBe(5)
  })
})

describe("useLiveAdmin", () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => {
    document.documentElement.removeAttribute("style")
    document.documentElement.className = ""
    localStorage.clear()
  })

  function Live({ admin }: { admin: AdminThemeConfig | null }) {
    useLiveAdmin(admin)
    return null
  }
  const evergreen = ThemeConfig.parse({ admin: { preset: "evergreen" } }).admin

  it("sets --primary inline and removes it on unmount", async () => {
    const root = document.documentElement
    root.style.setProperty("--unrelated", "1")
    const { unmount } = render(
      <AdminThemeProvider>
        <Live admin={evergreen} />
      </AdminThemeProvider>
    )
    await waitFor(() =>
      expect(root.style.getPropertyValue("--primary")).toMatch(/^oklch\(/)
    )
    act(() => unmount())
    expect(root.style.getPropertyValue("--primary")).toBe("")
    expect(root.style.getPropertyValue("--unrelated")).toBe("1")
  })

  it("restores when the config becomes null", async () => {
    const root = document.documentElement
    const { rerender } = render(
      <AdminThemeProvider>
        <Live admin={evergreen} />
      </AdminThemeProvider>
    )
    await waitFor(() =>
      expect(root.style.getPropertyValue("--primary")).not.toBe("")
    )
    rerender(
      <AdminThemeProvider>
        <Live admin={null} />
      </AdminThemeProvider>
    )
    expect(root.style.getPropertyValue("--primary")).toBe("")
  })

  it("uses the dark tokens when the resolved mode is dark", async () => {
    const root = document.documentElement
    localStorage.setItem("sp-admin-theme", "dark")
    render(
      <AdminThemeProvider>
        <Live admin={evergreen} />
      </AdminThemeProvider>
    )
    const { buildAdminTokens } = await import("@/lib/theme/admin")
    const { formatOklch } = await import("@/lib/theme/color")
    await waitFor(() =>
      expect(root.style.getPropertyValue("--primary")).toBe(
        formatOklch(buildAdminTokens(evergreen, "dark").primary)
      )
    )
  })
})
