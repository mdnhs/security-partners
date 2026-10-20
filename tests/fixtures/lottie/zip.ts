import { crc32, deflateRawSync } from "node:zlib"

export type ZipEntry = {
  name: string
  data: Uint8Array | string
  /** Default: deflate (8). 0 = stored. */
  method?: 0 | 8
  /** Override the uncompressed size written to the headers (bomb tests). */
  declaredSize?: number
  /** General-purpose flags (bit 0 = encrypted). */
  flags?: number
}

const u16 = (n: number) => {
  const b = Buffer.alloc(2)
  b.writeUInt16LE(n)
  return b
}
const u32 = (n: number) => {
  const b = Buffer.alloc(4)
  b.writeUInt32LE(n >>> 0)
  return b
}

/** A minimal, valid ZIP archive (test fixture builder for dotLottie files). */
export function buildZip(entries: ZipEntry[]): Uint8Array<ArrayBuffer> {
  const locals: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0
  for (const entry of entries) {
    const raw = Buffer.from(
      typeof entry.data === "string" ? Buffer.from(entry.data) : entry.data
    )
    const method = entry.method ?? 8
    const body = method === 8 ? deflateRawSync(raw) : raw
    const name = Buffer.from(entry.name)
    const size = entry.declaredSize ?? raw.length
    const crc = crc32(raw)
    const flags = entry.flags ?? 0
    const local = Buffer.concat([
      u32(0x04034b50),
      u16(20),
      u16(flags),
      u16(method),
      u16(0),
      u16(0),
      u32(crc),
      u32(body.length),
      u32(size),
      u16(name.length),
      u16(0),
      name,
      body,
    ])
    central.push(
      Buffer.concat([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(flags),
        u16(method),
        u16(0),
        u16(0),
        u32(crc),
        u32(body.length),
        u32(size),
        u16(name.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        name,
      ])
    )
    locals.push(local)
    offset += local.length
  }
  const cd = Buffer.concat(central)
  const eocd = Buffer.concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(cd.length),
    u32(offset),
    u16(0),
  ])
  return new Uint8Array(Buffer.concat([...locals, cd, eocd]))
}

/** A dotLottie (v2 layout) holding `animation` as animations/<id>.json. */
export function buildDotLottie(
  animation: string,
  id = "logo"
): Uint8Array<ArrayBuffer> {
  return buildZip([
    {
      name: "manifest.json",
      data: JSON.stringify({
        version: "2",
        generator: "test",
        animations: [{ id }],
      }),
    },
    { name: `animations/${id}.json`, data: animation },
  ])
}
