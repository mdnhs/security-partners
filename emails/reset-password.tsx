import { Button, Heading, Link, Text } from "react-email"

import { EmailLayout, emailStyles } from "./layout"

export type ResetPasswordEmailProps = {
  name: string
  url: string
  expiresInMinutes: number
}

export function ResetPasswordEmail({
  name,
  url,
  expiresInMinutes,
}: ResetPasswordEmailProps) {
  return (
    <EmailLayout preview="Reset your Security Partners admin password">
      <Heading as="h1" style={emailStyles.heading}>
        Reset your password
      </Heading>
      <Text style={emailStyles.text}>Hi {name},</Text>
      <Text style={emailStyles.text}>
        Someone asked to reset the password for your Security Partners admin
        account. If it was you, choose a new password below. Your other sessions
        will be signed out.
      </Text>
      <Button href={url} style={emailStyles.button}>
        Choose a new password
      </Button>
      <Text style={emailStyles.small}>
        This link works once and expires in {expiresInMinutes} minutes. If you
        did not ask for this, ignore this email; your password stays the same.
        Link:{" "}
        <Link href={url} style={emailStyles.link}>
          {url}
        </Link>
      </Text>
    </EmailLayout>
  )
}

export default ResetPasswordEmail
