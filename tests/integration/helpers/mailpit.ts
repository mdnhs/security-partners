// Mailpit HTTP API (docker-compose.dev.yml, UI/API on :8025). No "@/"
// imports: Playwright specs import this file too.
export const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:8025"

export type MailpitAddress = { Name: string; Address: string }
export type MailpitMessage = {
  ID: string
  Subject: string
  From: MailpitAddress
  To: MailpitAddress[]
  ReplyTo: MailpitAddress[]
  Text: string
  HTML: string
}
type Summary = Pick<MailpitMessage, "ID" | "Subject" | "To">

const query = (to: string) => encodeURIComponent(`to:"${to}"`)

export async function assertMailpitUp(): Promise<void> {
  try {
    const res = await fetch(`${MAILPIT_URL}/api/v1/messages?limit=1`)
    if (res.ok) return
  } catch {
    // fall through
  }
  throw new Error(
    `Mailpit is not reachable at ${MAILPIT_URL}. Start it with \`pnpm db:up\`.`
  )
}

async function search(to: string): Promise<Summary[]> {
  const res = await fetch(`${MAILPIT_URL}/api/v1/search?query=${query(to)}`)
  if (!res.ok) throw new Error(`Mailpit search failed (${res.status})`)
  return ((await res.json()) as { messages: Summary[] }).messages
}

export async function countMail(to: string): Promise<number> {
  return (await search(to)).length
}

/** Polls until a message to `to` (and with `subject`, if given) arrives. */
export async function waitForMail(
  to: string,
  opts: { subject?: string; timeoutMs?: number } = {}
): Promise<MailpitMessage> {
  const deadline = Date.now() + (opts.timeoutMs ?? 10_000)
  while (Date.now() < deadline) {
    const hit = (await search(to)).find(
      (m) => opts.subject === undefined || m.Subject === opts.subject
    )
    if (hit) {
      const res = await fetch(`${MAILPIT_URL}/api/v1/message/${hit.ID}`)
      if (!res.ok)
        throw new Error(`Mailpit message fetch failed (${res.status})`)
      return (await res.json()) as MailpitMessage
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error(`No email to ${to} arrived in Mailpit`)
}

export async function deleteMail(to: string): Promise<void> {
  const res = await fetch(`${MAILPIT_URL}/api/v1/search?query=${query(to)}`, {
    method: "DELETE",
  })
  if (!res.ok) throw new Error(`Mailpit delete failed (${res.status})`)
}
