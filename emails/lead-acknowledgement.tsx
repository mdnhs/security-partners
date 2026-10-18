import { Heading, Text } from "react-email"

import { EmailLayout, emailStyles } from "./layout"
import { MessageLines } from "./message-lines"

export type LeadAcknowledgementEmailProps = {
  name: string
  siteName: string
  message: string
  phone24h: string | null
}

/** Optional confirmation to the visitor (settings.leads.acknowledgement). */
export function LeadAcknowledgementEmail({
  name,
  siteName,
  message,
  phone24h,
}: LeadAcknowledgementEmailProps) {
  return (
    <EmailLayout preview={`We received your message to ${siteName}`}>
      <Heading as="h1" style={emailStyles.heading}>
        Thanks for your message
      </Heading>
      <Text style={emailStyles.text}>Hi {name},</Text>
      <Text style={emailStyles.text}>
        We received your message and will reply as soon as we can.
      </Text>
      {phone24h ? (
        <Text style={emailStyles.text}>
          For anything urgent, call our 24/7 line on {phone24h}.
        </Text>
      ) : null}
      <Text style={emailStyles.small}>Your message:</Text>
      <Text style={{ ...emailStyles.text, whiteSpace: "pre-wrap" }}>
        <MessageLines text={message} />
      </Text>
    </EmailLayout>
  )
}

export default LeadAcknowledgementEmail
