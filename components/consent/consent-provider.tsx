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
  recordedChoice,
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
  /** Closes a reopened banner, keeping the stored choice. */
  close: () => void
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
function createStore(version: number, maxAgeSeconds: number) {
  let value: ConsentChoice | null | undefined
  /** A cookie's choice that no longer counts (other version, too old). */
  let lapsed: ConsentChoice | null = null
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
      if (value === undefined) {
        const raw = cookieValue(document.cookie, CONSENT_COOKIE)
        const current = readConsent(raw, Date.now(), version, maxAgeSeconds)
        if (current === null) lapsed = recordedChoice(raw)
        publish(current)
      }
      return value ?? null
    },
    lapsed: () => lapsed,
    set(next: ConsentChoice) {
      lapsed = null
      publish(next)
      for (const listener of listeners) listener()
    },
  }
}

const serverSnapshot = (): ConsentState => PENDING

/**
 * Rendered only when tracking is enabled (components/site-extras.tsx).
 * Stores the choice in the sp_consent cookie for the re-consent interval,
 * under the published consent version (a cookie of another version counts
 * as no choice, so the banner asks again and nothing loads), mirrors it to
 * Google Consent Mode, and reloads after a withdrawal (running tags cannot
 * be unloaded; their cookies are cleared first).
 */
export function ConsentProvider({
  children,
  version,
  maxAgeSeconds,
  reload = () => window.location.reload(),
}: {
  children: ReactNode
  /** settings.consent.version (published). */
  version: number
  /** consentMaxAgeSeconds(settings.consent.reconsentMonths). */
  maxAgeSeconds: number
  reload?: () => void
}) {
  // Read once: the layout persists across soft navigation, so a newly
  // published version or interval applies from the next full page load.
  const [store] = useState(() => createStore(version, maxAgeSeconds))
  const choice = useSyncExternalStore<ConsentState>(
    store.subscribe,
    store.get,
    serverSnapshot
  )
  const [reopened, setReopened] = useState(false)
  const save = useCallback(
    (next: ConsentChoice) => {
      const previous = store.get()
      const lapsed = store.lapsed()
      document.cookie = consentCookie(next, Date.now(), {
        version,
        maxAgeSeconds,
        secure: window.location.protocol === "https:",
      })
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
      } else if (withdrawn(lapsed, next)) {
        // Re-consent (new version or interval over) answered with Reject:
        // the old choice's GA/Meta cookies go too. Nothing has loaded
        // under the new version, so no reload is needed.
        clearTrackingCookies(document, window.location.hostname)
      }
    },
    [store, reload, version, maxAgeSeconds]
  )
  const value = useMemo<ConsentContextValue>(
    () => ({
      choice,
      bannerOpen: choice !== PENDING && (choice === null || reopened),
      reopen: () => setReopened(true),
      close: () => setReopened(false),
      save,
    }),
    [choice, reopened, save]
  )
  return (
    <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>
  )
}
