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
const TOKEN_TIMEOUT_MS = 15_000

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

  const prepare = useCallback(() => {
    ready.current ??= (async (): Promise<Widget | null> => {
      try {
        const res = await fetch(LEADS_CONFIG_ENDPOINT)
        if (!res.ok) return null
        const { turnstileSiteKey } = (await res.json()) as LeadPublicConfig
        if (!turnstileSiteKey || !container.current) return null
        const api = await loadTurnstileScript()
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
        return null
      }
    })()
    return ready.current
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

  useEffect(
    () => () => {
      const w = widget.current
      if (w) w.api.remove(w.id)
    },
    []
  )

  return { prepare, getToken, reset }
}
