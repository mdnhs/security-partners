import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock("sonner", () => ({ toast }))

import {
  BOARD_COLUMNS,
  LeadsBoard,
} from "@/components/admin/leads/leads-board"
import type { LeadListItem, LeadStatus } from "@/lib/schemas/api/leads"

const lead = (
  id: string,
  name: string,
  status: LeadStatus,
  extra: Partial<LeadListItem> = {}
): LeadListItem => ({
  id,
  name,
  email: `${id}@example.ie`,
  phone: null,
  company: null,
  service: null,
  status,
  assignee: null,
  sourcePage: null,
  createdAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
  ...extra,
})

const LEADS: LeadListItem[] = [
  lead("a", "Dinn Rí", "new", {
    company: "Rí Security",
    service: "CCTV",
    assignee: { id: "u", name: "Ian Intake" },
  }),
  lead("b", "Brid Ní", "qualified"),
  lead("c", "Cara Óg", "won"),
]

const column = (label: string) => screen.getByRole("region", { name: label })
const card = (name: string) =>
  screen.getByRole("button", { name: new RegExp(`^${name}`) })
/** dnd-kit attaches its keydown listener on the next tick after pick-up. */
const tick = () => act(() => new Promise((r) => setTimeout(r, 0)))

function setup(
  props: Partial<Parameters<typeof LeadsBoard>[0]> = {}
): {
  onOpen: ReturnType<typeof vi.fn>
  onMove: ReturnType<typeof vi.fn>
  user: ReturnType<typeof userEvent.setup>
} {
  const onOpen = vi.fn()
  const onMove = vi.fn(async () => {})
  const user = userEvent.setup()
  render(
    <LeadsBoard
      leads={LEADS}
      canUpdate
      onOpen={onOpen}
      onMove={onMove}
      {...props}
    />
  )
  return {
    onOpen: (props.onOpen as never) ?? onOpen,
    onMove: (props.onMove as never) ?? onMove,
    user,
  }
}

beforeEach(() => {
  toast.error.mockClear()
  toast.success.mockClear()
})

describe("LeadsBoard (D3.3)", () => {
  it("has a column per open, won and lost status with counts and card facts", () => {
    setup()
    expect(BOARD_COLUMNS).toEqual([
      "new",
      "contacted",
      "qualified",
      "won",
      "lost",
    ])
    for (const [label, count] of [
      ["New", 1],
      ["Contacted", 0],
      ["Qualified", 1],
      ["Won", 1],
      ["Lost", 0],
    ] as const) {
      const region = column(label)
      expect(
        within(region).getByRole("heading", { name: `${label} ${count}` })
      ).toBeInTheDocument()
    }
    const first = within(column("New")).getByRole("button", {
      name: /^Dinn Rí/,
    })
    expect(first).toHaveTextContent("Rí Security")
    expect(first).toHaveTextContent("CCTV")
    expect(first).toHaveTextContent("2 hours ago")
    expect(within(first).getByText("II")).toBeInTheDocument()
  })

  it("a card opens the drawer by click and by Enter", async () => {
    const { onOpen, user } = setup()
    await user.click(card("Dinn Rí"))
    expect(onOpen).toHaveBeenLastCalledWith("a")
    card("Brid Ní").focus()
    await user.keyboard("{Enter}")
    expect(onOpen).toHaveBeenLastCalledWith("b")
  })

  it("moves a card by keyboard: Space, ArrowRight, Space", async () => {
    const { onMove, user } = setup()
    card("Dinn Rí").focus()
    await user.keyboard(" ")
    await tick()
    expect(
      await screen.findByText("Picked up enquiry from Dinn Rí")
    ).toBeInTheDocument()
    await user.keyboard("{ArrowRight}")
    expect(await screen.findByText("Moved to Contacted")).toBeInTheDocument()
    await user.keyboard(" ")
    expect(onMove).toHaveBeenCalledWith("a", "contacted")
    expect(await screen.findByText("Dropped in Contacted")).toBeInTheDocument()
    await waitFor(() =>
      expect(
        within(column("Contacted")).getByRole("button", { name: /^Dinn Rí/ })
      ).toBeInTheDocument()
    )
    expect(
      within(column("Contacted")).getByRole("heading", { name: "Contacted 1" })
    ).toBeInTheDocument()
  })

  it("a rejected move puts the card back with an error toast", async () => {
    let reject: (error: Error) => void = () => {}
    const onMove = vi.fn(
      () =>
        new Promise<void>((_, no) => {
          reject = no
        })
    )
    const { user } = setup({ onMove })
    card("Dinn Rí").focus()
    await user.keyboard(" ")
    await tick()
    await user.keyboard("{ArrowRight}")
    await user.keyboard(" ")
    expect(onMove).toHaveBeenCalledWith("a", "contacted")
    // Optimistic: in Contacted while the save is on its way.
    await waitFor(() =>
      expect(
        within(column("Contacted")).getByRole("button", { name: /^Dinn Rí/ })
      ).toBeInTheDocument()
    )
    await act(async () => reject(new Error("boom")))
    await waitFor(() =>
      expect(
        within(column("New")).getByRole("button", { name: /^Dinn Rí/ })
      ).toBeInTheDocument()
    )
    expect(
      within(column("Contacted")).queryByRole("button", { name: /^Dinn Rí/ })
    ).toBeNull()
    expect(toast.error).toHaveBeenCalledWith("Couldn't move that enquiry")
  })

  it("moves by the Move menu (single-pointer alternative)", async () => {
    const { onMove, user } = setup()
    await user.click(
      screen.getByRole("button", { name: "Move Dinn Rí to another column" })
    )
    await user.click(await screen.findByRole("menuitem", { name: "Won" }))
    expect(onMove).toHaveBeenCalledWith("a", "won")
    await waitFor(() =>
      expect(
        within(column("Won")).getByRole("button", { name: /^Dinn Rí/ })
      ).toBeInTheDocument()
    )
    expect(screen.getByText("Moved Dinn Rí to Won")).toBeInTheDocument()
  })

  it("without lead:update Space does not pick up a card, but cards open", async () => {
    const { onMove, onOpen, user } = setup({ canUpdate: false })
    card("Dinn Rí").focus()
    await user.keyboard(" ")
    await tick()
    await user.keyboard("{ArrowRight}")
    await user.keyboard(" ")
    expect(onMove).not.toHaveBeenCalled()
    expect(screen.queryByText(/Picked up enquiry/)).toBeNull()
    expect(
      within(column("New")).getByRole("button", { name: /^Dinn Rí/ })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /to another column/ })
    ).toBeNull()
    await user.click(card("Brid Ní"))
    expect(onOpen).toHaveBeenLastCalledWith("b")
  })
})
