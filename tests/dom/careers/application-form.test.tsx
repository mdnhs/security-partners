import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ApplicationForm } from "@/components/careers/apply/application-form"
import { fixtureSiteSources } from "@/server/db/seed/fixtures/sources"

const copy = fixtureSiteSources().pages.careers.data.apply
const sidebar = {
  applyingFor: copy.sidebar.applyingFor,
  jobTitle: "Static Security Officer",
  meta: null,
  viewJob: "View job",
  nextHeading: copy.sidebar.nextHeading,
  nextSteps: [],
  dataHeading: copy.sidebar.dataHeading,
  dataCopy: copy.sidebar.dataCopy,
  helpHeading: copy.sidebar.helpHeading,
  phone: "085 000 0000",
  phoneHref: "tel:0850000000",
  email: "hr@example.ie",
}
const messages = {
  errorMessage: "Sorry, it could not be sent.",
  rateLimitedMessage: "Please wait a few minutes.",
}

type Reply = () => Promise<Response>
let reply: Reply
const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
  async (url) => {
    if (url.endsWith("/leads/config"))
      return new Response(JSON.stringify({ turnstileSiteKey: null }))
    return reply()
  }
)
const json =
  (body: unknown, status = 200) =>
  async () =>
    new Response(JSON.stringify(body), { status })

