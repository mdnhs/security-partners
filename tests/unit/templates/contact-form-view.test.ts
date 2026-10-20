import { describe, expect, it } from "vitest"

import { contactSectionView } from "@/templates/shared/views"
import { fixtureSiteSources } from "@/server/db/seed/fixtures/sources"

describe("contactSectionView form props (master 7.3)", () => {
  it("passes every label and the feedback copy; no mailto hand-off any more", () => {
    const { form } = contactSectionView(fixtureSiteSources())
    expect(Object.keys(form)).toEqual(["labels"])
    expect(form.labels).toEqual({
      nameLabel: "Your Name",
      namePlaceholder: "John Smith",
      emailLabel: "Email",
      emailPlaceholder: "you@company.ie",
      phoneLabel: "Phone",
      phonePlaceholder: "085 000 0000",
      messageLabel: "Message",
      messagePlaceholder: "Tell us about your security requirements...",
      submitLabel: "Send Message",
      sendingLabel: "Sending…",
      successMessage:
        "Thank you, your message has been sent. We will be in touch shortly.",
      errorMessage:
        "Sorry, your message could not be sent. Please try again or call us.",
      rateLimitedMessage:
        "You have sent several messages in a short time. Please wait a few minutes and try again.",
    })
  })
})
