import "server-only"

import {
  HeadBucketCommand,
  type S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3"
import nodemailer from "nodemailer"

import { baseUrlProblem, normaliseBaseUrl } from "@/lib/ai/base-url"
import {
  type AiConfig,
  type AiProvider,
  allowLocalAiHttp,
  type IntegrationConfig,
  type IntegrationKey,
  type R2Config,
  type SmtpConfig,
  type TurnstileConfig,
} from "@/lib/schemas/integrations"
import { isTimeoutError } from "@/server/lib/errors"
import { createR2Client, r2Failure } from "@/server/lib/r2-client"
import { isLoopbackHost } from "@/server/lib/smtp-target"

/** "Test connection" outcome: a failure is a result, not an exception. */
export type TestResult = { ok: boolean; message: string }
export type TestDeps = {
  fetch?: typeof fetch
  r2Client?: S3Client
  /** Pre-resolved, allowed address for the SMTP host (server/lib/smtp-target.ts). */
  smtpAddress?: string
}

const TIMEOUT_MS = 10_000
export const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify"

const pass = (message: string): TestResult => ({ ok: true, message })
const fail = (message: string): TestResult => ({ ok: false, message })
const errorCode = (err: unknown) => {
  const code = (err as { code?: unknown } | null)?.code
  return typeof code === "string" ? code : null
}

/**
 * Fixed texts for nodemailer failures. Error messages and server replies are
 * never echoed: they would turn "Test connection" into a probe of internal
 * services (and can contain what was sent).
 */
export function smtpFailureMessage(err: unknown): string {
  switch (errorCode(err)) {
    case "ECONNECTION":
    case "ECONNREFUSED":
    case "ENOTFOUND":
    case "EDNS":
    case "ESOCKET":
      return "Could not connect to the server"
    case "ETIMEDOUT":
      return "The server did not respond in time"
    case "EAUTH":
    case "ENOAUTH":
      return "The server rejected the user name or password"
    case "ETLS":
    case "EREQUIRETLS":
      return "Secure connection failed"
    default:
      return "The server did not answer like an email server"
  }
}

/**
 * Transport options. Without implicit TLS, STARTTLS is required (the
 * password never crosses the network in clear) except on loopback (dev
 * Mailpit). `address` connects to a pre-checked IP while TLS still
 * verifies the certificate for `host`.
 */
export function smtpTransportOptions(c: SmtpConfig, address: string = c.host) {
  return {
    host: address,
    port: c.port,
    secure: c.secure,
    requireTLS: !c.secure && !isLoopbackHost(c.host),
    tls: address === c.host ? undefined : { servername: c.host },
    auth: c.user ? { user: c.user, pass: c.password } : undefined,
    connectionTimeout: TIMEOUT_MS,
    greetingTimeout: TIMEOUT_MS,
    socketTimeout: TIMEOUT_MS,
  }
}

/** SMTP: open a connection, STARTTLS/TLS and sign in (transporter.verify(), notes §5.4). */
export async function testSmtp(
  c: SmtpConfig,
  address: string = c.host
): Promise<TestResult> {
  const transport = nodemailer.createTransport(smtpTransportOptions(c, address))
  try {
    await transport.verify()
    return pass(
      c.user
        ? `Connected to ${c.host}:${c.port} and signed in as ${c.user}.`
        : `Connected to ${c.host}:${c.port}.`
    )
  } catch (err) {
    return fail(`${smtpFailureMessage(err)} (${c.host}:${c.port}).`)
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
    }
    return fail(r2Failure(err).message)
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
      isTimeoutError(err)
        ? "Cloudflare did not respond in time."
        : "Could not reach Cloudflare."
    )
  }
}

const GOOGLE_API = "https://generativelanguage.googleapis.com/v1beta"

/** How each provider takes the API key (sent only to the saved target). */
export function aiAuthHeaders(
  provider: AiProvider,
  apiKey: string
): Record<string, string> {
  switch (provider) {
    case "anthropic":
      return { "x-api-key": apiKey, "anthropic-version": "2023-06-01" }
    case "google":
      return { "x-goog-api-key": apiKey }
    case "openai":
    case "openai-compatible":
      return { authorization: `Bearer ${apiKey}` }
    default: {
      const unknown: never = provider
      throw new Error(`Unknown AI provider ${String(unknown)}`)
    }
  }
}

/** The provider's model-list endpoint (a compatible base URL is checked by the caller). */
export function aiModelsUrl(provider: AiProvider, baseUrl: string): string {
  switch (provider) {
    case "anthropic":
      return "https://api.anthropic.com/v1/models"
    case "openai":
      return "https://api.openai.com/v1/models"
    case "google":
      return `${GOOGLE_API}/models`
    case "openai-compatible":
      return `${normaliseBaseUrl(baseUrl)}/models`
    default: {
      const unknown: never = provider
      throw new Error(`Unknown AI provider ${String(unknown)}`)
    }
  }
}

/** The provider's "retrieve model" endpoint: proves the key and the model, spends no tokens. */
export function aiModelRequest(c: AiConfig): {
  url: string
  headers: Record<string, string>
} {
  return {
    url: `${aiModelsUrl(c.provider, c.baseUrl)}/${encodeURIComponent(c.model)}`,
    headers: aiAuthHeaders(c.provider, c.apiKey),
  }
}

export async function testAi(
  c: AiConfig,
  fetchImpl: typeof fetch = fetch
): Promise<TestResult> {
  if (c.apiKey === "") return fail("Enter the API key first.")
  if (c.model === "") return fail("Enter the model first.")
  if (
    c.provider === "openai-compatible" &&
    baseUrlProblem(c.baseUrl, { allowLocalHttp: allowLocalAiHttp() })
  )
    return fail("The base URL is not allowed.")
  const { url, headers } = aiModelRequest(c)
  try {
    const res = await fetchImpl(url, {
      headers,
      redirect: "error",
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
      isTimeoutError(err)
        ? "The provider did not respond in time."
        : "Could not reach the provider."
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
      return testSmtp(config as SmtpConfig, deps.smtpAddress)
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
