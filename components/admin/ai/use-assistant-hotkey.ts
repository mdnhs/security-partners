"use client"

import { useEffect } from "react"

type KeyLike = Pick<
  KeyboardEvent,
  "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey"
>

/** ⌘J / Ctrl+J (JW parity). TipTap binds no Mod-j, so it works in rich text too. */
export function isAssistantShortcut(event: KeyLike): boolean {
  return (
    event.key?.toLowerCase() === "j" &&
    (event.metaKey || event.ctrlKey) &&
    !event.altKey &&
    !event.shiftKey
  )
}

/**
 * Another modal dialog is open (palette, a sheet, a confirmation): the
 * shortcut must not stack the assistant on top of it. Popovers are not
 * modal, and the assistant's own panel is what the shortcut toggles.
 */
const OTHER_MODAL =
  '[aria-modal="true"]:not([data-assistant-panel]), [role="alertdialog"], [role="dialog"]:not([data-slot="popover-content"]):not([data-assistant-panel])'

export function otherModalOpen(root: ParentNode = document): boolean {
  return root.querySelector(OTHER_MODAL) !== null
}

export function useAssistantHotkey(enabled: boolean, onTrigger: () => void) {
  useEffect(() => {
    if (!enabled) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.repeat || event.defaultPrevented || !isAssistantShortcut(event))
        return
      if (otherModalOpen()) return
      event.preventDefault()
      onTrigger()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [enabled, onTrigger])
}
