import type { ReactElement } from "react"
import { render } from "react-email"
import { afterEach, describe, expect, it, vi } from "vitest"

import { InviteEmail } from "@/emails/invite"
import { LeadAcknowledgementEmail } from "@/emails/lead-acknowledgement"
import { LeadNotificationEmail } from "@/emails/lead-notification"
import { ResetPasswordEmail } from "@/emails/reset-password"
import type { SmtpConfig } from "@/lib/schemas/integrations"
import {
  createMailer,
  createSmtpTransport,
  DEV_MAILPIT_SMTP,
  type MailerDeps,
  type MailTransport,
} from "@/server/lib/mailer"
import { smtpTransportOptions } from "@/server/modules/integrations/testers"

const LINK = "http://localhost:3000/admin/set-password?token=abc123"

const SAVED: SmtpConfig = {
  host: "smtp.example.ie",
  port: 587,
  secure: false,
  user: "mailer",
  password: "pw-123456",
  fromName: "Security Partners",
  fromAddress: "website@example.ie",
}

afterEach(() => {
  vi.restoreAllMocks()
})

function fakeTransport(sendMail: MailTransport["sendMail"] = async () => ({})) {
  return { sendMail: vi.fn(sendMail), close: vi.fn() }
}

function deps(over: Partial<MailerDeps> & { transport?: MailTransport } = {}) {
  const transport = over.transport ?? fakeTransport()
  const createTransport = vi.fn(() => transport)
  return {
    transport,
    createTransport,
    deps: {
      loadConfig: over.loadConfig ?? (async () => null),
      nodeEnv: over.nodeEnv ?? (() => "production"),
      createTransport: over.createTransport ?? createTransport,
    } satisfies MailerDeps,
  }
}

const invite = (
  <InviteEmail name="S" inviterName="O" url={LINK} expiresInDays={7} />
)

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

  it("lead notification: every field, the message as written and the admin link", async () => {
    const email = (
      <LeadNotificationEmail
        siteName="Security Partners"
        adminUrl="http://localhost:3000/admin/leads/0190a6e0-0000-7000-8000-000000000001"
        lead={{
          name: "Dinn Rí",
          email: "dinn@example.ie",
          phone: "085 000 0000",
          company: null,
          service: null,
          message: "Line one\nLine two & more",
          sourcePage: "/contact",
          receivedAt: "16 Oct 2026, 14:05",
        }}
      />
    )
    const html = await render(email)
    const text = await render(email, { plainText: true })
    expect(html).toContain('href="mailto:dinn@example.ie"')
    expect(html).toContain(
      'href="http://localhost:3000/admin/leads/0190a6e0-0000-7000-8000-000000000001"'
    )
    expect(html).toContain("white-space:pre-wrap")
    expect(text).toContain("Dinn Rí")
    expect(text).toContain("085 000 0000")
    expect(text).toContain("Line one\nLine two & more")
    expect(text).toContain("/contact")
    expect(text).toContain("16 Oct 2026, 14:05")
    expect(text).not.toContain("Company")
  })

  it("lead acknowledgement: thanks the visitor, repeats the message, names the 24/7 line", async () => {
    const email = (
      <LeadAcknowledgementEmail
        name="Sam"
        siteName="Security Partners"
        message={"Need a quote\nfor two sites"}
        phone24h="0818 000 000"
      />
    )
    const text = await render(email, { plainText: true })
    expect(text).toContain("Hi Sam,")
    expect(text).toContain("Need a quote\nfor two sites")
    expect(text).toContain("0818 000 000")
    const without = await render(
      <LeadAcknowledgementEmail
        name="Sam"
        siteName="Security Partners"
        message="Need a quote"
        phone24h={null}
      />,
      { plainText: true }
    )
    expect(without).not.toContain("24/7")
  })
})

