import type { ReactNode } from "react"
import { Body, Container, Head, Hr, Html, Preview, Text } from "react-email"

// Shared frame for transactional emails. Plain inline styles: email clients
// ignore the site's CSS.
export const emailStyles = {
  body: {
    backgroundColor: "#f4f4f5",
    fontFamily: "Arial, Helvetica, sans-serif",
    margin: 0,
    padding: "24px 0",
  },
  container: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    margin: "0 auto",
    maxWidth: 520,
    padding: 32,
  },
  heading: { color: "#18181b", fontSize: 22, margin: "0 0 16px" },
  text: {
    color: "#3f3f46",
    fontSize: 15,
    lineHeight: "24px",
    margin: "0 0 16px",
  },
  button: {
    backgroundColor: "#18181b",
    borderRadius: 6,
    color: "#ffffff",
    display: "inline-block",
    fontSize: 15,
    fontWeight: 700,
    padding: "12px 20px",
    textDecoration: "none",
  },
  small: {
    color: "#71717a",
    fontSize: 13,
    lineHeight: "20px",
    margin: "16px 0 0",
  },
  link: { color: "#18181b", wordBreak: "break-all" as const },
}

export function EmailLayout({
  preview,
  children,
}: {
  preview: string
  children: ReactNode
}) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={emailStyles.body}>
        <Container style={emailStyles.container}>
          {children}
          <Hr />
          <Text style={emailStyles.small}>
            Security Partners Ltd. · This is an automated message.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
