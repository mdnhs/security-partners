import "server-only"

export type StorageName = "disk" | "r2"

/** Where uploaded files live (spec §11). Keys are validated by every call. */
export type StorageDriver = {
  name: StorageName
  put(key: string, body: Uint8Array, contentType: string): Promise<void>
  /** The object's bytes, or null when it does not exist. */
  read(key: string): Promise<Uint8Array | null>
  /** Deleting a missing object is not an error. */
  delete(key: string): Promise<void>
  /** Public URL: same origin for every driver (phase 6 correction). */
  url(key: string): string
  /** Throws when the storage cannot be used. */
  test(): Promise<void>
}
