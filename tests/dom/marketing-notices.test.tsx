import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import {
  CustomCodeNotice,
  TrackingNotice,
} from "@/components/admin/marketing/notices"

describe("marketing screen notices", () => {
  it("tracking: what loads after which consent, and the events sent", () => {
    render(<TrackingNotice />)
    const card = screen.getByRole("region", { name: "What loads when" })
    expect(card).toHaveTextContent("Analytics consent")
    expect(card).toHaveTextContent("Google Tag Manager and Google Analytics 4")
    expect(card).toHaveTextContent("Marketing consent")
    expect(card).toHaveTextContent("Meta Pixel")
    expect(card).toHaveTextContent("lead_submitted")
  })

  it("custom code: warns about trust, DNS verification and CSP", () => {
    render(<CustomCodeNotice />)
    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent("every public page")
    expect(alert).toHaveTextContent("DNS")
    expect(alert).toHaveTextContent("Content-Security-Policy")
  })
})
