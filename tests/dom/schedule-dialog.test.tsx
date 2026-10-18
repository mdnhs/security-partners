import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { ScheduleDialog } from "@/components/admin/articles/schedule-dialog"

const NOW = () => new Date("2026-06-01T12:00:00Z")

function renderDialog(initial: string | null = null) {
  const onConfirm = vi.fn()
  render(
    <ScheduleDialog
      open
      onOpenChange={vi.fn()}
      initial={initial}
      pending={false}
      onConfirm={onConfirm}
      now={NOW}
    />
  )
  const dialog = screen.getByRole("dialog", { name: "Schedule publishing" })
  return {
    dialog,
    onConfirm,
    input: within(dialog).getByLabelText("Publish on"),
  }
}

describe("schedule dialog (master 5.3: Europe/Dublin)", () => {
  it("starts an hour from now in Irish time, or at the current schedule", () => {
    expect(renderDialog().input).toHaveValue("2026-06-01T14:00")
  })

  it("shows an existing schedule in Irish time", () => {
    expect(renderDialog("2026-12-24T09:30:00.000Z").input).toHaveValue(
      "2026-12-24T09:30"
    )
  })

  it("sends the UTC instant of the Irish time picked", async () => {
    const user = userEvent.setup()
    const { dialog, input, onConfirm } = renderDialog()
    fireEvent.change(input, { target: { value: "2026-07-01T10:00" } })
    expect(dialog).toHaveTextContent("Goes live")
    await user.click(within(dialog).getByRole("button", { name: "Schedule" }))
    expect(onConfirm).toHaveBeenCalledWith("2026-07-01T09:00:00.000Z")
  })

  it("refuses a time in the past", async () => {
    const user = userEvent.setup()
    const { dialog, input, onConfirm } = renderDialog()
    fireEvent.change(input, { target: { value: "2026-05-31T10:00" } })
    await user.click(within(dialog).getByRole("button", { name: "Schedule" }))
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Choose a time in the future."
    )
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
