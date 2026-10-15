import { readFileSync } from "node:fs"

type Entry = {
  id: string
  source: string
  kind: string
  value: string
  target: string
  pages: string[]
}

const KINDS = new Set([
  "text",
  "richText",
  "image",
  "alt",
  "href",
  "tel",
  "mailto",
  "list",
  "aria",
  "meta",
])
const ROOTS = [
  /^pages\.(home|about|services|team|blog|contact|privacy|terms)\./,
  /^services\[[a-z0-9-]*\]\./,
  /^articles\[[a-z0-9-]*\]\./,
  /^(team|clients|groupCompanies|categories)\[\]\./,
  /^settings\.(site|contact|navigation|footer|sections\.enquireBanner|sections\.clients|sections\.whyChooseUs|sections\.about|sections\.contact|seo\.defaults|consent|tracking|customCode|microcopy|leads)\./,
]

const raw = JSON.parse(readFileSync("docs/brief-inventory.json", "utf8")) as {
  version: number
  entries: Entry[]
}
const errors: string[] = []
if (raw.version !== 1) errors.push("version must be 1")
const ids = new Set<string>()
for (const e of raw.entries) {
  if (ids.has(e.id)) errors.push(`duplicate id ${e.id}`)
  ids.add(e.id)
  if (!KINDS.has(e.kind)) errors.push(`${e.id}: bad kind ${e.kind}`)
  if (!ROOTS.some((r) => r.test(e.target)))
    errors.push(`${e.id}: bad target ${e.target}`)
  if (!/^(app|components)\/.+:\d+$/.test(e.source))
    errors.push(`${e.id}: bad source ${e.source}`)
  const [file, line] = e.source.split(":")
  const lines = readFileSync(file, "utf8").split("\n")
  if (Number(line) < 1 || Number(line) > lines.length)
    errors.push(`${e.id}: line out of range`)
  if (!Array.isArray(e.pages) || e.pages.length === 0)
    errors.push(`${e.id}: pages empty`)
}
if (raw.entries.length < 150)
  errors.push(`only ${raw.entries.length} entries — inventory incomplete`)
if (errors.length) {
  console.error(errors.join("\n"))
  process.exit(1)
}
console.log(`inventory ok: ${raw.entries.length} entries`)
