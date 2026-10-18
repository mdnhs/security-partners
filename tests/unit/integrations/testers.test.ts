import { S3ServiceException, type S3Client } from "@aws-sdk/client-s3"
import { describe, expect, it, vi } from "vitest"

import type {
  AiConfig,
  R2Config,
  SmtpConfig,
  TurnstileConfig,
} from "@/lib/schemas/integrations"
import { r2Endpoint } from "@/server/lib/r2-client"
import {
  smtpFailureMessage,
  smtpTransportOptions,
  testAi,
  testR2,
  testSmtp,
  testTurnstile,
} from "@/server/modules/integrations/testers"

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

describe("testSmtp", () => {
  it("reports a refused connection without the password", async () => {
    const config: SmtpConfig = {
      host: "127.0.0.1",
      port: 1,
      secure: false,
      user: "mailer",
      password: "super-secret-pw",
      fromName: "SP",
      fromAddress: "no-reply@example.ie",
    }
    const result = await testSmtp(config)
    expect(result.ok).toBe(false)
    expect(result.message).toBe(
      "Could not connect to the server (127.0.0.1:1)."
    )
    expect(result.message).not.toContain("super-secret-pw")
  })

  it("maps nodemailer codes to fixed texts, never the error message", () => {
    const err = (code: string) =>
      Object.assign(new Error(`535 5.7.8 internal banner for ${code}`), {
        code,
      })
    const cases: Record<string, string> = {
      ECONNECTION: "Could not connect to the server",
      ECONNREFUSED: "Could not connect to the server",
      ENOTFOUND: "Could not connect to the server",
      ETIMEDOUT: "The server did not respond in time",
      EAUTH: "The server rejected the user name or password",
      ETLS: "Secure connection failed",
      EPROTOCOL: "The server did not answer like an email server",
      ESOMETHING: "The server did not answer like an email server",
    }
    for (const [code, message] of Object.entries(cases))
      expect(smtpFailureMessage(err(code))).toBe(message)
    expect(smtpFailureMessage(new Error("no code"))).toBe(
      "The server did not answer like an email server"
    )
  })

  const remote: SmtpConfig = {
    host: "smtp.example.ie",
    port: 587,
    secure: false,
    user: "mailer",
    password: "pw",
    fromName: "SP",
    fromAddress: "no-reply@example.ie",
  }

  it("requires STARTTLS without implicit TLS, except on loopback", () => {
    expect(smtpTransportOptions(remote).requireTLS).toBe(true)
    expect(
      smtpTransportOptions({ ...remote, secure: true, port: 465 }).requireTLS
    ).toBe(false)
    expect(
      smtpTransportOptions({ ...remote, host: "127.0.0.1" }).requireTLS
    ).toBe(false)
    expect(
      smtpTransportOptions({ ...remote, host: "localhost" }).requireTLS
    ).toBe(false)
  })

  it("connects to a pre-checked address while TLS verifies the host name", () => {
    expect(smtpTransportOptions(remote, "10.0.0.25")).toMatchObject({
      host: "10.0.0.25",
      tls: { servername: "smtp.example.ie" },
    })
    expect(smtpTransportOptions(remote).tls).toBeUndefined()
  })
})

describe("r2Endpoint", () => {
  it("uses the EU host for EU-jurisdiction buckets", () => {
    const accountId = "0123456789abcdef0123456789abcdef"
    expect(r2Endpoint({ accountId, jurisdiction: "eu" })).toBe(
      `https://${accountId}.eu.r2.cloudflarestorage.com`
    )
    expect(r2Endpoint({ accountId, jurisdiction: "default" })).toBe(
      `https://${accountId}.r2.cloudflarestorage.com`
    )
  })
})

