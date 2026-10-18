"use client"

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react"

import {
  clearTrackingCookies,
  CONSENT_COOKIE,
  type ConsentChoice,
  consentCookie,
  consentModeUpdate,
  cookieValue,
  readConsent,
  withdrawn,
} from "@/lib/analytics/consent"
import type { AnalyticsWindow } from "@/lib/analytics/events"

/** Server render and hydration: the cookie is not known yet. */
const PENDING = "pending" as const
type ConsentState = ConsentChoice | null | typeof PENDING

type ConsentContextValue = {
  choice: ConsentState
  bannerOpen: boolean
  /** Reopens the banner on its category choices ("Cookie settings"). */
  reopen: () => void
  save: (choice: ConsentChoice) => void
}

const ConsentContext = createContext<ConsentContextValue | null>(null)

export function useConsent(): ConsentContextValue {
  const value = useContext(ConsentContext)
  if (!value)
    throw new Error("useConsent must be used inside <ConsentProvider>")
  return value
}

/** The visitor's choice: read once from the cookie, then kept in memory. */
function createStore() {
  let value: ConsentChoice | null | undefined
  const listeners = new Set<() => void>()
  const publish = (next: ConsentChoice | null) => {
    value = next
    ;(window as AnalyticsWindow).__spConsent = next
  }
  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    get(): ConsentChoice | null {
      if (value === undefined)
        publish(
          readConsent(cookieValue(document.cookie, CONSENT_COOKIE), Date.now())
        )
      return value ?? null
    },
    set(next: ConsentChoice) {
      publish(next)
      for (const listener of listeners) listener()
    },
  }
}

const serverSnapshot = (): ConsentState => PENDING

/**
 * Rendered only when tracking is enabled (components/site-extras.tsx).
 * Stores the choice in the sp_consent cookie for 6 months, mirrors it to
 * Google Consent Mode, and reloads after a withdrawal (running tags cannot
 * be unloaded; their cookies are cleared first).
 */
export function ConsentProvider({
  children,
  reload = () => window.location.reload(),
}: {
  children: ReactNode
  reload?: () => void
}) {
  const [store] = useState(createStore)
  const choice = useSyncExternalStore<ConsentState>(
    store.subscribe,
    store.get,
    serverSnapshot
  )
  const [reopened, setReopened] = useState(false)
  const save = useCallback(
    (next: ConsentChoice) => {
      const previous = store.get()
      document.cookie = consentCookie(
        next,
        Date.now(),
        window.location.protocol === "https:"
      )
      store.set(next)
      ;(window as AnalyticsWindow).gtag?.(
        "consent",
        "update",
        consentModeUpdate(next)
      )
      setReopened(false)
      if (withdrawn(previous, next)) {
        clearTrackingCookies(document, window.location.hostname)
        reload()
      }
    },
    [store, reload]
  )
  const value = useMemo<ConsentContextValue>(
    () => ({
      choice,
      bannerOpen: choice !== PENDING && (choice === null || reopened),
      reopen: () => setReopened(true),
      save,
    }),
    [choice, reopened, save]
  )
  return (
    <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>
  )
}
