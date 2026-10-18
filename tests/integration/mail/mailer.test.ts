import { createElement } from "react"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { InviteEmail } from "@/emails/invite"
import { mailer } from "@/server/lib/mailer"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"
import { assertMailpitUp, deleteMail, waitForMail } from "../helpers/mailpit"
import { configureSmtp } from "../helpers/smtp"

const unique = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@mail.test`

const LINK = "http://localhost:3000/admin/set-password?token=zz9"
const invite = createElement(InviteEmail, {
  name: "Dinn Rí",
  inviterName: "Owner",
  url: LINK,
  expiresInDays: 7,
})

beforeAll(assertMailpitUp)
beforeEach(async () => {
  await resetDb()
})

describe("SMTP mailer against Mailpit (master 7.2)", () => {
  it("delivers HTML + text with from, reply-to and subject from integrations.smtp", async () => {
    await configureSmtp()
    const to = unique("mailer")
    await deleteMail(to)
    const result = await mailer.send({
      to,
      replyTo: "visitor@example.test",
      subject: "Mailer test",
      template: "invite",
      react: invite,
    })
    expect(result).toEqual({ delivered: true })
    const mail = await waitForMail(to, { subject: "Mailer test" })
    expect(mail.From).toEqual({
      Name: "Security Partners Test",
      Address: "website@example.test",
    })
    expect(mail.ReplyTo.map((a) => a.Address)).toEqual(["visitor@example.test"])
    expect(mail.HTML).toContain(`href="${LINK}"`)
    expect(mail.Text).toContain("Hi Dinn Rí,")
  })

  it("invite email arrives in Mailpit and the API reports emailDelivered:true", async () => {
    await configureSmtp()
    const { cookie } = await signedInUser(["admin"])
    const email = unique("invitee")
    const res = await adminRequest("/users/invite", {
      cookie,
      method: "POST",
      json: { email, name: "Ivy Invitee", roles: ["viewer"] },
    })
    expect(res.status).toBe(201)
    expect(
      ((await res.json()) as { emailDelivered: boolean }).emailDelivered
    ).toBe(true)
    const mail = await waitForMail(email, {
      subject: "You're invited to the Security Partners admin",
    })
    expect(mail.Text).toContain("Hi Ivy Invitee,")
  })

  it("without SMTP settings (NODE_ENV=test) nothing is sent: delivered:false + logged", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined)
    const result = await mailer.send({
      to: unique("nobody"),
      subject: "Not sent",
      template: "invite",
      react: invite,
    })
    expect(result).toEqual({ delivered: false })
    expect(String(info.mock.calls[0][0])).toContain("SMTP is not configured")
    info.mockRestore()
  })

  it("an unreachable SMTP server is { delivered: false }, never an exception", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined)
    await configureSmtp({ port: 1 })
    expect(
      await mailer.send({
        to: unique("down"),
        subject: "Down",
        template: "invite",
        react: invite,
      })
    ).toEqual({ delivered: false })
    error.mockRestore()
  })
})