describe("testR2 (HeadBucket)", () => {
  const config: R2Config = {
    accountId: "0123456789abcdef0123456789abcdef",
    jurisdiction: "default",
    bucket: "sp-media",
    accessKeyId: "AKIDEXAMPLE",
    secretAccessKey: "secret-access-key",
  }
  const client = (send: () => Promise<unknown>) =>
    ({ send: vi.fn(send), destroy: vi.fn() }) as unknown as S3Client
  const s3Error = (name: string, status: number) =>
    new S3ServiceException({
      name,
      $fault: "client",
      $metadata: { httpStatusCode: status },
      message: name,
    })

  it("ok when the bucket answers", async () => {
    const c = client(async () => ({}))
    expect(await testR2(config, c)).toEqual({
      ok: true,
      message: "Bucket “sp-media” is reachable with these keys.",
    })
    const command = (c.send as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(command.constructor.name).toBe("HeadBucketCommand")
    expect(command.input).toEqual({ Bucket: "sp-media" })
  })

  it("maps 404 / 403 / other failures", async () => {
    expect(
      (
        await testR2(
          config,
          client(async () => {
            throw s3Error("NotFound", 404)
          })
        )
      ).message
    ).toMatch(/not found/)
    expect(
      (
        await testR2(
          config,
          client(async () => {
            throw s3Error("Forbidden", 403)
          })
        )
      ).message
    ).toMatch(/Access denied/)
    const network = await testR2(
      config,
      client(async () => {
        throw new Error("getaddrinfo ENOTFOUND secret-access-key")
      })
    )
    expect(network.ok).toBe(false)
    expect(network.message).toBe("Could not reach R2.")
    expect(
      (
        await testR2(
          config,
          client(async () => {
            throw s3Error("SlowDown", 503)
          })
        )
      ).message
    ).toBe("R2 answered with HTTP 503.")
  })
})

describe("testTurnstile (siteverify with a dummy token)", () => {
  const config: TurnstileConfig = {
    enabled: true,
    siteKey: "0x4AAAAAAA",
    secretKey: "0x4AAAAAAA-secret",
  }

  it("a valid secret rejects only the dummy token", async () => {
    const fetchImpl = vi.fn(async () =>
      json({ success: false, "error-codes": ["invalid-input-response"] })
    )
    expect((await testTurnstile(config, fetchImpl)).ok).toBe(true)
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(url).toBe(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify"
    )
    expect(String(init.body)).toContain("secret=0x4AAAAAAA-secret")
  })

  it("a wrong secret fails; no secret fails without a request", async () => {
    const bad = vi.fn(async () =>
      json({ success: false, "error-codes": ["invalid-input-secret"] })
    )
    expect(await testTurnstile(config, bad)).toEqual({
      ok: false,
      message: "Cloudflare rejected the secret key.",
    })
    const none = vi.fn()
    expect((await testTurnstile({ ...config, secretKey: "" }, none)).ok).toBe(
      false
    )
    expect(none).not.toHaveBeenCalled()
  })
})

describe("testAi (GET the model)", () => {
  const anthropic: AiConfig = {
    enabled: true,
    provider: "anthropic",
    model: "claude-sonnet-4-5",
    apiKey: "sk-ant-secret",
    allowedRoles: ["owner"],
  }

  it("calls the provider's model endpoint with the key", async () => {
    const fetchImpl = vi.fn(async () => json({ id: "claude-sonnet-4-5" }))
    expect((await testAi(anthropic, fetchImpl)).ok).toBe(true)
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(url).toBe("https://api.anthropic.com/v1/models/claude-sonnet-4-5")
    expect(init.headers).toMatchObject({
      "x-api-key": "sk-ant-secret",
      "anthropic-version": "2023-06-01",
    })

    const openai = vi.fn(async () => json({ id: "gpt-5" }))
    await testAi(
      { ...anthropic, provider: "openai", model: "gpt-5", apiKey: "sk-o" },
      openai
    )
    const [openaiUrl, openaiInit] = openai.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(openaiUrl).toBe("https://api.openai.com/v1/models/gpt-5")
    expect(openaiInit.headers).toMatchObject({ authorization: "Bearer sk-o" })
  })

  it("maps 401 and 404", async () => {
    expect(
      (
        await testAi(
          anthropic,
          vi.fn(async () => json({}, 401))
        )
      ).message
    ).toBe("The API key was rejected.")
    expect(
      (
        await testAi(
          anthropic,
          vi.fn(async () => json({}, 404))
        )
      ).message
    ).toBe("The key works, but model “claude-sonnet-4-5” was not found.")
  })

  it("network failures give fixed texts (no raw error or provider body)", async () => {
    const boom = vi.fn(async () => {
      throw new Error("connect ECONNREFUSED 10.1.2.3:443 sk-ant-secret")
    })
    expect((await testAi(anthropic, boom)).message).toBe(
      "Could not reach the provider."
    )
    const slow = vi.fn(async () => {
      throw new DOMException("timed out", "TimeoutError")
    })
    expect((await testAi(anthropic, slow)).message).toBe(
      "The provider did not respond in time."
    )
    expect(
      (
        await testTurnstile(
          {
            enabled: true,
            siteKey: "0x4AAAAAAA",
            secretKey: "0x4AAAAAAA-secret",
          },
          boom
        )
      ).message
    ).toBe("Could not reach Cloudflare.")
  })
})
