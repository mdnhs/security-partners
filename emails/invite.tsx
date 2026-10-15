import { Button, Heading, Link, Text } from "react-email"

import { EmailLayout, emailStyles, formatExpiry } from "./layout"

export type InviteEmailProps = {
  name: string
  inviterName: string
  url: string
  expiresInDays: number
}

export function InviteEmail({
  name,
  inviterName,
  url,
  expiresInDays,
}: InviteEmailProps) {
  const expiry = formatExpiry(expiresInDays * 1440)
  return (
    <EmailLayout preview="You're invited to the Security Partners admin">
      <Heading as="h1" style={emailStyles.heading}>
        You&apos;re invited
      </Heading>
      <Text style={emailStyles.text}>Hi {name},</Text>
      <Text style={emailStyles.text}>
        {inviterName} invited you to the Security Partners website admin. Choose
        a password to activate your account.
      </Text>
      <Button href={url} style={emailStyles.button}>
        Choose your password
      </Button>
      <Text style={emailStyles.small}>
        This link works once and expires in {expiry}. If the button does not
        work, open this address:{" "}
        <Link href={url} style={emailStyles.link}>
          {url}
        </Link>
      </Text>
    </EmailLayout>
  )
}

export default InviteEmail
