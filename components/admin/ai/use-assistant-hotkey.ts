"use client"

import { useEffect } from "react"

type KeyLike = Pick<
  KeyboardEvent,
  "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey"
>

/** ⌘J / Ctrl+J (JW parity). TipTap binds no Mod-j, so it works in rich text too. */
export function isAssistantShortcut(event: KeyLike): boolean {
  return (
    event.key.toLowerCase() === "j" &&
    (event.metaKey || event.ctrlKey) &&
    !event.altKey &&
    !event.shiftKey
  )
}

export function useAssistantHotkey(enabled: boolean, onTrigger: () => void) {
  useEffect(() => {
    if (!enabled) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.repeat || event.defaultPrevented || !isAssistantShortcut(event))
        return
      event.preventDefault()
      onTrigger()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [enabled, onTrigger])
}
