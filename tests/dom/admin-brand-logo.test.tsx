import { act, render, screen, waitFor } from "@testing-library/react"
import type { ComponentProps } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

// Owner request: the admin sidebar shows the site's logo (the published
// settings.site logo, or its Lottie animation), falling back to the SP chip.
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))
vi.mock("next/link", () => ({
  default: ({ href, ...props }: ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props} />
  ),
}))
vi.mock("@/lib/auth-client", () => ({
  authClient: { signOut: vi.fn() },
  authErrorMessage: () => "Could not sign out.",
}))

type Listener = (event: unknown) => void
const players: FakePlayer[] = []
class FakePlayer {
  static setWasmUrl = vi.fn()
  listeners = new Map<string, Listener[]>()
  destroy = vi.fn()
  constructor(public config: Record<string, unknown>) {
    players.push(this)
  }
  addEventListener(type: string, fn: Listener) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn])
  }
  removeEventListener() {}
  emit(type: string) {
    for (const fn of this.listeners.get(type) ?? []) fn({ type })
  }
}
const imported = vi.fn()
vi.mock("@lottiefiles/dotlottie-web", () => {
  imported()
  return { DotLottie: FakePlayer }
})

import { makeQueryClient } from "@/components/admin/providers"
import { AdminShell } from "@/components/admin/shell/admin-shell"
import { BrandMark } from "@/components/admin/shell/brand-mark"
import type { AdminBrand } from "@/components/admin/shell/constants"

const LOGO = {
  src: "/images/logo.png",
  alt: "Security Partners Ltd.",
  width: 224,
  height: 136,
}

const brand = (over: Partial<AdminBrand> = {}): AdminBrand => ({
  name: "Security Partners",
  logo: LOGO,
  logoOnDark: null,
  animation: null,
  ...over,
})

function reducedMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query.includes("prefers-reduced-motion: reduce"),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }))
}

function renderShell(value: AdminBrand | null) {
  return render(
    <AdminShell
      queryClient={makeQueryClient()}
      brand={value}
      session={{
        user: {
          id: "u1",
          title: null,
          twoFactorEnabled: false,
          name: "Edith Editor",
          email: "edith@example.test",
        },
        roles: ["editor"],
        impersonatedBy: null,
      }}
    >
      <p>Body</p>
    </AdminShell>
  )
}

beforeEach(() => {
  players.length = 0
  imported.mockClear()
  FakePlayer.setWasmUrl.mockClear()
  reducedMotion(false)
})

describe("admin sidebar brand logo", () => {
  it("plays a published Lottie over the logo image", async () => {
    const { container } = renderShell(
      brand({ animation: "/api/v1/media/file/2026/10/a.json" })
    )
    await waitFor(() => expect(players).toHaveLength(1))
    expect(players[0].config).toMatchObject({
      src: "/api/v1/media/file/2026/10/a.json",
      loop: true,
      autoplay: true,
    })
    const canvas = players[0].config.canvas as HTMLCanvasElement
    const img = container.querySelector<HTMLImageElement>(
      "[data-slot=brand-logo] img"
    )!
    expect(img).toHaveAttribute("src", "/images/logo.png")
    // Same box: the canvas sits over the image until the first frame.
    expect(canvas.parentElement).toBe(img.parentElement)
    act(() => players[0].emit("frame"))
    expect(canvas.style.opacity).toBe("1")
    expect(img.style.opacity).toBe("0")
    expect(container.querySelector("[data-slot=brand-chip]")).toBeNull()
    // The brand link keeps a text name; the Admin pill stays.
    const link = screen.getByRole("link", {
      name: "Security Partners admin home",
    })
    expect(link).toHaveTextContent("Admin")
  })

  it("shows the image logo alone, never loading the player", async () => {
    const { container } = renderShell(brand())
    const img = container.querySelector("[data-slot=brand-logo] img")
    expect(img).toHaveAttribute("src", "/images/logo.png")
    expect(img).toHaveClass("object-contain")
    expect(container.querySelector("[data-slot=brand-chip]")).toBeNull()
    await new Promise((r) => setTimeout(r, 20))
    expect(imported).not.toHaveBeenCalled()
    expect(container.querySelector("canvas")).toBeNull()
  })

  it("keeps the SP chip without a logo", () => {
    const { container } = renderShell(null)
    expect(container.querySelector("[data-slot=brand-chip]")).not.toBeNull()
    expect(container.querySelector("[data-slot=brand-logo]")).toBeNull()
    expect(
      screen.getByRole("link", { name: "Security Partners admin home" })
    ).toBeInTheDocument()
  })

  it("never loads the player when motion is reduced", async () => {
    reducedMotion(true)
    const { container } = renderShell(
      brand({ animation: "/api/v1/media/file/2026/10/a.json" })
    )
    await new Promise((r) => setTimeout(r, 20))
    expect(imported).not.toHaveBeenCalled()
    expect(container.querySelector("canvas")).toBeNull()
    expect(container.querySelector("[data-slot=brand-logo] img")).toBeVisible()
  })

  it("swaps to the dark-mode logo when one is set", () => {
    const { container } = render(
      <BrandMark brand={brand({ logoOnDark: "/images/logo-dark.png" })} />
    )
    const imgs = container.querySelectorAll("[data-slot=brand-logo] img")
    expect(imgs).toHaveLength(2)
    expect(imgs[0]).toHaveClass("dark:hidden")
    expect(imgs[1]).toHaveAttribute("src", "/images/logo-dark.png")
    expect(imgs[1]).toHaveClass("hidden", "dark:block")
    expect(container.querySelector("[data-slot=brand-logo]")).not.toHaveClass(
      "dark:bg-white"
    )
  })

  it("puts the logo on a light plate in dark mode without a dark logo", () => {
    const { container } = render(<BrandMark brand={brand()} />)
    expect(container.querySelector("[data-slot=brand-logo]")).toHaveClass(
      "dark:bg-white"
    )
  })

  it("names the brand link after the site", () => {
    renderShell(brand({ name: "Acme Guarding" }))
    expect(
      screen.getByRole("link", { name: "Acme Guarding admin home" })
    ).toBeInTheDocument()
  })
})
