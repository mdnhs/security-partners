import { Button, Heading, Link, Text } from "react-email"

import { EmailLayout, emailStyles } from "./layout"
import { MessageLines } from "./message-lines"

export type ChatAlertProps = {
  /** Why the team is told, e.g. "The assistant asked for a person to take over." */
  reason: string
  /** The last visitor message (≤500 chars); null when alerts leave it out. */
  message: string | null
  /** Absolute `/admin/chat?c=<id>` URL. */
  href: string
}

const row = { ...emailStyles.text, margin: "0 0 8px" }

/** Staff alert: a live chat visitor needs a person (live chat plan C10). */
export function ChatAlert({ reason, message, href }: ChatAlertProps) {
  const quote = message?.trim()
  return (
    <EmailLayout preview={reason}>
      <Heading as="h1" style={emailStyles.heading}>
        Live chat
      </Heading>
      <Text style={row}>A visitor is on the chat.</Text>
      <Text style={row}>{reason}</Text>
      {quote ? (
        <Text style={{ ...emailStyles.text, whiteSpace: "pre-wrap" }}>
          <strong>Message:</strong> <MessageLines text={quote} />
        </Text>
      ) : null}
      <Button href={href} style={emailStyles.button}>
        Open the chat
      </Button>
      <Text style={emailStyles.small}>
        Open the chat:{" "}
        <Link href={href} style={emailStyles.link}>
          {href}
        </Link>
      </Text>
    </EmailLayout>
  )
}

export default ChatAlert
