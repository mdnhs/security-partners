import { describe, expect, it } from "vitest"

import { firstName, greetingFor } from "@/components/admin/dashboard/present"

describe("dashboard presenters", () => {
  it("greets by the clock in Ireland", () => {
    expect(greetingFor(new Date("2026-10-16T08:30:00Z"))).toBe("Good morning") // 09:30 IST
    expect(greetingFor(new Date("2026-10-16T12:00:00Z"))).toBe("Good afternoon")
    expect(greetingFor(new Date("2026-12-16T18:30:00Z"))).toBe("Good evening") // 18:30 GMT
  })

  it("uses the first name", () => {
    expect(firstName("Edith Mary Editor")).toBe("Edith")
    expect(firstName("  ")).toBe("there")
  })
})
