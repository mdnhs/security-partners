import "server-only"

import {
  HeadBucketCommand,
  type S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3"
import nodemailer from "nodemailer"

import type {
  AiConfig,
  IntegrationConfig,
  IntegrationKey,
  R2Config,
  SmtpConfig,
  TurnstileConfig,
} from "@/lib/schemas/integrations"
import { createR2Client } from "@/server/lib/r2-client"

/** "Test connection" outcome: a failure is a result, not an exception. */
export type TestResult = { ok: boolean; message: string }
export type TestDeps = { fetch?: typeof fetch; r2Client?: S3Client }

const TIMEOUT_MS = 10_000
export const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify"

const pass = (message: string): TestResult => ({ ok: true, message })
const fail = (message: string): TestResult => ({ ok: false, message })
const errorText = (err: unknown) =>
  err instanceof Error ? err.message : String(err)

/** Error texts may echo what they were given: mask every secret (4+ chars). */
export function redactSecrets(
  message: string,
  secrets: readonly string[]
): string {
  return secrets
    .filter((secret) => secret.length >= 4)
    .reduce((text, secret) => text.split(secret).join("••••"), message)
}

/** SMTP: open a connection, STARTTLS/TLS and sign in (transporter.verify(), notes §5.4). */
export async function testSmtp(c: SmtpConfig): Promise<TestResult> {
  const transport = nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.secure,
    auth: c.user ? { user: c.user, pass: c.password } : undefined,
    connectionTimeout: TIMEOUT_MS,
    greetingTimeout: TIMEOUT_MS,
    socketTimeout: TIMEOUT_MS,
  })
  try {
    await transport.verify()
    return pass(
      c.user
        ? `Connected to ${c.host}:${c.port} and signed in as ${c.user}.`
        : `Connected to ${c.host}:${c.port}.`
    )
  } catch (err) {
    const code = (err as { code?: unknown }).code
    return fail(
      redactSecrets(
        `Could not connect to ${c.host}:${c.port}${typeof code === "string" ? ` (${code})` : ""}: ${errorText(err)}`,
        [c.password]
      )
    )
  } finally {
    transport.close()
  }
}

/** R2: HeadBucket with the saved keys (notes §5.5). */
export async function testR2(
  c: R2Config,
  client: S3Client = createR2Client(c)
): Promise<TestResult> {
  try {
    await client.send(new HeadBucketCommand({ Bucket: c.bucket }))
    return pass(`Bucket “${c.bucket}” is reachable with these keys.`)
  } catch (err) {
    if (err instanceof S3ServiceException) {
      const status = err.$metadata.httpStatusCode
      if (status === 404)
        return fail(`Bucket “${c.bucket}” was not found in this account.`)
      if (status === 401 || status === 403)
        return fail(
          "Access denied: check the access key ID, the secret and the token's bucket permissions."
        )
      return fail(`R2 answered ${status ?? "with an error"} (${err.name}).`)
    }
    return fail(
      redactSecrets(`Could not reach R2: ${errorText(err)}`, [
        c.secretAccessKey,
        c.accessKeyId,
      ])
    )
  } finally {
    client.destroy()
  }
}

/**
 * Turnstile: siteverify with a dummy token. A valid secret rejects only the
 * token ("invalid-input-response"); a wrong one answers "invalid-input-secret".
 */
export async function testTurnstile(
  c: TurnstileConfig,
  fetchImpl: typeof fetch = fetch
): Promise<TestResult> {
  if (c.secretKey === "") return fail("Enter the secret key first.")
  try {
    const res = await fetchImpl(TURNSTILE_VERIFY_URL, {
      method: "POST",
      body: new URLSearchParams({
        secret: c.secretKey,
        response: "sp-connection-test",
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const body = (await res.json().catch(() => ({}))) as {
      "error-codes"?: string[]
    }
    const codes = body["error-codes"] ?? []
    if (
      codes.includes("invalid-input-secret") ||
      codes.includes("missing-input-secret")
    )
      return fail("Cloudflare rejected the secret key.")
    if (!res.ok) return fail(`Cloudflare answered ${res.status}.`)
    return pass("Cloudflare accepted the secret key.")
  } catch (err) {
    return fail(
      redactSecrets(`Could not reach Cloudflare: ${errorText(err)}`, [
        c.secretKey,
      ])
    )
  }
}

/** The provider's "retrieve model" endpoint: proves the key and the model, spends no tokens. */
export function aiModelRequest(c: AiConfig): {
  url: string
  headers: Record<string, string>
} {
  const model = encodeURIComponent(c.model)
  if (c.provider === "anthropic")
    return {
      url: `https://api.anthropic.com/v1/models/${model}`,
      headers: { "x-api-key": c.apiKey, "anthropic-version": "2023-06-01" },
    }
  return {
    url: `https://api.openai.com/v1/models/${model}`,
    headers: { authorization: `Bearer ${c.apiKey}` },
  }
}

export async function testAi(
  c: AiConfig,
  fetchImpl: typeof fetch = fetch
): Promise<TestResult> {
  if (c.apiKey === "") return fail("Enter the API key first.")
  if (c.model === "") return fail("Enter the model first.")
  const { url, headers } = aiModelRequest(c)
  try {
    const res = await fetchImpl(url, {
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (res.ok)
      return pass(`The key works and model “${c.model}” is available.`)
    if (res.status === 401 || res.status === 403)
      return fail("The API key was rejected.")
    if (res.status === 404)
      return fail(`The key works, but model “${c.model}” was not found.`)
    return fail(`The provider answered ${res.status}.`)
  } catch (err) {
    return fail(
      redactSecrets(`Could not reach the provider: ${errorText(err)}`, [
        c.apiKey,
      ])
    )
  }
}

export async function runIntegrationTest<K extends IntegrationKey>(
  key: K,
  config: IntegrationConfig<K>,
  deps: TestDeps = {}
): Promise<TestResult> {
  switch (key) {
    case "integrations.smtp":
      return testSmtp(config as SmtpConfig)
    case "integrations.r2":
      return testR2(
        config as R2Config,
        deps.r2Client ?? createR2Client(config as R2Config)
      )
    case "integrations.turnstile":
      return testTurnstile(config as TurnstileConfig, deps.fetch)
    case "integrations.ai":
      return testAi(config as AiConfig, deps.fetch)
    default:
      throw new Error(`No test for ${key}`)
  }
}
