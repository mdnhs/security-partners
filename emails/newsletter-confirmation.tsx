import { Button, Heading, Link, Text } from "react-email"

import { EmailLayout, emailStyles } from "./layout"
import { MessageLines } from "./message-lines"

export type NewsletterConfirmationProps = {
  subject: string
  body: string
  confirmUrl: string
  unsubscribeUrl: string
  siteName: string
}

/** Double opt-in mail (settings.newsletter.confirmationEmail). The link works once and expires in 7 days. */
export function NewsletterConfirmation({
  subject,
  body,
  confirmUrl,
  unsubscribeUrl,
  siteName,
}: NewsletterConfirmationProps) {
  return (
    <EmailLayout preview={`Confirm your subscription to ${siteName}`}>
      <Heading as="h1" style={emailStyles.heading}>
        {subject}
      </Heading>
      {body ? (
        <Text style={{ ...emailStyles.text, whiteSpace: "pre-wrap" }}>
          <MessageLines text={body} />
        </Text>
      ) : null}
      <Button href={confirmUrl} style={emailStyles.button}>
        Confirm subscription
      </Button>
      <Text style={emailStyles.small}>
        This link works once and expires in 7 days. If the button does not work,
        open this address:{" "}
        <Link href={confirmUrl} style={emailStyles.link}>
          {confirmUrl}
        </Link>
      </Text>
      <Text style={emailStyles.small}>
        Did not sign up?{" "}
        <Link href={unsubscribeUrl} style={emailStyles.link}>
          Unsubscribe
        </Link>
        .
      </Text>
    </EmailLayout>
  )
}

export default NewsletterConfirmation
