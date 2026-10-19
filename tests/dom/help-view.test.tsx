import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { HelpView } from "@/components/admin/help/help-view"

describe("HelpView (MK B7)", () => {
  it("lists the shortcuts and mails the owners", () => {
    render(
      <HelpView owners={[{ name: "Olive Owner", email: "olive@example.ie" }]} />
    )
    expect(
      screen.getByRole("heading", { name: "Keyboard shortcuts" })
    ).toBeInTheDocument()
    for (const action of [
      "Search and go",
      "AI assistant",
      "Save draft",
      "Close panels",
    ])
      expect(screen.getByText(action)).toBeInTheDocument()
    expect(screen.getByText("Esc")).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Who to contact" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /olive@example\.ie/ })
    ).toHaveAttribute("href", "mailto:olive@example.ie")
    expect(screen.getByText("Olive Owner")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Guides" })).toBeInTheDocument()
    // The runbook is not served: its sections are titles, not links.
    expect(screen.getByText("Owner locked out")).not.toHaveAttribute("href")
  })

  it("gives the mailto a 44 px coarse target with a truncating email", () => {
    render(
      <HelpView owners={[{ name: "Olive Owner", email: "olive@example.ie" }]} />
    )
    const link = screen.getByRole("link", { name: /olive@example\.ie/ })
    expect(link).toHaveClass(
      "inline-flex",
      "items-center",
      "pointer-coarse:min-h-11"
    )
    expect(link.querySelector("span.truncate")).toHaveTextContent(
      "olive@example.ie"
    )
  })

  it("says so when there is no active owner", () => {
    render(<HelpView owners={[]} />)
    expect(screen.getByText(/no active owner/i)).toBeInTheDocument()
  })
})
