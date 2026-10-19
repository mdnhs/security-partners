import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  ConsentBanner,
  type ConsentBannerCopy,
} from "@/components/consent/consent-banner"
import { ConsentProvider } from "@/components/consent/consent-provider"
import {
  CustomCodeSnippets,
  snippetsLoaderScript,
} from "@/components/consent/custom-code"
import { CONSENT_EVENT } from "@/lib/analytics/snippets"
import type { AnalyticsWindow } from "@/lib/analytics/events"
import type {
  CustomCodeSettings,
  Snippet,
} from "@/lib/schemas/settings/custom-code"

type ProbeWindow = AnalyticsWindow & Record<string, unknown>
const w = () => window as unknown as ProbeWindow

const snippet = (over: Partial<Snippet>): Snippet => ({
  id: crypto.randomUUID(),
  name: "S",
  placement: "body",
  src: "",
  html: "",
  category: "necessary",
  routes: [],
  enabled: true,
  ...over,
})
const cfg = (snippets: Snippet[]): CustomCodeSettings => ({
  disabled: false,
  allowedHosts: ["cdn.example.com"],
  snippets,
})
const run = (snippets: Snippet[], placement: "head" | "body" = "body") =>
  new Function(snippetsLoaderScript(snippets, placement))()
const consent = (choice: { analytics: boolean; marketing: boolean } | null) => {
  w().__spConsent = choice
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: choice }))
}

beforeEach(() => {
  delete w().__spConsent
  for (const k of ["__nec", "__ana", "__mkt", "__twice"]) delete w()[k]
  document.body.innerHTML = ""
  document.head.querySelectorAll("[data-t]").forEach((n) => n.remove())
})
afterEach(() => vi.restoreAllMocks())

describe("CustomCodeSnippets (server-rendered loader)", () => {
  it("renders nothing with the seeded value, when disabled, or off-route", () => {
    const { container, rerender } = render(
      <CustomCodeSnippets
        settings={{ disabled: false, allowedHosts: [], snippets: [] }}
        pathname="/"
        placement="head"
      />
    )
    expect(container.innerHTML).toBe("")
    const s = snippet({ html: "<i></i>", routes: ["/blog/*"] })
    rerender(
      <CustomCodeSnippets
        settings={{ ...cfg([s]), disabled: true }}
        pathname="/blog/x"
        placement="body"
      />
    )
    expect(container.innerHTML).toBe("")
    rerender(
      <CustomCodeSnippets settings={cfg([s])} pathname="/" placement="body" />
    )
    expect(container.innerHTML).toBe("")
    rerender(
      <CustomCodeSnippets
        settings={cfg([s])}
        pathname="/blog/x"
        placement="body"
      />
    )
    expect(container.querySelector("script#sp-custom-code-body")).not.toBeNull()
  })

  it("the payload cannot close its own <script> and carries no names", () => {
    const s = snippet({
      name: "Secret name",
      html: '</script><p id="custom-p">hi</p> ',
    })
    const script = snippetsLoaderScript([s], "body")
    expect(script).not.toContain("</script>")
    expect(script).not.toContain("<")
    expect(script).not.toContain("Secret name")
    new Function(script)()
    expect(document.getElementById("custom-p")?.textContent).toBe("hi")
  })
})

describe("snippet loader gating", () => {
  it("a necessary snippet runs at once; head placement goes to <head>", () => {
    run([snippet({ html: '<meta data-t name="x-head">' })], "head")
    expect(document.head.querySelector('meta[name="x-head"]')).not.toBeNull()
    run([snippet({ html: "<script>window.__nec=1</script>" })])
    expect(w().__nec).toBe(1)
  })

  it("analytics/marketing snippets wait for their own consent", () => {
    run([
      snippet({
        category: "analytics",
        html: "<script>window.__ana=(window.__ana||0)+1</script>",
      }),
      snippet({
        category: "marketing",
        html: "<script>window.__mkt=1</script>",
      }),
    ])
    expect(w().__ana).toBeUndefined()
    expect(w().__mkt).toBeUndefined()
    consent({ analytics: false, marketing: false })
    expect(w().__ana).toBeUndefined()
    consent({ analytics: true, marketing: false })
    expect(w().__ana).toBe(1)
    expect(w().__mkt).toBeUndefined()
    // A later change never runs a snippet twice.
    consent({ analytics: true, marketing: true })
    expect(w().__ana).toBe(1)
    expect(w().__mkt).toBe(1)
  })

  it("an existing choice (set before the loader) applies at once", () => {
    w().__spConsent = { analytics: true, marketing: false }
    run([
      snippet({
        category: "analytics",
        html: "<script>window.__ana=1</script>",
      }),
    ])
    expect(w().__ana).toBe(1)
  })

  it("a src snippet becomes <script src async>", () => {
    run(
      [
        snippet({
          category: "analytics",
          src: "https://cdn.example.com/a.js",
        }),
      ],
      "head"
    )
    expect(
      document.head.querySelector('script[src="https://cdn.example.com/a.js"]')
    ).toBeNull()
    consent({ analytics: true, marketing: false })
    const el = document.head.querySelector<HTMLScriptElement>(
      'script[src="https://cdn.example.com/a.js"]'
    )
    expect(el).not.toBeNull()
    expect(el!.async).toBe(true)
    el!.remove()
  })
})

const COPY: ConsentBannerCopy = {
  title: "We use cookies",
  body: "Body",
  acceptLabel: "Accept all",
  rejectLabel: "Reject non-essential",
  customiseLabel: "Customise",
  saveLabel: "Save choices",
  manageLabel: "Cookie settings",
  closeLabel: "Close",
  policyLink: { label: "Privacy Policy", href: "/privacy" },
  categories: {
    necessary: { label: "Necessary", description: "Always on." },
    analytics: { label: "Analytics", description: "Usage." },
    marketing: { label: "Marketing", description: "Ads." },
  },
  version: 1,
  reconsentMonths: 6,
}

describe("ConsentProvider → sp:consent", () => {
  it("announces the stored choice and every new choice", async () => {
    for (const part of document.cookie.split(";")) {
      const name = part.split("=")[0]?.trim()
      if (name) document.cookie = `${name}=; Max-Age=0; Path=/`
    }
    const seen: unknown[] = []
    const listener = (e: Event) => seen.push((e as CustomEvent).detail)
    window.addEventListener(CONSENT_EVENT, listener)
    try {
      render(
        <ConsentProvider version={1} maxAgeSeconds={60}>
          <ConsentBanner copy={COPY} />
        </ConsentProvider>
      )
      expect(seen).toEqual([null])
      await userEvent
        .setup()
        .click(screen.getByRole("button", { name: "Accept all" }))
      expect(seen).toEqual([null, { analytics: true, marketing: true }])
    } finally {
      window.removeEventListener(CONSENT_EVENT, listener)
    }
  })
})
