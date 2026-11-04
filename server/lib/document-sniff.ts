import "server-only"

/** What an application upload really is, by its bytes (never its name or the browser's type). */
export type DocumentMime =
  | "application/pdf"
  | "application/msword"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  | "image/jpeg"
  | "image/png"

const startsWith = (b: Uint8Array, sig: readonly number[], at = 0) =>
  b.length >= at + sig.length && sig.every((v, i) => b[at + i] === v)

const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d] // %PDF-
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]
const ZIP = [0x50, 0x4b, 0x03, 0x04]
const JPEG = [0xff, 0xd8, 0xff]
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

const u16 = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8)
const u32 = (b: Uint8Array, at: number) =>
  (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16)) + b[at + 3] * 0x1000000

/** Entry names of a ZIP's central directory; null when it has none (not a ZIP we can read). */
function zipEntryNames(b: Uint8Array): string[] | null {
  // End of central directory: 22 bytes + a comment of at most 65,535.
  const floor = Math.max(0, b.length - 22 - 0xffff)
  let end = -1
  for (let i = b.length - 22; i >= floor; i--)
    if (startsWith(b, [0x50, 0x4b, 0x05, 0x06], i)) {
      end = i
      break
    }
  if (end < 0) return null
  const count = u16(b, end + 10)
  let at = u32(b, end + 16)
  const names: string[] = []
  const decoder = new TextDecoder()
  for (let n = 0; n < count; n++) {
    if (!startsWith(b, [0x50, 0x4b, 0x01, 0x02], at)) return null
    const nameLength = u16(b, at + 28)
    const extraLength = u16(b, at + 30)
    const commentLength = u16(b, at + 32)
    if (at + 46 + nameLength > b.length) return null
    names.push(decoder.decode(b.subarray(at + 46, at + 46 + nameLength)))
    at += 46 + nameLength + extraLength + commentLength
  }
  return names
}

export function sniffDocument(bytes: Uint8Array): DocumentMime | null {
  if (startsWith(bytes, PDF)) return "application/pdf"
  if (startsWith(bytes, OLE)) return "application/msword"
  if (startsWith(bytes, JPEG)) return "image/jpeg"
  if (startsWith(bytes, PNG)) return "image/png"
  if (startsWith(bytes, ZIP)) {
    const names = zipEntryNames(bytes)
    // A .docm also holds word/document.xml; its macros live in vbaProject.bin.
    return names?.includes("word/document.xml") &&
      !names.some((name) => name.toLowerCase().endsWith("vbaproject.bin"))
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : null
  }
  return null
}
