import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import {
  CustomCodeNotice,
  CustomCodeOffNotice,
} from "@/components/admin/marketing/notices"

describe("marketing screen notices", () => {
  it("custom code: warns about trust, DNS verification and CSP", () => {
    render(<CustomCodeNotice />)
    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent("every visitor")
    expect(alert).toHaveTextContent("DNS")
    expect(alert).toHaveTextContent("Content-Security-Policy")
    expect(alert).toHaveTextContent(
      "Anything that sets cookies or tracks visitors needs consent"
    )
    expect(alert).toHaveTextContent("Analytics or Marketing category")
  })

  it("custom code switched off: says how it happened and how to undo it (D2.3)", () => {
    render(<CustomCodeOffNotice />)
    const status = screen.getByRole("status")
    expect(status).toHaveTextContent("Custom code is switched off")
    expect(status).toHaveTextContent("pnpm custom-code:off")
    expect(status).toHaveTextContent("publish")
  })
})
