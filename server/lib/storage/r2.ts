import "server-only"

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  type S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3"

import type { R2Config } from "@/lib/schemas/integrations"
import { r2Failure, sharedR2Client } from "@/server/lib/r2-client"

import { IMMUTABLE_CACHE, keySegments, mediaFileUrl } from "./paths"
import type { StorageDriver } from "./types"

/** GetObject on a missing key. A missing bucket (NoSuchBucket) is a failure. */
const isMissing = (err: unknown) =>
  err instanceof S3ServiceException && err.name === "NoSuchKey"

/** Cloudflare R2 through the S3 API (libraries notes §5.5). Private bucket; files are served by our origin. */
export function r2Storage(
  config: R2Config,
  client: S3Client = sharedR2Client(config)
): StorageDriver {
  const Bucket = config.bucket
  const send = async <T>(run: () => Promise<T>): Promise<T> => {
    try {
      return await run()
    } catch (err) {
      throw r2Failure(err)
    }
  }
  return {
    name: "r2",
    async put(key, body, contentType) {
      keySegments(key)
      await send(() =>
        client.send(
          new PutObjectCommand({
            Bucket,
            Key: key,
            Body: body,
            ContentType: contentType,
            ContentLength: body.byteLength,
            CacheControl: IMMUTABLE_CACHE,
          })
        )
      )
    },
    async read(key) {
      keySegments(key)
      try {
        const out = await client.send(
          new GetObjectCommand({ Bucket, Key: key })
        )
        return out.Body ? await out.Body.transformToByteArray() : null
      } catch (err) {
        if (isMissing(err)) return null
        throw r2Failure(err)
      }
    },
    async delete(key) {
      keySegments(key)
      await send(() =>
        client.send(new DeleteObjectCommand({ Bucket, Key: key }))
      )
    },
    url: mediaFileUrl,
    async test() {
      await send(() => client.send(new HeadBucketCommand({ Bucket })))
    },
  }
}
