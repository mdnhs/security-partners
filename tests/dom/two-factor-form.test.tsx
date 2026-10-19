import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

// Better Auth's client binds `fetch` at import, so mock the client itself.
const { verifyTotp, verifyBackupCode } = vi.hoisted(() => ({
  verifyTotp: vi.fn(),
  verifyBackupCode: vi.fn(),
}))
vi.mock("@/lib/auth-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth-client")>()),
  authClient: { twoFactor: { verifyTotp, verifyBackupCode } },
}))

import { TwoFactorForm } from "@/components/admin/auth/two-factor-form"

beforeEach(() => {
  verifyTotp.mockReset()
  verifyTotp.mockResolvedValue({ data: {}, error: null })
  verifyBackupCode.mockReset()
})

// MK-parity A5–A7 review: the shadcn Checkbox must still post trustDevice.
describe("two-factor form", () => {
  it("sends trustDevice true when 'Trust this device' is checked", async () => {
    const user = userEvent.setup()
    render(<TwoFactorForm />)
    await user.type(screen.getByLabelText("Authentication code"), "123 456")
    await user.click(
      screen.getByRole("checkbox", { name: "Trust this device for 30 days" })
    )
    await user.click(screen.getByRole("button", { name: "Verify" }))
    expect(verifyTotp).toHaveBeenCalledWith({
      code: "123456",
      trustDevice: true,
    })
  })

  it("sends trustDevice false when the box is left unchecked", async () => {
    const user = userEvent.setup()
    render(<TwoFactorForm />)
    await user.type(screen.getByLabelText("Authentication code"), "123456")
    await user.click(screen.getByRole("button", { name: "Verify" }))
    expect(verifyTotp).toHaveBeenCalledWith({
      code: "123456",
      trustDevice: false,
    })
  })
})
