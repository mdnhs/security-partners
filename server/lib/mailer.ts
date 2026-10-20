import "server-only"

import nodemailer from "nodemailer"
import type { ReactElement } from "react"
import { render } from "react-email"

import type { SmtpConfig } from "@/lib/schemas/integrations"
import { resolveSmtpTarget, type SmtpTarget } from "@/server/lib/smtp-target"
import { readIntegrationConfig } from "@/server/modules/integrations/service"
import { smtpTransportOptions } from "@/server/modules/integrations/testers"

/** Fixed names for logs: subjects can carry a visitor's name. */
export type MailTemplate =
  | "invite"
  | "reset-password"
  | "account-recovery"
  | "lead-notification"
  | "lead-acknowledgement"
  | "newsletter-confirmation"

export type MailMessage = {
  to: string | readonly string[]
  subject: string
  template: MailTemplate
  react: ReactElement
  replyTo?: string
}
export type SendResult = { delivered: boolean; previewUrl?: string }

/**
 * Spec §9: `next dev` with no saved SMTP settings sends to the dev Mailpit
 * (docker-compose.dev.yml). Only NODE_ENV "development" — tests and
 * production without settings send nothing (phase correction).
 */
export const DEV_MAILPIT_SMTP: SmtpConfig = {
  host: "127.0.0.1",
  port: 1025,
  secure: false,
  user: "",
  password: "",
  fromName: "Security Partners (dev)",
  fromAddress: "website@localhost.test",
}

export type MailTransport = {
  sendMail(options: {
    from: { name: string; address: string }
    to: string | string[]
    replyTo?: string
    subject: string
    html: string
    text: string
  }): Promise<unknown>
  close(): void
}

export type MailerDeps = {
  loadConfig(): Promise<SmtpConfig | null>
  nodeEnv(): string | undefined
  createTransport(config: SmtpConfig): MailTransport | Promise<MailTransport>
}

export type SmtpTransportDeps = {
  resolveTarget?: (host: string) => Promise<SmtpTarget>
  create?: (options: ReturnType<typeof smtpTransportOptions>) => MailTransport
}

const coded = (code: string, message: string) =>
  Object.assign(new Error(message), { code })

/**
 * The real transport, with the same guard as "Test connection" (Phase 6):
 * in production the host must not resolve to loopback, link-local or a
 * metadata address, and the connection goes to the checked IP (TLS still
 * verifies the certificate for the host name, so DNS cannot be rebound
 * between check and connect). STARTTLS is required off loopback.
 */
export async function createSmtpTransport(
  config: SmtpConfig,
  {
    resolveTarget = (host) => resolveSmtpTarget(host),
    create = (options) => nodemailer.createTransport(options),
  }: SmtpTransportDeps = {}
): Promise<MailTransport> {
  const target = await resolveTarget(config.host)
  if (target.kind === "blocked")
    throw coded("EBLOCKEDHOST", "SMTP host is not allowed")
  if (target.kind === "unresolved")
    throw coded("EDNS", "SMTP host could not be resolved")
  return create(smtpTransportOptions(config, target.address))
}

const defaultDeps: MailerDeps = {
  loadConfig: () => readIntegrationConfig("integrations.smtp"),
  nodeEnv: () => process.env.NODE_ENV,
  createTransport: (config) => createSmtpTransport(config),
}

const errorName = (err: unknown) =>
  err instanceof Error ? err.name : "unknown error"

/**
 * Recipients for logs: domains only ("*@example.ie"), de-duplicated, so a
 * visitor's address (lead acknowledgement) never reaches the log.
 */
export function recipientDomains(to: string | readonly string[]): string {
  const list = typeof to === "string" ? [to] : [...to]
  const domains = list.map((address) => {
    const at = address.lastIndexOf("@")
    if (at < 0) return "*"
    const domain = address.slice(at + 1).trim()
    return `*@${domain.toLowerCase()}`
  })
  return [...new Set(domains)].join(", ")
}

const errorCode = (err: unknown) => {
  const code = (err as { code?: unknown } | null)?.code
  return typeof code === "string" ? code : errorName(err)
}

/**
 * Transactional email (spec §9). Never throws: every failure is
 * `{ delivered: false }`. Logs name the template and recipient domains only —
 * never subjects, addresses, bodies, settings or error messages (visitor
 * PII, single-use links).
 */
export function createMailer(deps: MailerDeps = defaultDeps) {
  async function resolveConfig(): Promise<SmtpConfig | null> {
    let saved: SmtpConfig | null
    try {
      saved = await deps.loadConfig()
    } catch (err) {
      console.error(
        `[mailer] SMTP settings could not be read (${errorName(err)})`
      )
      return null
    }
    if (saved) return saved
    return deps.nodeEnv() === "development" ? DEV_MAILPIT_SMTP : null
  }

  return {
    async send({
      to,
      subject,
      template,
      react,
      replyTo,
    }: MailMessage): Promise<SendResult> {
      // The visitor's own domain can identify them: hide it too.
      const recipients =
        template === "lead-acknowledgement"
          ? "*@<visitor>"
          : recipientDomains(to)
      let html: string
      let text: string
      try {
        html = await render(react)
        text = await render(react, { plainText: true })
      } catch (err) {
        console.error(
          `[mailer] could not render ${template} to ${recipients} (${errorName(err)})`
        )
        return { delivered: false }
      }
      const config = await resolveConfig()
      if (!config) {
        console.info(
          `[mailer] SMTP is not configured; not sent: ${template} to ${recipients}`
        )
        return { delivered: false }
      }
      let transport: MailTransport | null = null
      try {
        transport = await deps.createTransport(config)
        await transport.sendMail({
          from: { name: config.fromName, address: config.fromAddress },
          to: typeof to === "string" ? to : [...to],
          ...(replyTo ? { replyTo } : {}),
          subject,
          html,
          text,
        })
        return { delivered: true }
      } catch (err) {
        console.error(
          `[mailer] sending ${template} to ${recipients} failed (${errorCode(err)})`
        )
        return { delivered: false }
      } finally {
        transport?.close()
      }
    },
  }
}

export const mailer = createMailer()
