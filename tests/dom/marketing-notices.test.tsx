import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { CustomCodeNotice } from "@/components/admin/marketing/notices"

describe("marketing screen notices", () => {
  it("custom code: warns about trust, DNS verification and CSP", () => {
    render(<CustomCodeNotice />)
    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent("every public page")
    expect(alert).toHaveTextContent("DNS")
    expect(alert).toHaveTextContent("Content-Security-Policy")
    expect(alert).toHaveTextContent(
      "anything that sets cookies or tracks visitors needs consent — use Tracking"
    )
  })
})