describe("mailer (master 7.2)", () => {
  it("sends through the saved SMTP settings: from, to, reply-to, subject, html + text", async () => {
    const {
      deps: d,
      transport,
      createTransport,
    } = deps({
      loadConfig: async () => SAVED,
    })
    const result = await createMailer(d).send({
      to: ["a@example.ie", "b@example.ie"],
      replyTo: "visitor@example.ie",
      subject: "You're invited",
      template: "invite",
      react: invite,
    })
    expect(result).toEqual({ delivered: true })
    expect(createTransport).toHaveBeenCalledWith(SAVED)
    const options = vi.mocked(transport.sendMail).mock.calls[0][0]
    expect(options.from).toEqual({
      name: "Security Partners",
      address: "website@example.ie",
    })
    expect(options.to).toEqual(["a@example.ie", "b@example.ie"])
    expect(options.replyTo).toBe("visitor@example.ie")
    expect(options.subject).toBe("You're invited")
    expect(options.html).toContain(`href="${LINK}"`)
    expect(options.text).toContain(LINK)
    expect(transport.close).toHaveBeenCalledTimes(1)
  })

  it("unconfigured in production: not delivered, one info line with template + recipient domain only (never the link)", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined)
    const { deps: d, createTransport } = deps()
    const result = await createMailer(d).send({
      to: "someone@example.test",
      subject: "You're invited",
      template: "invite",
      react: invite,
    })
    expect(result).toEqual({ delivered: false })
    expect(createTransport).not.toHaveBeenCalled()
    expect(info).toHaveBeenCalledTimes(1)
    const logged = String(info.mock.calls[0][0])
    expect(logged).toContain("invite")
    expect(logged).toContain("*@example.test")
    expect(logged).not.toContain("someone")
    expect(logged).not.toContain("You're invited")
    expect(logged).not.toContain("abc123")
  })

  it("unconfigured under `next dev`: uses the dev Mailpit (spec §9)", async () => {
    const { deps: d, createTransport } = deps({ nodeEnv: () => "development" })
    const result = await createMailer(d).send({
      to: "someone@example.test",
      subject: "Hi",
      template: "invite",
      react: invite,
    })
    expect(result).toEqual({ delivered: true })
    expect(createTransport).toHaveBeenCalledWith(DEV_MAILPIT_SMTP)
    expect(DEV_MAILPIT_SMTP).toMatchObject({ host: "127.0.0.1", port: 1025 })
  })

  it("unconfigured under vitest (NODE_ENV=test): not delivered (phase correction)", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined)
    const { deps: d } = deps({ nodeEnv: () => "test" })
    expect(
      await createMailer(d).send({
        to: "x@example.test",
        subject: "S",
        template: "invite",
        react: invite,
      })
    ).toEqual({ delivered: false })
  })

  it("a send failure is { delivered: false }, logged with the error code but never its message", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const transport = fakeTransport(async () => {
      throw Object.assign(new Error(`rejected near ${LINK}`), {
        code: "EENVELOPE",
      })
    })
    const { deps: d } = deps({ loadConfig: async () => SAVED, transport })
    const result = await createMailer(d).send({
      to: "someone@example.test",
      subject: "You're invited",
      template: "invite",
      react: invite,
    })
    expect(result).toEqual({ delivered: false })
    expect(transport.close).toHaveBeenCalledTimes(1)
    const line = error.mock.calls.map((c) => c.map(String).join(" ")).join("\n")
    expect(line).toContain("EENVELOPE")
    expect(line).not.toContain("abc123")
    expect(line).not.toContain("someone")
  })

  it("lead acknowledgement: the visitor is logged as *@<visitor>, not even the domain", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined)
    const { deps: d } = deps()
    await createMailer(d).send({
      to: "dinn.ri@visitor-domain.example",
      subject: "We received your message – Security Partners",
      template: "lead-acknowledgement",
      react: invite,
    })
    const logged = String(info.mock.calls[0][0])
    expect(logged).toBe(
      "[mailer] SMTP is not configured; not sent: lead-acknowledgement to *@<visitor>"
    )
    expect(logged).not.toContain("visitor-domain")
  })

  it("lead emails: logs carry the template name and recipient domains, never the visitor's name or address", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const transport = fakeTransport(async () => {
      throw Object.assign(new Error("boom"), { code: "ECONNECTION" })
    })
    const { deps: d } = deps({ loadConfig: async () => SAVED, transport })
    await createMailer(d).send({
      to: ["ops@example.ie", "hr@example.ie", "boss@corp.example"],
      replyTo: "dinn.ri@visitor.example",
      subject: "Website enquiry from Dinn Rí",
      template: "lead-notification",
      react: invite,
    })
    const line = error.mock.calls.map((c) => c.map(String).join(" ")).join("\n")
    expect(line).toBe(
      "[mailer] sending lead-notification to *@example.ie, *@corp.example failed (ECONNECTION)"
    )
  })

  it("unreadable SMTP settings count as unconfigured (never throws)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    vi.spyOn(console, "info").mockImplementation(() => undefined)
    const { deps: d } = deps({
      loadConfig: async () => {
        throw new Error("secrets cannot be decrypted")
      },
    })
    expect(
      await createMailer(d).send({
        to: "x@example.test",
        subject: "S",
        template: "invite",
        react: invite,
      })
    ).toEqual({ delivered: false })
  })

  it("never throws: a template error is { delivered: false }, logged without the error message or link", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const Broken = () => {
      throw new Error(`template broke near ${LINK}`)
    }
    const { deps: d, createTransport } = deps({ loadConfig: async () => SAVED })
    const result = await createMailer(d).send({
      to: "someone@example.test",
      subject: "You're invited",
      template: "invite",
      react: <Broken />,
    })
    expect(result).toEqual({ delivered: false })
    expect(createTransport).not.toHaveBeenCalled()
    const ours = error.mock.calls
      .map((call) => call.map(String).join(" "))
      .filter((line) => line.startsWith("[mailer]"))
    expect(ours).toHaveLength(1)
    expect(ours[0]).toContain("invite")
    expect(ours[0]).not.toContain("You're invited")
    expect(ours[0]).not.toContain("someone")
    expect(ours[0]).not.toContain("abc123")
  })
})

