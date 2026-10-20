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
import { RouteChangeEvent } from "@/components/consent/route-change-event"
import { CONSENT_EVENT, NAVIGATE_EVENT } from "@/lib/analytics/snippets"
import type { AnalyticsWindow } from "@/lib/analytics/events"
import type {
  CustomCodeSettings,
  Snippet,
} from "@/lib/schemas/settings/custom-code"

const nav = vi.hoisted(() => ({ pathname: "/" }))
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }))

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

/** A client-side navigation: the path changes, then RouteChangeEvent fires. */
const navigate = (path: string) => {
  window.history.pushState({}, "", path)
  window.dispatchEvent(new CustomEvent(NAVIGATE_EVENT, { detail: path }))
}

beforeEach(() => {
  window.history.replaceState({}, "", "/")
  delete w().__spConsent
  document.body.innerHTML = ""
  document.head.querySelectorAll("[data-t]").forEach((n) => n.remove())
})
afterEach(() => vi.restoreAllMocks())

describe("CustomCodeSnippets (server-rendered loader)", () => {
  it("renders nothing with the seeded value, when disabled, or with no enabled snippet of the placement", () => {
    const { container, rerender } = render(
      <CustomCodeSnippets
        settings={{ disabled: false, allowedHosts: [], snippets: [] }}
        placement="head"
      />
    )
    expect(container.innerHTML).toBe("")
    const s = snippet({ html: "<i></i>", routes: ["/blog/*"] })
    rerender(
      <CustomCodeSnippets
        settings={{ ...cfg([s]), disabled: true }}
        placement="body"
      />
    )
    expect(container.innerHTML).toBe("")
    rerender(<CustomCodeSnippets settings={cfg([s])} placement="head" />)
    expect(container.innerHTML).toBe("")
    rerender(
      <CustomCodeSnippets
        settings={cfg([{ ...s, enabled: false }])}
        placement="body"
      />
    )
    expect(container.innerHTML).toBe("")
    // Whatever the page: routes are matched in the browser (client nav).
    rerender(<CustomCodeSnippets settings={cfg([s])} placement="body" />)
    expect(container.querySelector("script#sp-custom-code-body")).not.toBeNull()
  })

  it("the payload cannot close its own <script> and carries no names", () => {
    const s = snippet({
      name: "Secret name",
      html: '</script><p id="custom-p">hi</p>\u2028',
    })
    const script = snippetsLoaderScript([s], "body")
    expect(script).not.toContain("</script>")
    expect(script).not.toContain("<")
    expect(script).not.toContain("Secret name")
    new Function(script)()
    expect(document.getElementById("custom-p")?.textContent).toBe("hi")
  })
})

// jsdom does not execute scripts, so each snippet inserts a marker element
// (in a browser, a <script> in the fragment runs on insertion; e2e covers it).
const count = (id: string) => document.querySelectorAll(`#${id}`).length

describe("snippet loader gating", () => {
  it("a necessary snippet runs at once; head placement goes to <head>", () => {
    run([snippet({ html: '<meta data-t name="x-head">' })], "head")
    expect(document.head.querySelector('meta[name="x-head"]')).not.toBeNull()
    run([snippet({ html: '<i id="nec"></i>' })])
    expect(count("nec")).toBe(1)
  })

  it("analytics/marketing snippets wait for their own consent", () => {
    run([
      snippet({ category: "analytics", html: '<i id="ana"></i>' }),
      snippet({ category: "marketing", html: '<i id="mkt"></i>' }),
    ])
    expect(count("ana")).toBe(0)
    expect(count("mkt")).toBe(0)
    consent(null)
    consent({ analytics: false, marketing: false })
    expect(count("ana")).toBe(0)
    consent({ analytics: true, marketing: false })
    expect(count("ana")).toBe(1)
    expect(count("mkt")).toBe(0)
    // A later change never runs a snippet twice.
    consent({ analytics: true, marketing: true })
    expect(count("ana")).toBe(1)
    expect(count("mkt")).toBe(1)
  })

  it("an existing choice (set before the loader) applies at once", () => {
    w().__spConsent = { analytics: true, marketing: false }
    run([snippet({ category: "analytics", html: '<i id="ana"></i>' })])
    expect(count("ana")).toBe(1)
  })

  it("only the provider's window.__spConsent counts: tracking off (no provider) never runs a gated snippet", () => {
    run([snippet({ category: "analytics", html: '<i id="off1"></i>' })])
    // Any other script dispatching the event, without the provider's
    // choice on window, changes nothing.
    window.dispatchEvent(
      new CustomEvent(CONSENT_EVENT, {
        detail: { analytics: true, marketing: true },
      })
    )
    navigate("/about")
    expect(count("off1")).toBe(0)
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

describe("route scope follows client-side navigation (review D2.3 I1)", () => {
  it("/blog → / then Accept: the /blog/* snippet does NOT run", () => {
    window.history.replaceState({}, "", "/blog")
    run([
      snippet({
        category: "analytics",
        routes: ["/blog/*"],
        html: '<i id="nav-a"></i>',
      }),
    ])
    expect(count("nav-a")).toBe(0)
    navigate("/")
    consent({ analytics: true, marketing: true })
    expect(count("nav-a")).toBe(0)
    // Back on the blog, with consent: now it runs.
    navigate("/blog/post")
    expect(count("nav-a")).toBe(1)
  })

  it("/ → /blog: the /blog/* snippet runs on arrival, once", () => {
    run([
      snippet({ routes: ["/blog/*"], html: '<i id="nav-b"></i>' }),
      snippet({ routes: ["/"], html: '<i id="nav-home"></i>' }),
    ])
    expect(count("nav-b")).toBe(0)
    expect(count("nav-home")).toBe(1)
    navigate("/blog")
    expect(count("nav-b")).toBe(1)
    navigate("/")
    navigate("/blog/x")
    expect(count("nav-b")).toBe(1)
    expect(count("nav-home")).toBe(1)
  })

  it("a gated snippet that becomes allowed runs only if the current path matches", () => {
    window.history.replaceState({}, "", "/contact")
    run([
      snippet({
        category: "marketing",
        routes: ["/contact"],
        html: '<i id="nav-c"></i>',
      }),
    ])
    navigate("/about")
    consent({ analytics: false, marketing: true })
    expect(count("nav-c")).toBe(0)
    navigate("/contact/")
    expect(count("nav-c")).toBe(1)
  })
})

describe("RouteChangeEvent", () => {
  it("dispatches sp:navigate on a pathname change, never on the first render", () => {
    const seen: unknown[] = []
    const listener = (e: Event) => seen.push((e as CustomEvent).detail)
    window.addEventListener(NAVIGATE_EVENT, listener)
    try {
      nav.pathname = "/"
      const { rerender } = render(<RouteChangeEvent />)
      rerender(<RouteChangeEvent />)
      expect(seen).toEqual([])
      nav.pathname = "/blog"
      rerender(<RouteChangeEvent />)
      expect(seen).toEqual(["/blog"])
    } finally {
      window.removeEventListener(NAVIGATE_EVENT, listener)
    }
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
