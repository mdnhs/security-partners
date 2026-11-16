import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { linkify } from "@/components/chat/linkify"

const QUOTE = "/contact#quote"

function links(text: string, quoteHref = QUOTE) {
  const { container } = render(<p>{linkify(text, { quoteHref })}</p>)
  return {
    text: container.textContent,
    anchors: [...container.querySelectorAll("a")].map((a) => ({
      label: a.textContent,
      href: a.getAttribute("href"),
      target: a.getAttribute("target"),
      rel: a.getAttribute("rel"),
    })),
  }
}

describe("linkify", () => {
  it("links an email to mailto and keeps the text", () => {
    const r = links("Email info@cleaningpartners.ie.")
    expect(r.text).toBe("Email info@cleaningpartners.ie.")
    expect(r.anchors).toEqual([
      {
        label: "info@cleaningpartners.ie",
        href: "mailto:info@cleaningpartners.ie",
        target: null,
        rel: null,
      },
    ])
  })

  it("links Irish numbers through telHref", () => {
    expect(links("Call 057 8697670").anchors[0]).toMatchObject({
      label: "057 8697670",
      href: "tel:+353578697670",
    })
    expect(links("Mobile (085) 8062369 any time").anchors[0]).toMatchObject({
      label: "(085) 8062369",
      href: "tel:+353858062369",
    })
    expect(links("Call +353 1 234 5678.").anchors[0]?.href).toBe(
      "tel:+35312345678"
    )
  })

  it("opens a number labelled WhatsApp in a new tab", () => {
    expect(links("WhatsApp: 085 806 2369").anchors).toEqual([
      {
        label: "085 806 2369",
        href: "https://wa.me/353858062369",
        target: "_blank",
        rel: "noopener noreferrer",
      },
    ])
  })

  it("leaves short numbers, years and arbitrary URLs as text", () => {
    expect(links("Bay 12345").anchors).toEqual([])
    expect(links("Open 2019 - 2021").anchors).toEqual([])
    const r = links("See https://evil.example now")
    expect(r.anchors).toEqual([])
    expect(r.text).toBe("See https://evil.example now")
  })

  it("links the configured quote href in the same tab, and nothing else", () => {
    const r = links("Use our form at /contact#quote.")
    expect(r.text).toBe("Use our form at /contact#quote.")
    expect(r.anchors).toEqual([
      { label: QUOTE, href: QUOTE, target: null, rel: null },
    ])
    expect(links("Try /contact#other").anchors).toEqual([])
    expect(links("Try /contact#quotes").anchors).toEqual([])
    expect(links("https://x.example/contact#quote").anchors).toEqual([])
  })

  it("never joins a number across a newline", () => {
    const r = links("Phone: 0852785974\n0861234567")
    expect(r.anchors.map((a) => a.href)).toEqual([
      "tel:+353852785974",
      "tel:+353861234567",
    ])
    expect(links("Call 085 806\n2369").anchors).toEqual([])
  })

  it("styles every link with the chat link class", () => {
    const { container } = render(
      <p>{linkify("info@cleaningpartners.ie", { quoteHref: QUOTE })}</p>
    )
    expect(container.querySelector("a")?.className).toBe(
      "underline underline-offset-2 decoration-current/50 hover:decoration-current"
    )
  })
})
