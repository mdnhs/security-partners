import { render } from "react-email"
import { afterEach, describe, expect, it, vi } from "vitest"

import { InviteEmail } from "@/emails/invite"
import { ResetPasswordEmail } from "@/emails/reset-password"
import { mailer } from "@/server/lib/mailer"

const LINK = "http://localhost:3000/admin/set-password?token=abc123"

afterEach(() => {
  vi.restoreAllMocks()
})

describe("email templates", () => {
  it("invite: greets the user, names the inviter and links the token URL", async () => {
    const email = (
      <InviteEmail
        name="Dinn Rí"
        inviterName="Owner One"
        url={LINK}
        expiresInDays={7}
      />
    )
    const html = await render(email)
    const text = await render(email, { plainText: true })
    expect(html).toContain(`href="${LINK}"`)
    expect(text).toContain("Hi Dinn Rí,")
    expect(text).toContain("Owner One invited you")
    expect(text).toContain("expires in 7 days")
    expect(text).toContain(LINK)
  })

  it("reset-password: links the token URL and states the expiry", async () => {
    const email = (
      <ResetPasswordEmail name="Sam" url={LINK} expiresInMinutes={60} />
    )
    expect(await render(email)).toContain(`href="${LINK}"`)
    expect(await render(email, { plainText: true })).toContain(
      "expires in 60 minutes"
    )
  })
})

describe("mailer (no transport until Task 7.2)", () => {
  it("renders, reports not delivered and logs subject + recipient only (never the link)", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined)
    const result = await mailer.send({
      to: "someone@example.test",
      subject: "You're invited",
      react: (
        <InviteEmail name="S" inviterName="O" url={LINK} expiresInDays={7} />
      ),
    })
    expect(result).toEqual({ delivered: false })
    expect(info).toHaveBeenCalledTimes(1)
    const logged = String(info.mock.calls[0][0])
    expect(logged).toContain("You're invited")
    expect(logged).toContain("someone@example.test")
    expect(logged).not.toContain("abc123")
  })
})
