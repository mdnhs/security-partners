import { ROLE_INFO } from "@/lib/admin/user-roles"
import type { Role } from "@/lib/auth/roles"
import {
  AI_DEFAULT_MODEL,
  AI_ROLES,
  type IntegrationKey,
} from "@/lib/schemas/integrations"

export type FieldMeta =
  | {
      name: string
      kind: "text"
      label: string
      help?: string
      placeholder?: string
      type?: "text" | "email"
      autoComplete?: string
      /** Marked "(optional)" (required is the default, as in every admin form). */
      optional?: boolean
      /** A sign-in name next to a secret: password managers must not fill it. */
      ignorePasswordManagers?: boolean
    }
  | {
      name: string
      kind: "number"
      label: string
      help?: string
      min: number
      max: number
    }
  | { name: string; kind: "toggle"; label: string; help?: string }
  | {
      name: string
      kind: "select"
      label: string
      help?: string
      options: readonly { value: string; label: string }[]
    }
  | { name: string; kind: "secret"; label: string; help?: string }
  | {
      name: string
      kind: "roles"
      label: string
      help?: string
      roles: readonly Role[]
    }

export type IntegrationFormMeta = {
  intro: string
  fields: readonly FieldMeta[]
}

/** Role names as the Users screen shows them. */
export const ROLE_NAMES = Object.fromEntries(
  Object.entries(ROLE_INFO).map(([role, info]) => [role, info.label])
) as Record<Role, string>

/** Settings ▸ Integrations forms (fields of lib/schemas/integrations, in order). */
export const INTEGRATION_FORMS: Record<IntegrationKey, IntegrationFormMeta> = {
  "integrations.smtp": {
    intro:
      "Used for invitations, password resets and enquiry emails. Until it is set up, the admin shows links to copy instead.",
    fields: [
      {
        name: "host",
        kind: "text",
        label: "SMTP server",
        placeholder: "smtp.example.ie",
        autoComplete: "off",
      },
      {
        name: "port",
        kind: "number",
        label: "Port",
        help: "587 (STARTTLS) or 465 (TLS).",
        min: 1,
        max: 65535,
      },
      {
        name: "secure",
        kind: "toggle",
        label: "Use TLS from the start",
        help: "On for port 465. Off for 587 or 25: the connection is upgraded with STARTTLS when the server offers it.",
      },
      {
        name: "user",
        kind: "text",
        label: "User name",
        help: "Leave empty if the server needs no sign-in.",
        autoComplete: "off",
        optional: true,
        ignorePasswordManagers: true,
      },
      { name: "password", kind: "secret", label: "Password" },
      {
        name: "fromName",
        kind: "text",
        label: "Sender name",
        autoComplete: "off",
      },
      {
        name: "fromAddress",
        kind: "text",
        type: "email",
        label: "Sender address",
        help: "Messages are sent from this address.",
        autoComplete: "off",
      },
    ],
  },
  "integrations.r2": {
    intro:
      "New uploads go to this bucket once it is saved. Files already on the server disk can be moved below.",
    fields: [
      {
        name: "accountId",
        kind: "text",
        label: "Account ID",
        help: "Cloudflare dashboard › R2 › Account details.",
        autoComplete: "off",
      },
      {
        name: "jurisdiction",
        kind: "select",
        label: "Location",
        options: [
          { value: "default", label: "Default" },
          { value: "eu", label: "European Union (EU jurisdiction bucket)" },
        ],
      },
      {
        name: "bucket",
        kind: "text",
        label: "Bucket name",
        autoComplete: "off",
      },
      {
        name: "keyPrefix",
        kind: "text",
        label: "Folder",
        placeholder: "sp",
        help: "Keeps this site's files in a folder of the bucket, e.g. sp for a bucket shared with another site. Lowercase letters, digits, - and _, folders separated by /. Changing it does not move files already stored, so it cannot change while uploads are stored in R2.",
        autoComplete: "off",
        optional: true,
      },
      {
        name: "accessKeyId",
        kind: "secret",
        label: "Access key ID",
        help: "From an R2 API token with Object Read & Write on this bucket.",
      },
      { name: "secretAccessKey", kind: "secret", label: "Secret access key" },
    ],
  },
  "integrations.turnstile": {
    intro:
      "Adds Cloudflare's invisible check to the contact form when it is on.",
    fields: [
      { name: "enabled", kind: "toggle", label: "Protect the contact form" },
      {
        name: "siteKey",
        kind: "text",
        label: "Site key",
        help: "Public key shown in the Turnstile widget settings.",
        autoComplete: "off",
      },
      { name: "secretKey", kind: "secret", label: "Secret key" },
    ],
  },
  "integrations.ai": {
    intro:
      "Gives the roles you choose a writing assistant in the admin. Off until you turn it on.",
    fields: [
      { name: "enabled", kind: "toggle", label: "Turn on the assistant" },
      {
        name: "provider",
        kind: "select",
        label: "Provider",
        options: [
          { value: "anthropic", label: "Anthropic (Claude)" },
          { value: "openai", label: "OpenAI" },
        ],
      },
      {
        name: "model",
        kind: "text",
        label: "Model ID",
        placeholder: AI_DEFAULT_MODEL,
        autoComplete: "off",
        help: "Claude: claude-sonnet-5-5 (balanced, the default), claude-opus-5-5 (most capable) or claude-haiku-5-5 (fastest). OpenAI: the model ID from your OpenAI account.",
      },
      { name: "apiKey", kind: "secret", label: "API key" },
      {
        name: "allowedRoles",
        kind: "roles",
        label: "Who can use it",
        help: "Only these roles see the assistant.",
        roles: AI_ROLES,
      },
    ],
  },
}
