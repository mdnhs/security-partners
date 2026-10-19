import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const analytics = vi.hoisted(() => ({ track: vi.fn(() => true) }))
vi.mock("@/lib/analytics/events", () => analytics)

import { NewsletterForm } from "@/components/newsletter/newsletter-form"
import { NewsletterStateBody } from "@/components/newsletter/newsletter-state"
import type { NewsletterPublicCopy } from "@/lib/schemas/settings/newsletter"

const copy: NewsletterPublicCopy = {
  eyebrow: "Newsletter",
  title: "Security insights in your inbox",
  subtitle: "One short email a month.",
  emailLabel: "Email address",
  placeholder: "you@company.ie",
  button: "Subscribe",
  success: "Check your inbox to confirm your subscription.",
  errors: {
    email: "Enter a valid email address.",
    rateLimited: "Too many attempts.",
    generic: "Something went wrong.",
  },
}

let reply: () => Promise<Response>
const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
  async (url) => {
    if (url === "/api/v1/public/leads/config")
      return new Response(JSON.stringify({ turnstileSiteKey: null }))
    return reply()
  }
)
const status =
  (code: number, body: unknown = {}) =>
  async () =>
    new Response(JSON.stringify(body), { status: code })

const posts = () =>
  fetchMock.mock.calls.filter(([url]) => url === "/api/v1/public/newsletter")

beforeEach(() => {
  reply = status(201, { ok: true })
  fetchMock.mockClear()
  analytics.track.mockClear()
  vi.stubGlobal("fetch", fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

async function subscribe(email = "ann@example.ie") {
  const user = userEvent.setup()
  await user.type(screen.getByRole("textbox", { name: "Email address" }), email)
  await user.click(screen.getByRole("button", { name: "Subscribe" }))
  return user
}

describe("NewsletterForm", () => {
  it("a labelled section with an accessibly named email input and a hidden honeypot", () => {
    const { container } = render(<NewsletterForm id="newsletter" copy={copy} />)
    const section = screen.getByRole("region", { name: copy.title })
    expect(section).toHaveAttribute("id", "newsletter")
    const input = screen.getByRole("textbox", { name: "Email address" })
    expect(input).toHaveAttribute("type", "email")
    expect(input).toHaveAttribute("autocomplete", "email")
    expect(input).toBeRequired()
    const honeypot = container.querySelector<HTMLInputElement>(
      'input[name="website"]'
    )!
    expect(honeypot.tabIndex).toBe(-1)
    expect(honeypot.closest("div")).toHaveAttribute("aria-hidden", "true")
    expect(screen.queryByRole("textbox", { name: "Website" })).toBeNull()
  })

  it("201: posts the address, swaps the form for role=status and tracks the sign-up", async () => {
    render(<NewsletterForm id="newsletter" copy={copy} />)
    await subscribe()
    expect(await screen.findByRole("status")).toHaveTextContent(copy.success)
    expect(screen.queryByRole("textbox", { name: "Email address" })).toBeNull()
    expect(posts()).toHaveLength(1)
    const [, init] = posts()[0]
    expect(init?.method).toBe("POST")
    expect(JSON.parse(String(init?.body))).toEqual({
      email: "ann@example.ie",
      website: "",
      sourcePath: "/",
    })
    expect(analytics.track).toHaveBeenCalledWith({
      event: "newsletter_sign_up",
      method: "newsletter",
    })
  })

  it("429: the rate-limited copy in role=alert; the form stays", async () => {
    reply = status(429)
    render(<NewsletterForm id="newsletter" copy={copy} />)
    await subscribe()
    expect(await screen.findByRole("alert")).toHaveTextContent(
      copy.errors.rateLimited
    )
    expect(screen.getByRole("textbox", { name: "Email address" })).toBeVisible()
    expect(analytics.track).not.toHaveBeenCalled()
  })

  it("400/422: the email copy; other failures: the generic copy", async () => {
    reply = status(422)
    render(<NewsletterForm id="newsletter" copy={copy} />)
    const user = await subscribe()
    expect(await screen.findByRole("alert")).toHaveTextContent(
      copy.errors.email
    )
    reply = status(500)
    await user.click(screen.getByRole("button", { name: "Subscribe" }))
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(copy.errors.generic)
    )
    reply = status(400)
    await user.click(screen.getByRole("button", { name: "Subscribe" }))
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(copy.errors.email)
    )
  })

  it("pending: the button is disabled and aria-busy until the reply", async () => {
    let release: (r: Response) => void = () => undefined
    reply = () => new Promise<Response>((resolve) => (release = resolve))
    render(<NewsletterForm id="newsletter" copy={copy} />)
    await subscribe()
    const button = screen.getByRole("button", { name: "Subscribe" })
    await waitFor(() => expect(button).toBeDisabled())
    expect(button).toHaveAttribute("aria-busy", "true")
    release(new Response("{}", { status: 201 }))
    expect(await screen.findByRole("status")).toHaveTextContent(copy.success)
  })
})

describe("NewsletterStateBody", () => {
  it("unsubscribe: a POST form to the API with the token hidden and the button", () => {
    const { container } = render(
      <NewsletterStateBody
        state="unsubscribe"
        body="Press the button below."
        button="Unsubscribe"
        token="abc.def"
      />
    )
    const form = container.querySelector("form")!
    expect(form).toHaveAttribute("method", "post")
    expect(form).toHaveAttribute(
      "action",
      "/api/v1/public/newsletter/unsubscribe"
    )
    const hidden = container.querySelector<HTMLInputElement>(
      'input[type="hidden"][name="token"]'
    )!
    expect(hidden.value).toBe("abc.def")
    expect(
      screen.getByRole("button", { name: "Unsubscribe" })
    ).toHaveAttribute("type", "submit")
    expect(screen.getByText("Press the button below.")).toBeInTheDocument()
  })

  it("other states: the body text only, no form", () => {
    const { container } = render(
      <NewsletterStateBody state="confirmed" body="Thanks for confirming." />
    )
    expect(screen.getByText("Thanks for confirming.")).toBeInTheDocument()
    expect(container.querySelector("form")).toBeNull()
  })
})
