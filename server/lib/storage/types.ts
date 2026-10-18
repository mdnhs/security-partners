import "server-only"

export type StorageName = "disk" | "r2"

/** Inclusive byte range, already checked against the object's size. */
export type ByteRange = { start: number; end: number }

/** A streamed object (or the requested range of it). */
export type StoredStream = {
  body: ReadableStream<Uint8Array>
  /** The whole object's size in bytes, whatever range was asked for. */
  size: number
}

/** Where uploaded files live (spec §11). Keys are validated by every call. */
export type StorageDriver = {
  name: StorageName
  put(key: string, body: Uint8Array, contentType: string): Promise<void>
  /** The object's bytes, or null when it does not exist. */
  read(key: string): Promise<Uint8Array | null>
  /**
   * The object (or `range` of it) as a stream, without buffering it; null
   * when it does not exist. The public file route serves this.
   */
  stream(key: string, range?: ByteRange): Promise<StoredStream | null>
  /** Deleting a missing object is not an error. */
  delete(key: string): Promise<void>
  /** Public URL: same origin for every driver (phase 6 correction). */
  url(key: string): string
  /** Throws when the storage cannot be used. */
  test(): Promise<void>
}
