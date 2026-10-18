import { Button, Heading, Link, Text } from "react-email"

import { EmailLayout, emailStyles } from "./layout"

export type LeadNotificationEmailProps = {
  siteName: string
  adminUrl: string
  lead: {
    name: string
    email: string
    phone: string | null
    company: string | null
    service: string | null
    message: string
    sourcePage: string | null
    receivedAt: string
  }
}

const row = { ...emailStyles.text, margin: "0 0 8px" }

/** Staff notification for a new website enquiry (spec §9). */
export function LeadNotificationEmail({
  siteName,
  adminUrl,
  lead,
}: LeadNotificationEmailProps) {
  return (
    <EmailLayout preview={`New enquiry from ${lead.name}`}>
      <Heading as="h1" style={emailStyles.heading}>
        New website enquiry
      </Heading>
      <Text style={row}>
        <strong>Name:</strong> {lead.name}
      </Text>
      <Text style={row}>
        <strong>Email:</strong>{" "}
        <Link href={`mailto:${lead.email}`} style={emailStyles.link}>
          {lead.email}
        </Link>
      </Text>
      {lead.phone ? (
        <Text style={row}>
          <strong>Phone:</strong> {lead.phone}
        </Text>
      ) : null}
      {lead.company ? (
        <Text style={row}>
          <strong>Company:</strong> {lead.company}
        </Text>
      ) : null}
      {lead.service ? (
        <Text style={row}>
          <strong>Service:</strong> {lead.service}
        </Text>
      ) : null}
      <Text style={row}>
        <strong>Received:</strong> {lead.receivedAt}
        {lead.sourcePage ? ` from ${lead.sourcePage}` : ""}
      </Text>
      <Text style={{ ...emailStyles.text, whiteSpace: "pre-wrap" }}>
        {lead.message}
      </Text>
      <Button href={adminUrl} style={emailStyles.button}>
        Open in the {siteName} admin
      </Button>
      <Text style={emailStyles.small}>
        Reply to this email to answer {lead.name} directly. Admin link:{" "}
        <Link href={adminUrl} style={emailStyles.link}>
          {adminUrl}
        </Link>
      </Text>
    </EmailLayout>
  )
}

export default LeadNotificationEmail
