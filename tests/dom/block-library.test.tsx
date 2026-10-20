import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { BLOCKS } from "@/blocks/registry"
import {
  BLOCK_ICONS,
  BlockLibrary,
} from "@/components/admin/builder/block-library"
import {
  addableTypes,
  type DraftDocumentValue,
} from "@/components/admin/builder/builder-state"

const DOC: DraftDocumentValue = {
  blocks: [
    {
      id: "hero-1",
      type: "hero.page",
      anchor: "hero-page",
      hidden: false,
      data: {},
    },
  ],
}

async function open() {
  const user = userEvent.setup()
  const onAdd = vi.fn()
  render(<BlockLibrary available={addableTypes(DOC)} doc={DOC} onAdd={onAdd} />)
  await user.click(screen.getByRole("button", { name: "Add block" }))
  const dialog = await screen.findByRole("dialog", { name: "Add a block" })
  return { user, onAdd, dialog }
}

describe("BlockLibrary", () => {
  it("has an icon for every block", () => {
    for (const def of BLOCKS)
      expect(BLOCK_ICONS[def.icon], def.type).toBeDefined()
  })

  it('disables "Page hero" with "Only one per page"', async () => {
    const { user, onAdd, dialog } = await open()
    const hero = within(dialog).getByRole("button", { name: "Page hero" })
    expect(hero).toHaveAttribute("aria-disabled", "true")
    expect(hero).toHaveAccessibleDescription(
      "Banner image with breadcrumb, title and intro. Only one per page"
    )
    await user.click(hero)
    expect(onAdd).not.toHaveBeenCalled()
    expect(dialog).toBeVisible()
  })

  it("lists every block with its description; adding closes the dialog", async () => {
    const { user, onAdd, dialog } = await open()
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(BLOCKS.length)
    const stats = within(dialog).getByRole("button", { name: "Stats" })
    expect(stats).not.toHaveAttribute("aria-disabled")
    expect(stats).toHaveAccessibleDescription(
      "Up to four figures with a label and a short note."
    )
    await user.click(stats)
    expect(onAdd).toHaveBeenCalledWith("stats")
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Add a block" })).toBeNull()
    )
  })
})
