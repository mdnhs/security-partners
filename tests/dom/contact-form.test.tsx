import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  ContactForm,
  type ContactFormLabels,
} from "@/components/home/contact-form"
import {
  type TurnstileApi,
  useTurnstile,
} from "@/components/home/use-turnstile"

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
let configReply: (() => Promise<Response>) | null
// `init` is read back from mock.calls (method, body).
const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
  async (url) => {
    if (url === "/api/v1/public/leads/config") {
      if (configReply) return configReply()
      return new Response(JSON.stringify({ turnstileSiteKey: siteKey }))
    }
    return leadReply()
  }
)

const json =
  (body: unknown, status = 200) =>
  async () =>
    new Response(JSON.stringify(body), { status })

beforeEach(() => {
  siteKey = null
  configReply = null
  leadReply = json({ ok: true })
  fetchMock.mockClear()
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.useRealTimers()
  delete window.turnstile
})

/** A fake Turnstile whose execute() answers with `tok-<n>` unless told not to. */
function fakeTurnstile({ answer = true } = {}) {
  let options: Parameters<TurnstileApi["render"]>[1] | undefined
  let n = 0
  const api = {
    render: vi.fn<TurnstileApi["render"]>((_el, o) => {
      options = o
      return "widget-1"
    }),
    execute: vi.fn<TurnstileApi["execute"]>(() => {
      if (answer) options?.callback(`tok-${++n}`)
    }),
    reset: vi.fn<TurnstileApi["reset"]>(),
    remove: vi.fn<TurnstileApi["remove"]>(),
  }
  window.turnstile = api
  return api
}

async function fillAndSend() {
  const user = userEvent.setup()
  // clear() first: user-event tracks its own copy of the value, which
  // form.reset() after a previous send does not update.
  for (const [label, value] of [
    ["Your Name", "Dinn Rí"],
    ["Email", "dinn@example.ie"],
    ["Phone", "085 123 4567"],
    ["Message", "Need a quote"],
  ]) {
    await user.clear(screen.getByLabelText(label))
    await user.type(screen.getByLabelText(label), value)
  }
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

  it("ignores a second submit fired before React re-renders", async () => {
    let release!: (r: Response) => void
    leadReply = () => new Promise<Response>((resolve) => (release = resolve))
    const { container } = render(<ContactForm labels={labels} />)
    const user = userEvent.setup()
    await user.type(screen.getByLabelText("Your Name"), "Dinn Rí")
    await user.type(screen.getByLabelText("Email"), "dinn@example.ie")
    await user.type(screen.getByLabelText("Message"), "Need a quote")
    const form = container.querySelector("form")!
    await act(async () => {
      form.requestSubmit()
      form.requestSubmit()
    })
    await waitFor(() => expect(leadPosts()).toHaveLength(1))
    release(new Response(JSON.stringify({ ok: true })))
    await screen.findByText(labels.successMessage)
    expect(leadPosts()).toHaveLength(1)
  })

  it.each([
    [
      "rejects",
      async () => {
        throw new TypeError("Failed to fetch")
      },
    ],
    ["is not OK", json({}, 500)],
  ] as [string, () => Promise<Response>][])(
    "retries Turnstile on the next submit when the config fetch %s once",
    async (_, failure) => {
      siteKey = "0x4AAAAAAAtestsitekey"
      configReply = failure
      const api = fakeTurnstile()
      render(<ContactForm labels={labels} />)
      await fillAndSend()
      await screen.findByText(labels.successMessage)
      expect(
        JSON.parse(String(leadPosts()[0][1]?.body)).turnstileToken
      ).toBeUndefined()
      configReply = null
      await fillAndSend()
      await waitFor(() => expect(leadPosts()).toHaveLength(2))
      expect(api.render).toHaveBeenCalledTimes(1)
      expect(JSON.parse(String(leadPosts()[1][1]?.body)).turnstileToken).toBe(
        "tok-1"
      )
    }
  )

  it("caches a missing site key: the config is fetched only once", async () => {
    render(<ContactForm labels={labels} />)
    await fillAndSend()
    await screen.findByText(labels.successMessage)
    await fillAndSend()
    await waitFor(() => expect(leadPosts()).toHaveLength(2))
    const configCalls = fetchMock.mock.calls.filter(
      ([url]) => url === "/api/v1/public/leads/config"
    )
    expect(configCalls).toHaveLength(1)
  })

  it("leaves no widget behind when unmounted while preparing", async () => {
    siteKey = "0x4AAAAAAAtestsitekey"
    let releaseConfig: (() => void) | undefined
    configReply = () =>
      new Promise<Response>((resolve) => {
        releaseConfig = () =>
          resolve(new Response(JSON.stringify({ turnstileSiteKey: siteKey })))
      })
    const api = fakeTurnstile()
    // A plain ref that outlives the unmount (React would null a DOM ref).
    const slot = { current: document.createElement("div") }
    const { result, unmount } = renderHook(() => useTurnstile(slot))
    const prepared = result.current.prepare()
    await waitFor(() => expect(releaseConfig).toBeDefined())
    unmount()
    releaseConfig!()
    await expect(prepared).resolves.toBeNull()
    // Every widget that was rendered has been removed again.
    expect(api.remove).toHaveBeenCalledTimes(api.render.mock.calls.length)
  })

  it("sends without a token when Turnstile never answers within 8 s", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    siteKey = "0x4AAAAAAAtestsitekey"
    const api = fakeTurnstile({ answer: false })
    render(<ContactForm labels={labels} />)
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.type(screen.getByLabelText("Your Name"), "Dinn Rí")
    await user.type(screen.getByLabelText("Email"), "dinn@example.ie")
    await user.type(screen.getByLabelText("Message"), "Need a quote")
    await user.click(screen.getByRole("button", { name: "Send Message" }))
    await waitFor(() => expect(api.execute).toHaveBeenCalledWith("widget-1"))
    await act(async () => vi.advanceTimersByTime(7_900))
    expect(leadPosts()).toHaveLength(0)
    await act(async () => vi.advanceTimersByTime(200))
    await waitFor(() => expect(leadPosts()).toHaveLength(1))
    expect(
      JSON.parse(String(leadPosts()[0][1]?.body)).turnstileToken
    ).toBeUndefined()
  })
})
