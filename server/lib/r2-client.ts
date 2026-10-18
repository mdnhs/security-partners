import "server-only"

import { S3Client } from "@aws-sdk/client-s3"

import type { R2Config } from "@/lib/schemas/integrations"

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
