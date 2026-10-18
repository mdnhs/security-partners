"use client"

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

/** The record on screen (spec §8.3: read-only JSON sent with a message). */
export type AssistantScreen = {
  title: string
  entityType?: string
  entityId?: string
  record?: unknown
}

/** What the panel shows about the shared screen (state, unlike the record). */
export type ScreenInfo = { title: string; entityType: string | null }

/** The text field last focused in the open form; `apply` writes a suggestion into it. */
export type AssistantField = {
  path: string
  label: string
  maxLength: number | null
  /** DOM id of the input, focused after inserting. */
  elementId: string
  /** The field's value now. */
  read: () => string
  apply: (text: string) => void
}

type Registration = { token: symbol; get: () => AssistantScreen }

type AssistantContextValue = {
  screen: ScreenInfo | null
  field: AssistantField | null
  /** The shared screen as it is now (latest record). */
  snapshot: () => AssistantScreen | null
  register: (registration: Registration, info: ScreenInfo) => void
  unregister: (token: symbol) => void
  setField: (token: symbol, field: AssistantField | null) => void
}

const NOOP: AssistantContextValue = {
  screen: null,
  field: null,
  snapshot: () => null,
  register: () => {},
  unregister: () => {},
  setField: () => {},
}

const AssistantContext = createContext<AssistantContextValue>(NOOP)

/** Holds the screen the assistant may see (one at a time; the newest wins). */
export function AssistantProvider({ children }: { children: ReactNode }) {
  const current = useRef<Registration | null>(null)
  const [screen, setScreen] = useState<ScreenInfo | null>(null)
  const [owned, setOwned] = useState<{
    token: symbol
    field: AssistantField
  } | null>(null)

  const register = useCallback(
    (registration: Registration, info: ScreenInfo) => {
      if (current.current?.token !== registration.token) setOwned(null)
      current.current = registration
      setScreen(info)
    },
    []
  )
  const unregister = useCallback((token: symbol) => {
    if (current.current?.token !== token) return
    current.current = null
    setScreen(null)
    setOwned(null)
  }, [])
  const setField = useCallback(
    (token: symbol, field: AssistantField | null) => {
      if (current.current?.token !== token) return
      setOwned(field ? { token, field } : null)
    },
    []
  )
  const snapshot = useCallback(() => current.current?.get() ?? null, [])

  const value = useMemo<AssistantContextValue>(
    () => ({
      screen,
      field: owned?.field ?? null,
      snapshot,
      register,
      unregister,
      setField,
    }),
    [screen, owned, snapshot, register, unregister, setField]
  )
  return (
    <AssistantContext.Provider value={value}>
      {children}
    </AssistantContext.Provider>
  )
}

/** The panel's view of the shared screen. Outside the provider: nothing shared. */
export function useAssistant(): Pick<
  AssistantContextValue,
  "screen" | "field" | "snapshot"
> {
  return useContext(AssistantContext)
}

/**
 * Shares the calling screen's record with the assistant while it is
 * mounted (null = nothing yet, e.g. still loading). The latest value is
 * read when a message is sent, so typing does not re-render the shell.
 * Returns `setField` for the form's focused text field.
 */
export function useAssistantScreen(screen: AssistantScreen | null): {
  setField: (field: AssistantField | null) => void
} {
  const {
    register,
    unregister,
    setField: setOwnedField,
  } = useContext(AssistantContext)
  const [token] = useState(() => Symbol("assistant-screen"))
  const latest = useRef(screen)
  useEffect(() => {
    latest.current = screen
  })
  const title = screen?.title ?? null
  const entityType = screen?.entityType ?? null
  useEffect(() => {
    if (title === null) return
    register(
      { token, get: () => latest.current ?? { title } },
      { title, entityType }
    )
    return () => unregister(token)
  }, [title, entityType, token, register, unregister])
  const setField = useCallback(
    (field: AssistantField | null) => setOwnedField(token, field),
    [setOwnedField, token]
  )
  return { setField }
}
