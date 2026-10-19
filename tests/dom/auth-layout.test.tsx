import { render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

// The published-theme boundary is an async server component (covered by
// tests/integration/theme/runtime.test.tsx); here only its children matter.
vi.mock("@/components/admin/theme/admin-themed", () => ({
  AdminThemed: ({ children }: { children: React.ReactNode }) => children,
}))

// next/image renders a plain <img> in jsdom (the shell tests rely on it too).
import AuthLayout from "@/app/(admin)/admin/(auth)/layout"
import { AuthCard } from "@/components/admin/auth/auth-card"

describe("auth split layout (JW)", () => {
  it("brand panel (decorative) beside the form panel", () => {
    render(
      <AuthLayout>
        <AuthCard title="Sign in" description="Use your admin account.">
          <form aria-label="Sign in form">
            <input aria-label="Email" data-slot="input" />
            <button type="submit">Sign in</button>
          </form>
        </AuthCard>
      </AuthLayout>
    )
    const main = screen.getByRole("main")
    const brand = main.querySelector('[data-slot="auth-brand"]') as HTMLElement
    expect(brand).toHaveAttribute("aria-hidden", "true")
    expect(brand).toHaveClass("bg-hero", "hidden", "lg:flex")
    expect(brand).toHaveTextContent("Your website, securely under control.")
    const panel = main.querySelector('[data-slot="auth-panel"]') as HTMLElement
    expect(panel).toHaveClass("rounded-card", "bg-sidebar")
    expect(within(panel).getByRole("heading", { level: 1 })).toHaveTextContent(
      "Sign in"
    )
    expect(panel).toHaveTextContent("Access is by invitation only.")
    // 44 px, rounded-xl controls inside the form panel.
    expect(panel.className).toContain("[&_[data-slot=input]]:h-11")
    expect(panel.className).toContain("[&_button[type=submit]]:h-11")
    // The phone-width brand mark names the product; the logo is decorative.
    expect(within(panel).getByText("Security Partners")).toBeInTheDocument()
  })

  it("AuthCard: large title and description, no card chrome", () => {
    render(
      <AuthCard title="Two-step check" description="Enter the code.">
        <p>Form</p>
      </AuthCard>
    )
    const h1 = screen.getByRole("heading", { level: 1 })
    expect(h1).toHaveClass("text-[2rem]")
    expect(screen.getByText("Enter the code.")).toBeInTheDocument()
    expect(document.querySelector('[data-slot="card"]')).toBeNull()
  })
})