describe("link expiry wording", () => {
  it("uses hours or days instead of large minute counts", async () => {
    const text = (email: ReactElement) => render(email, { plainText: true })
    expect(
      await text(
        <ResetPasswordEmail name="Sam" url={LINK} expiresInMinutes={1440} />
      )
    ).toContain("expires in 24 hours")
    expect(
      await text(
        <InviteEmail name="S" inviterName="O" url={LINK} expiresInDays={1} />
      )
    ).toContain("expires in 24 hours")
  })
})

describe("real SMTP transport (Phase 6 target guard on every send)", () => {
  const create = () =>
    vi.fn<(options: unknown) => ReturnType<typeof fakeTransport>>(() =>
      fakeTransport()
    )

  it("connects to the checked address, verifies TLS for the host and requires STARTTLS", async () => {
    const factory = create()
    await createSmtpTransport(SAVED, {
      resolveTarget: async () => ({ kind: "ok", address: "203.0.113.5" }),
      create: factory,
    })
    expect(factory).toHaveBeenCalledWith(
      smtpTransportOptions(SAVED, "203.0.113.5")
    )
    expect(factory.mock.calls[0][0]).toMatchObject({
      host: "203.0.113.5",
      port: 587,
      requireTLS: true,
      tls: { servername: "smtp.example.ie" },
      auth: { user: "mailer", pass: "pw-123456" },
    })
  })

  it("a blocked host is refused before any connection (code EBLOCKEDHOST)", async () => {
    const factory = create()
    await expect(
      createSmtpTransport(SAVED, {
        resolveTarget: async () => ({ kind: "blocked" }),
        create: factory,
      })
    ).rejects.toMatchObject({ code: "EBLOCKEDHOST" })
    expect(factory).not.toHaveBeenCalled()
  })

  it("an unresolvable host is refused (code EDNS)", async () => {
    await expect(
      createSmtpTransport(SAVED, {
        resolveTarget: async () => ({ kind: "unresolved" }),
        create: create(),
      })
    ).rejects.toMatchObject({ code: "EDNS" })
  })

  it.each(["169.254.169.254", "127.0.0.1"])(
    "uses resolveSmtpTarget by default: %s (link-local/metadata, loopback) is blocked in production",
    async (host) => {
      vi.stubEnv("NODE_ENV", "production")
      try {
        const factory = create()
        await expect(
          createSmtpTransport(
            { ...SAVED, host },
            {
              create: factory,
            }
          )
        ).rejects.toMatchObject({ code: "EBLOCKEDHOST" })
        expect(factory).not.toHaveBeenCalled()
      } finally {
        vi.unstubAllEnvs()
      }
    }
  )

  it("a blocked send is { delivered: false }, logged with the code only", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const result = await createMailer({
      loadConfig: async () => SAVED,
      nodeEnv: () => "production",
      createTransport: (c) =>
        createSmtpTransport(c, {
          resolveTarget: async () => ({ kind: "blocked" }),
          create: create(),
        }),
    }).send({
      to: "someone@example.test",
      subject: "S",
      template: "invite",
      react: invite,
    })
    expect(result).toEqual({ delivered: false })
    const line = error.mock.calls.map((c) => c.map(String).join(" ")).join("\n")
    expect(line).toContain("EBLOCKEDHOST")
    expect(line).not.toContain("pw-123456")
  })
})
