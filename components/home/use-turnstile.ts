"use client"

import { type RefObject, useCallback, useEffect, useRef } from "react"

import {
  LEADS_CONFIG_ENDPOINT,
  type LeadPublicConfig,
} from "@/lib/schemas/api/leads"

export type TurnstileRenderOptions = {
  sitekey: string
  execution: "execute"
  callback: (token: string) => void
  "error-callback": () => void
  "expired-callback": () => void
}

export type TurnstileApi = {
  render(el: HTMLElement, options: TurnstileRenderOptions): string
  execute(id: string): void
  reset(id: string): void
  remove(id: string): void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

export const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
const TOKEN_TIMEOUT_MS = 8_000

let scriptPromise: Promise<TurnstileApi> | null = null

function loadTurnstileScript(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  scriptPromise ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script")
    script.src = TURNSTILE_SCRIPT_SRC
    script.async = true
    script.onload = () =>
      window.turnstile
        ? resolve(window.turnstile)
        : reject(new Error("Turnstile unavailable"))
    script.onerror = () => {
      scriptPromise = null
      reject(new Error("Turnstile failed to load"))
    }
    document.head.appendChild(script)
  })
  return scriptPromise
}

type Widget = {
  api: TurnstileApi
  id: string
  pending: ((token: string | null) => void) | null
}

/**
 * Invisible Cloudflare Turnstile for the contact form (spec §9). Nothing
 * loads until prepare() (first focus); without a site key every token is
 * null and the server decides.
 */
export function useTurnstile(container: RefObject<HTMLDivElement | null>) {
  const ready = useRef<Promise<Widget | null> | null>(null)
  const widget = useRef<Widget | null>(null)
  const unmounted = useRef(false)

  const prepare = useCallback(() => {
    if (ready.current) return ready.current
    // A failure (network, non-OK, script error) clears the cache so the
    // next getToken() retries; only "no site key" stays cached as null.
    const retryLater = () => {
      if (ready.current === attempt) ready.current = null
      return null
    }
    const attempt = (async (): Promise<Widget | null> => {
      try {
        const res = await fetch(LEADS_CONFIG_ENDPOINT)
        if (!res.ok) return retryLater()
        const { turnstileSiteKey } = (await res.json()) as LeadPublicConfig
        if (!turnstileSiteKey) return null
        if (unmounted.current || !container.current) return retryLater()
        const api = await loadTurnstileScript()
        // Unmounted during the awaits: the cleanup has already run, so a
        // widget rendered now would never be removed. No await follows.
        if (unmounted.current || !container.current) return retryLater()
        const w: Widget = { api, id: "", pending: null }
        const settle = (token: string | null) => {
          const pending = w.pending
          w.pending = null
          pending?.(token)
        }
        w.id = api.render(container.current, {
          sitekey: turnstileSiteKey,
          execution: "execute",
          callback: (token) => settle(token),
          "error-callback": () => settle(null),
          "expired-callback": () => undefined,
        })
        widget.current = w
        return w
      } catch {
        return retryLater()
      }
    })()
    ready.current = attempt
    return attempt
  }, [container])

  const getToken = useCallback(async (): Promise<string | null> => {
    const w = await prepare()
    if (!w) return null
    return new Promise<string | null>((resolve) => {
      const timer = setTimeout(() => {
        w.pending = null
        resolve(null)
      }, TOKEN_TIMEOUT_MS)
      w.pending = (token) => {
        clearTimeout(timer)
        resolve(token)
      }
      w.api.execute(w.id)
    })
  }, [prepare])

  /** Tokens are single-use: reset after every submit. */
  const reset = useCallback(() => {
    const w = widget.current
    if (w) w.api.reset(w.id)
  }, [])

  useEffect(() => {
    unmounted.current = false
    return () => {
      unmounted.current = true
      const w = widget.current
      widget.current = null
      ready.current = null
      if (w) w.api.remove(w.id)
    }
  }, [])

  return { prepare, getToken, reset }
}
