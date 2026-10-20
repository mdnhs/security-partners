"use client"

import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react"

type PaletteState = { open: boolean; setOpen(open: boolean): void }

const PaletteContext = createContext<PaletteState | null>(null)

/** Open state of the ⌘K palette, shared by the topbar pill and the dialog. */
export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const value = useMemo(() => ({ open, setOpen }), [open])
  return (
    <PaletteContext.Provider value={value}>{children}</PaletteContext.Provider>
  )
}

export function useCommandPalette(): PaletteState {
  const state = useContext(PaletteContext)
  if (!state)
    throw new Error("useCommandPalette must be used inside <AdminShell>")
  return state
}
