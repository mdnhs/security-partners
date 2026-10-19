import { screen, waitFor } from "@testing-library/react"
import type { UserEvent } from "@testing-library/user-event"
import { expect } from "vitest"

/**
 * Picks an option in a shadcn (Base UI) Select the way a keyboard user does:
 * open the combobox, wait for the list, then choose the option by name.
 * Replaces `user.selectOptions` for the former native <select>s.
 */
export async function pickOption(
  user: UserEvent,
  combobox: HTMLElement,
  name: string | RegExp
) {
  await user.click(combobox)
  const listbox = await screen.findByRole("listbox")
  const option = await waitFor(() => {
    const match = [
      ...listbox.querySelectorAll<HTMLElement>('[role="option"]'),
    ].find((o) =>
      typeof name === "string"
        ? o.textContent?.trim() === name
        : name.test(o.textContent ?? "")
    )
    expect(match).toBeTruthy()
    return match!
  })
  await user.click(option)
  await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull())
}

/** Option labels of a shadcn Select (opens and closes it again). */
export async function optionLabels(user: UserEvent, combobox: HTMLElement) {
  await user.click(combobox)
  const listbox = await screen.findByRole("listbox")
  const labels = [
    ...listbox.querySelectorAll<HTMLElement>('[role="option"]'),
  ].map((o) => o.textContent?.trim() ?? "")
  await user.keyboard("{Escape}")
  await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull())
  return labels
}
