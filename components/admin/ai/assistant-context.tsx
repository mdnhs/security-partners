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
  /** A textarea (line breaks allowed); single-line inputs get one line. */
  multiline: boolean
  /** DOM id of the input, focused after inserting. */
  elementId: string
  /** The field's value now. */
  read: () => string
  /** Writes the text; false when the field is gone (e.g. its list item was removed). */
  apply: (text: string) => boolean | void
}

type Registration = { token: symbol; get: () => AssistantScreen }

/** Stable for the provider's lifetime: editors use only these, so they never re-render on panel state. */
type AssistantActions = {
  /** The shared screen as it is now (latest record). */
  snapshot: () => AssistantScreen | null
  register: (registration: Registration, info: ScreenInfo) => void
  unregister: (token: symbol) => void
  setField: (token: symbol, field: AssistantField | null) => void
}

type AssistantState = {
  screen: ScreenInfo | null
  field: AssistantField | null
}

const NOOP_ACTIONS: AssistantActions = {
  snapshot: () => null,
  register: () => {},
  unregister: () => {},
  setField: () => {},
}
const EMPTY_STATE: AssistantState = { screen: null, field: null }

const ActionsContext = createContext<AssistantActions>(NOOP_ACTIONS)
const StateContext = createContext<AssistantState>(EMPTY_STATE)

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

  const actions = useMemo<AssistantActions>(
    () => ({ snapshot, register, unregister, setField }),
    [snapshot, register, unregister, setField]
  )
  const state = useMemo<AssistantState>(
    () => ({ screen, field: owned?.field ?? null }),
    [screen, owned]
  )
  return (
    <ActionsContext.Provider value={actions}>
      <StateContext.Provider value={state}>{children}</StateContext.Provider>
    </ActionsContext.Provider>
  )
}

/** The panel's view of the shared screen. Outside the provider: nothing shared. */
export function useAssistant(): AssistantState & {
  snapshot: () => AssistantScreen | null
} {
  const { snapshot } = useContext(ActionsContext)
  const state = useContext(StateContext)
  return useMemo(() => ({ ...state, snapshot }), [state, snapshot])
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
  } = useContext(ActionsContext)
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
