import "server-only"

import { createHash } from "node:crypto"

import { S3Client, S3ServiceException } from "@aws-sdk/client-s3"

import type { R2Config } from "@/lib/schemas/integrations"
import { isTimeoutError } from "@/server/lib/errors"

/** S3 API endpoint of an R2 account (libraries notes §5.5). */
export function r2Endpoint(
  c: Pick<R2Config, "accountId" | "jurisdiction">
): string {
  return c.jurisdiction === "eu"
    ? `https://${c.accountId}.eu.r2.cloudflarestorage.com`
    : `https://${c.accountId}.r2.cloudflarestorage.com`
}

/**
 * S3 client for R2. Checksums only when an operation requires them: R2
 * does not implement several flexible-checksum headers (notes §5.5).
 */
export function createR2Client(c: R2Config): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: r2Endpoint(c),
    credentials: {
      accessKeyId: c.accessKeyId,
      secretAccessKey: c.secretAccessKey,
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    maxAttempts: 2,
    requestHandler: { connectionTimeout: 10_000, requestTimeout: 60_000 },
  })
}

/**
 * Fixed text for an R2 failure (Phase 6 Task 1 convention): provider
 * messages are never echoed and the original error is not kept as `cause`,
 * so nothing from the request (keys, endpoint) can reach logs or responses.
 */
export function r2Failure(err: unknown): Error {
  if (err instanceof S3ServiceException) {
    const status = err.$metadata.httpStatusCode
    return new Error(
      status ? `R2 answered with HTTP ${status}.` : "R2 answered with an error."
    )
  }
  return new Error(
    isTimeoutError(err) ? "R2 did not respond in time." : "Could not reach R2."
  )
}

/** Fields that shape the client (the bucket is per command). Hashed: no secret is kept in clear as a key. */
function clientFingerprint(c: R2Config): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        c.accountId,
        c.jurisdiction,
        c.accessKeyId,
        c.secretAccessKey,
      ])
    )
    .digest("hex")
}

let shared: { fingerprint: string; client: S3Client } | null = null

/**
 * One long-lived client per process for the saved R2 settings: its
 * keep-alive agent is reused across uploads and file reads. A changed
 * account or key pair replaces it (the old client is destroyed).
 */
export function sharedR2Client(c: R2Config): S3Client {
  const fingerprint = clientFingerprint(c)
  if (shared?.fingerprint === fingerprint) return shared.client
  shared?.client.destroy()
  shared = { fingerprint, client: createR2Client(c) }
  return shared.client
}

/** Drops the shared client (R2 disconnected; tests). */
export function resetR2Client(): void {
  shared?.client.destroy()
  shared = null
}
