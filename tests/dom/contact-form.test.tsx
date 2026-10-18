import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  ContactForm,
  type ContactFormLabels,
} from "@/components/home/contact-form"
import type { TurnstileApi } from "@/components/home/use-turnstile"

const labels: ContactFormLabels = {
  nameLabel: "Your Name",
  namePlaceholder: "John Smith",
  emailLabel: "Email",
  emailPlaceholder: "you@company.ie",
  phoneLabel: "Phone",
  phonePlaceholder: "085 000 0000",
  messageLabel: "Message",
  messagePlaceholder: "Tell us…",
  submitLabel: "Send Message",
  sendingLabel: "Sending…",
  successMessage: "Thank you, your message has been sent.",
  errorMessage: "Sorry, your message could not be sent.",
  rateLimitedMessage: "Please wait a few minutes and try again.",
}

type Reply = () => Promise<Response>
let leadReply: Reply
let siteKey: string | null
// `init` is read back from mock.calls (method, body).
const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
  async (url) => {
    if (url === "/api/v1/public/leads/config")
      return new Response(JSON.stringify({ turnstileSiteKey: siteKey }))
    return leadReply()
  }
)

const json =
  (body: unknown, status = 200) =>
  async () =>
    new Response(JSON.stringify(body), { status })

beforeEach(() => {
  siteKey = null
  leadReply = json({ ok: true })
  fetchMock.mockClear()
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  delete window.turnstile
})

async function fillAndSend() {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText("Your Name"), "Dinn Rí")
  await user.type(screen.getByLabelText("Email"), "dinn@example.ie")
  await user.type(screen.getByLabelText("Phone"), "085 123 4567")
  await user.type(screen.getByLabelText("Message"), "Need a quote")
  await user.click(screen.getByRole("button", { name: "Send Message" }))
  return user
}

const leadPosts = () =>
  fetchMock.mock.calls.filter(([url]) => url === "/api/v1/public/leads")

describe("ContactForm (master 7.3)", () => {
  it("adds only out-of-flow elements: hidden honeypot, Turnstile slot, empty sr-only status", () => {
    const { container } = render(<ContactForm labels={labels} />)
    const honeypot = container.querySelector<HTMLInputElement>(
      'input[name="website"]'
    )!
    expect(honeypot.tabIndex).toBe(-1)
    expect(honeypot.autocomplete).toBe("off")
    const trap = honeypot.closest("div")!
    expect(trap).toHaveAttribute("aria-hidden", "true")
    expect(trap.className).toContain("absolute")
    const status = screen.getByRole("status")
    expect(status).toHaveTextContent("")
    expect(status.className).toBe("sr-only")
    // Hidden from assistive tech: not in the accessibility tree.
    expect(screen.queryByRole("textbox", { name: "Website" })).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("posts JSON to the leads API and shows the success copy, then clears the form", async () => {
    render(<ContactForm labels={labels} />)
    await fillAndSend()
    expect(await screen.findByText(labels.successMessage)).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent(labels.successMessage)
    const [, init] = leadPosts()[0]
    expect(init?.method).toBe("POST")
    expect(JSON.parse(String(init?.body))).toEqual({
      name: "Dinn Rí",
      email: "dinn@example.ie",
      phone: "085 123 4567",
      message: "Need a quote",
      consent: true,
      sourcePage: "/",
      website: "",
    })
    expect(screen.getByLabelText("Your Name")).toHaveValue("")
    expect(screen.getByRole("button", { name: "Send Message" })).toBeEnabled()
  })

  it("shows the sending label and blocks double submits while waiting", async () => {
    let release!: (r: Response) => void
    leadReply = () => new Promise<Response>((resolve) => (release = resolve))
    render(<ContactForm labels={labels} />)
    const user = await fillAndSend()
    const button = await screen.findByRole("button", { name: "Sending…" })
    expect(button).toBeDisabled()
    await user.click(button)
    release(new Response(JSON.stringify({ ok: true })))
    await screen.findByText(labels.successMessage)
    expect(leadPosts()).toHaveLength(1)
  })

  it.each([
    [
      "429",
      json({ error: { code: "RATE_LIMITED" } }, 429),
      labels.rateLimitedMessage,
    ],
    [
      "422",
      json({ error: { code: "VALIDATION_FAILED" } }, 422),
      labels.errorMessage,
    ],
    ["500", json({}, 500), labels.errorMessage],
    [
      "network error",
      async () => {
        throw new TypeError("Failed to fetch")
      },
      labels.errorMessage,
    ],
  ] as [string, Reply, string][])(
    "%s → the matching error copy, fields kept",
    async (_, reply, text) => {
      leadReply = reply
      render(<ContactForm labels={labels} />)
      await fillAndSend()
      expect(await screen.findByText(text)).toBeInTheDocument()
      expect(screen.getByLabelText("Your Name")).toHaveValue("Dinn Rí")
    }
  )

  it("with Turnstile enabled, renders the invisible widget on focus and sends its token", async () => {
    siteKey = "0x4AAAAAAAtestsitekey"
    let options: Parameters<TurnstileApi["render"]>[1] | undefined
    const api: TurnstileApi = {
      render: vi.fn((_el, o) => {
        options = o
        return "widget-1"
      }),
      execute: vi.fn(() => options?.callback("tok-123")),
      reset: vi.fn(),
      remove: vi.fn(),
    }
    window.turnstile = api
    render(<ContactForm labels={labels} />)
    await fillAndSend()
    await screen.findByText(labels.successMessage)
    expect(api.render).toHaveBeenCalledTimes(1)
    expect(options).toMatchObject({
      sitekey: "0x4AAAAAAAtestsitekey",
      execution: "execute",
    })
    expect(JSON.parse(String(leadPosts()[0][1]?.body)).turnstileToken).toBe(
      "tok-123"
    )
    await waitFor(() => expect(api.reset).toHaveBeenCalledWith("widget-1"))
  })
})
