import { z } from "zod"

export const SMTP_FIELDS = [
  "host",
  "port",
  "secure",
  "user",
  "password",
  "fromName",
  "fromAddress",
] as const
export const SMTP_SECRETS = ["password"] as const

/** Settings ▸ Integrations ▸ Email (spec §5.4). `password` is stored encrypted. */
export const smtpConfig = z
  .object({
    host: z
      .string({ error: "Required" })
      .trim()
      .min(1, "Required")
      .max(253)
      .regex(/^[A-Za-z0-9.-]+$/, "Enter a server name, e.g. smtp.example.ie"),
    port: z
      .number({ error: "Enter a port number" })
      .int("Enter a whole number")
      .min(1, "Between 1 and 65535")
      .max(65535, "Between 1 and 65535"),
    /** true = TLS from the first byte (port 465); false = STARTTLS when the server offers it (587, 25). */
    secure: z.boolean({ error: "Required" }),
    /** "" = the server needs no sign-in. */
    user: z.string({ error: "Required" }).trim().max(320),
    password: z.string().max(1000),
    fromName: z
      .string({ error: "Required" })
      .trim()
      .min(1, "Required")
      .max(100),
    fromAddress: z.email({ error: "Enter an email address" }),
  })
  .superRefine((value, ctx) => {
    if (value.user !== "" && value.password === "")
      ctx.addIssue({
        code: "custom",
        path: ["password"],
        message: "Enter the password for this user name",
      })
  })
export type SmtpConfig = z.output<typeof smtpConfig>

export const SMTP_DEFAULTS = {
  host: "",
  port: 587,
  secure: false,
  user: "",
  fromName: "Security Partners",
  fromAddress: "",
} as const
