import { Button, Heading, Link, Text } from "react-email"

import { EmailLayout, emailStyles } from "./layout"

export type ApplicationNotificationEmailProps = {
  siteName: string
  adminUrl: string
  application: {
    name: string
    email: string
    phone: string
    jobTitle: string
    jobReference: string
    receivedAt: string
  }
}

const row = { ...emailStyles.text, margin: "0 0 8px" }

/**
 * Staff notice of a new job application. The answers and the CV stay in
 * the admin (private files, retention): the email carries no attachments.
 */
export function ApplicationNotificationEmail({
  siteName,
  adminUrl,
  application,
}: ApplicationNotificationEmailProps) {
  return (
    <EmailLayout
      preview={`New application for ${application.jobTitle} from ${application.name}`}
    >
      <Heading as="h1" style={emailStyles.heading}>
        New job application
      </Heading>
      <Text style={row}>
        <strong>Role:</strong> {application.jobTitle} (
        {application.jobReference})
      </Text>
      <Text style={row}>
        <strong>Name:</strong> {application.name}
      </Text>
      <Text style={row}>
        <strong>Email:</strong>{" "}
        <Link href={`mailto:${application.email}`} style={emailStyles.link}>
          {application.email}
        </Link>
      </Text>
      <Text style={row}>
        <strong>Phone:</strong> {application.phone}
      </Text>
      <Text style={row}>
        <strong>Received:</strong> {application.receivedAt}
      </Text>
      <Button href={adminUrl} style={emailStyles.button}>
        Open in the {siteName} admin
      </Button>
      <Text style={emailStyles.small}>
        The CV and full answers are in the admin only. Admin link:{" "}
        <Link href={adminUrl} style={emailStyles.link}>
          {adminUrl}
        </Link>
      </Text>
    </EmailLayout>
  )
}

export default ApplicationNotificationEmail