beforeEach(() => {
  reply = json({ ok: true, applicationId: "a1" }, 201)
  fetchMock.mockClear()
  vi.stubGlobal("fetch", fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

const posts = () =>
  fetchMock.mock.calls.filter(([url]) => url.includes("/careers/applications"))

function setup() {
  const user = userEvent.setup()
  render(
    <ApplicationForm
      copy={copy}
      jobSlug="static-officer"
      messages={messages}
      backHref="/careers"
      sidebar={sidebar}
    />
  )
  return user
}

const f = copy.fields
const o = copy.options
const field = (label: string) => screen.getByLabelText(label)
const pdf = (size = 100) =>
  new File([new Uint8Array(size)], "cv.pdf", { type: "application/pdf" })

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(field(f.firstName.label), "Aoife")
  await user.type(field(f.surname.label), "Byrne")
  await user.type(field(f.email.label), "aoife@example.ie")
  await user.type(field(f.phone.label), "085 123 4567")
  await user.type(field(f.town.label), "Portlaoise")
  await user.click(screen.getByRole("radio", { name: o.rightToWork[0] }))
  await user.click(
    within(screen.getByRole("radiogroup", { name: f.psaHeld.label })).getByRole(
      "radio",
      { name: o.psaHeld[2] }
    )
  )
  await user.type(field(f.employer.label), "Advance Security")
  // jsdom cannot type into a month input; the value is set as a picker would.
  fireEvent.change(field(f.from.label), { target: { value: "2021-03" } })
  const garda = screen.getByRole("radiogroup", { name: f.gardaVetting.label })
  await user.click(within(garda).getByRole("radio", { name: o.yes }))
  const abroad = screen.getByRole("radiogroup", { name: f.livedAbroad.label })
  await user.click(within(abroad).getByRole("radio", { name: o.no }))
  await user.selectOptions(field(f.experience.label), o.experience[1])
  await user.type(field(f.startDate.label), "2026-12-01")
  await user.click(screen.getByRole("checkbox", { name: o.shifts[0] }))
  const transport = screen.getByRole("radiogroup", { name: f.transport.label })
  await user.click(within(transport).getByRole("radio", { name: o.yes }))
  await user.upload(field(f.cv.label), pdf())
  await user.click(screen.getByRole("checkbox", { name: copy.consents[0] }))
  await user.click(screen.getByRole("checkbox", { name: copy.consents[1] }))
}

const submitButton = () =>
  screen.getByRole("button", { name: copy.submitLabel })

describe("ApplicationForm", () => {
  it("submitting empty marks the required fields and focuses the first", async () => {
    const user = setup()
    await user.click(submitButton())
    const first = field(f.firstName.label)
    expect(first).toHaveAttribute("aria-invalid", "true")
    expect(field(f.email.label)).toHaveAttribute("aria-invalid", "true")
    expect(first).toHaveFocus()
    expect(screen.getAllByText(copy.hints.required).length).toBeGreaterThan(3)
    expect(posts()).toHaveLength(0)
  })

  it("adds and removes employment periods, at most 10", async () => {
    const user = setup()
    const add = () =>
      screen.queryByRole("button", { name: copy.hints.addPeriod })
    expect(screen.getAllByLabelText(f.employer.label)).toHaveLength(1)
    await user.click(add()!)
    expect(screen.getAllByLabelText(f.employer.label)).toHaveLength(2)
    expect(screen.getByText("Period 2")).toBeInTheDocument()
    await user.click(
      screen.getAllByRole("button", { name: copy.hints.removePeriod })[0]
    )
    expect(screen.getAllByLabelText(f.employer.label)).toHaveLength(1)
    for (let i = 0; i < 9; i++) await user.click(add()!)
    expect(screen.getAllByLabelText(f.employer.label)).toHaveLength(10)
    expect(add()).toBeNull()
  })

  it("PSA “No” hides the licence number, category and expiry", async () => {
    const user = setup()
    expect(field(f.psaNumber.label)).toBeInTheDocument()
    await user.click(
      within(
        screen.getByRole("radiogroup", { name: f.psaHeld.label })
      ).getByRole("radio", { name: o.psaHeld[2] })
    )
    expect(screen.queryByLabelText(f.psaNumber.label)).toBeNull()
    expect(screen.queryByLabelText(f.psaCategory.label)).toBeNull()
    expect(screen.queryByLabelText(f.psaExpiry.label)).toBeNull()
  })

  it("refuses a CV over 5 MB before anything is sent", async () => {
    const user = setup()
    await user.upload(field(f.cv.label), pdf(6 * 1024 * 1024))
    expect(screen.getByText(copy.hints.fileTooLarge)).toBeInTheDocument()
    expect(screen.queryByText("cv.pdf")).toBeNull()
  })

  it("a successful submit shows the success state; one post for a double click", async () => {
    let release!: () => void
    reply = () =>
      new Promise((resolve) => {
        release = () =>
          resolve(
            new Response(JSON.stringify({ ok: true, applicationId: "a1" }), {
              status: 201,
            })
          )
      })
    const user = setup()
    await fillValid(user)
    await user.dblClick(submitButton())
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: copy.sendingLabel })
      ).toBeDisabled()
    )
    expect(posts()).toHaveLength(1)
    const body = posts()[0][1]!.body as FormData
    expect(body.get("jobSlug")).toBe("static-officer")
    expect(body.get("cv")).toBeInstanceOf(File)
    expect(JSON.parse(String(body.get("answers")))).toMatchObject({
      firstName: "Aoife",
      psa: "no",
      gardaVetting: true,
      consents: [true, true, false],
    })
    release()
    expect(
      await screen.findByRole("heading", { name: copy.successTitle })
    ).toBeInTheDocument()
  })

  it("server field errors are shown on their fields", async () => {
    reply = json(
      {
        error: {
          code: "VALIDATION_FAILED",
          message: "Invalid input",
          fieldErrors: { cv: [copy.hints.fileWrongType] },
        },
      },
      422
    )
    const user = setup()
    await fillValid(user)
    await user.click(submitButton())
    expect(
      await screen.findByText(copy.hints.fileWrongType)
    ).toBeInTheDocument()
  })

  it("a closed role is recognised by its error code, whatever the message says", async () => {
    reply = json(
      { error: { code: "CONFLICT", message: "Role no longer available" } },
      409
    )
    const user = setup()
    await fillValid(user)
    await user.click(submitButton())
    expect(await screen.findByText(copy.closedNotice)).toBeInTheDocument()
  })
})
