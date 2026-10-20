"use client"

import { usePathname, useRouter } from "next/navigation"
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

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export const UNSAVED_MESSAGE =
  "You have changes that are not saved yet. Leave this page anyway?"

/** History-state key of the guard entry pushed while something is dirty. */
const SENTINEL_KEY = "__spUnsaved"
/** History-state key marking the page's own entry below the guard entry. */
const OWN_KEY = "__spUnsavedOwn"

type UnsavedRegistry = {
  /** Marks one edit surface dirty until the returned function runs. */
  register(): () => void
  isDirty(): boolean
  /** Resolves true when nothing is dirty or the person chose to leave. */
  confirmLeave(): Promise<boolean>
  /** In-app navigation that asks first (⌘K, sign-out, intercepted links). */
  navigate(href: string): Promise<boolean>
  /** True while a confirmed leave is under way (beforeunload stays quiet). */
  leaving(): boolean
}

const UnsavedContext = createContext<UnsavedRegistry | null>(null)

/**
 * The shell's one unsaved-changes registry (final review I2/I3). Every
 * `<UnsavedGuard when>` registers into it, and everything that leaves the
 * page consults it and shows the same styled "Leave without saving?" dialog:
 * - same-origin `<a href>` clicks (sidebar, breadcrumbs, record links),
 * - programmatic navigation through `navigate()` (⌘K palette) and
 *   `confirmLeave()` (sign-out),
 * - the browser's Back button: on the first unsaved edit the current entry
 *   is marked as the page's own and a guard entry (same URL) is pushed above
 *   it. Only landing on that OWN entry asks; landing on the guard entry
 *   (Back from a later ?tab= step, or Forward) is silent. "Keep editing"
 *   pushes the guard entry again, "Leave" goes back for real (and guards
 *   again if that lands on the same, still dirty page),
 * - reloads and closing the tab: the browser's own beforeunload prompt.
 * Links are only intercepted while dirty; a confirmed click is re-dispatched
 * to the link, so its own options (scroll={false}, replace) still apply.
 * /api/* and download links are never intercepted.
 *
 * Limits (App Router has no navigation-blocking API): jumping several entries
 * at once from the browser's history menu, and code that calls
 * `router.push()` directly, are not intercepted. The guard entry is kept for
 * the page visit: once saved, a Back press onto the own entry passes straight
 * through to the previous page; a link followed after saving leaves the guard
 * entry behind as one same-page Back step (⌘K replaces it instead).
 */
export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const tokens = useRef(new Set<symbol>())
  const [dirtyCount, setDirtyCount] = useState(0)
  const [prompt, setPrompt] = useState<((leave: boolean) => void) | null>(null)
  /** The open prompt's resolver: a second ask() settles it as "stay". */
  const pending = useRef<((leave: boolean) => void) | null>(null)
  const leavingRef = useRef(false)
  /**
   * The guard for this page visit: `own` marks the page's own history entry
   * (where the first unsaved edit happened), and a guard entry sits above
   * it. null when nothing is armed.
   */
  const guard = useRef<{ own: string; path: string } | null>(null)
  /** A confirmed Back is under way: the next popstate is its landing. */
  const backing = useRef(false)
  /** A confirmed link click re-dispatched to the link itself. */
  const bypassClick = useRef(false)

  const ask = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        // Never leave an earlier prompt's promise dangling: it stays.
        pending.current?.(false)
        const settle = (leave: boolean) => {
          if (pending.current !== settle) return
          pending.current = null
          setPrompt(null)
          resolve(leave)
        }
        pending.current = settle
        setPrompt(() => settle)
      }),
    []
  )

  /** Marks the current entry as the page's own and pushes the guard entry. */
  const arm = useCallback(() => {
    const own = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    guard.current = { own, path: window.location.pathname }
    const state = (window.history.state ?? {}) as Record<string, unknown>
    window.history.replaceState(
      { ...state, [OWN_KEY]: own },
      "",
      window.location.href
    )
    window.history.pushState(
      { ...state, [SENTINEL_KEY]: own },
      "",
      window.location.href
    )
  }, [])

  const registry = useMemo<UnsavedRegistry>(() => {
    const confirmLeave = async () => {
      if (tokens.current.size === 0) return true
      const leave = await ask()
      if (leave) leavingRef.current = true
      return leave
    }
    return {
      register() {
        const token = Symbol("unsaved")
        tokens.current.add(token)
        setDirtyCount(tokens.current.size)
        return () => {
          tokens.current.delete(token)
          setDirtyCount(tokens.current.size)
        }
      },
      isDirty: () => tokens.current.size > 0,
      confirmLeave,
      async navigate(href) {
        if (!(await confirmLeave())) return false
        // On the guard entry, replace it: Back must not land on a stale copy.
        const onGuardEntry =
          guard.current !== null &&
          (window.history.state as Record<string, unknown> | null)?.[
            SENTINEL_KEY
          ] === guard.current.own
        if (onGuardEntry) router.replace(href)
        else router.push(href)
        return true
      },
      leaving: () => leavingRef.current,
    }
  }, [ask, router])

  // Another page: the guard belonged to the previous one.
  useEffect(() => {
    if (guard.current && guard.current.path !== window.location.pathname)
      guard.current = null
  }, [pathname])

  // A confirmed leave only covers that one navigation.
  const dirty = dirtyCount > 0
  useEffect(() => {
    if (dirty) leavingRef.current = false
  }, [dirty])

  // The guard entry: pushed on the first unsaved edit and kept for the
  // page's visit (autosave flips dirty every few seconds; consuming and
  // re-pushing it each time would churn the router).
  useEffect(() => {
    if (dirty && guard.current === null) arm()
  }, [dirty, arm])

  useEffect(() => {
    function onPopState() {
      const current = guard.current
      if (!current) return
      const state = (window.history.state ?? {}) as Record<string, unknown>
      if (backing.current) {
        // Where a confirmed Back landed. Still this page and still dirty
        // (the entry below was the same page): guard again.
        backing.current = false
        guard.current = null
        if (
          window.location.pathname === current.path &&
          tokens.current.size > 0
        )
          arm()
        return
      }
      // Only Back onto the page's OWN entry leaves past the first edit. The
      // guard entry itself (Back from a ?tab= step, or Forward) and other
      // same-page steps are silent; another page is the router's.
      if (state[OWN_KEY] !== current.own) return
      if (tokens.current.size === 0) {
        // Nothing to lose: this Back press continues to the previous page.
        guard.current = null
        window.history.back()
        return
      }
      void ask().then((leave) => {
        if (guard.current !== current) return
        if (leave) {
          leavingRef.current = true
          backing.current = true
          window.history.back()
        } else {
          // Stay: put the guard entry back above the own entry.
          window.history.pushState(
            { ...state, [OWN_KEY]: undefined, [SENTINEL_KEY]: current.own },
            "",
            window.location.href
          )
        }
      })
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [ask, arm])

  // Reloads/closing the tab while dirty.
  useEffect(() => {
    if (!dirty) return
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (leavingRef.current) return
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [dirty])

  // In-app links while dirty: ask, then let the link itself navigate (its
  // own scroll/replace/prefetch behaviour is kept).
  useEffect(() => {
    if (!dirty) return
    function onClick(event: MouseEvent) {
      if (bypassClick.current) {
        bypassClick.current = false
        return
      }
      const target = guardedLinkTarget(event)
      if (!target) return
      event.preventDefault()
      event.stopPropagation()
      void registry.confirmLeave().then((leave) => {
        if (!leave || !target.anchor.isConnected) return
        bypassClick.current = true
        target.anchor.click()
      })
    }
    document.addEventListener("click", onClick, true)
    return () => document.removeEventListener("click", onClick, true)
  }, [dirty, registry])

  return (
    <UnsavedContext.Provider value={registry}>
      {children}
      <AlertDialog
        open={prompt !== null}
        onOpenChange={(open) => {
          if (!open) prompt?.(false)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>
              You have changes that are not saved yet. If you leave now, they
              are lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              onClick={() => prompt?.(true)}
            >
              Leave page
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </UnsavedContext.Provider>
  )
}

/**
 * Attribute of links that stay on the page (their click handler updates
 * the URL in place): the unsaved-changes guard lets them through.
 */
export const IN_PAGE_LINK = "data-in-page"

/** The same-origin page a plain left click on a link would open, or null. */
function guardedLinkTarget(
  event: MouseEvent
): { url: URL; anchor: HTMLAnchorElement } | null {
  if (event.defaultPrevented || event.button !== 0) return null
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
    return null
  const anchor = (event.target as Element | null)?.closest?.("a[href]")
  if (!(anchor instanceof HTMLAnchorElement)) return null
  if (anchor.target && anchor.target !== "_self") return null
  if (anchor.hasAttribute("download")) return null
  // In-page links (e.g. an editor's SEO tab link: ?tab=seo on the same
  // path) switch state without leaving: never a leave prompt, and never the
  // "confirmed leave" that would mute beforeunload. Only on the current
  // path: misused on a link to another page, it still asks.
  const url = new URL(anchor.href, window.location.href)
  if (url.origin !== window.location.origin) return null
  if (
    anchor.hasAttribute(IN_PAGE_LINK) &&
    url.pathname === window.location.pathname
  )
    return null
  // API routes (CSV exports, files) never unload the page.
  if (url.pathname.startsWith("/api/")) return null
  if (url.pathname === window.location.pathname && url.hash) return null
  return { url, anchor }
}

/** The shell registry, or null outside the admin shell (tests, auth pages). */
export function useUnsavedRegistry(): UnsavedRegistry | null {
  return useContext(UnsavedContext)
}

/**
 * Asks before leaving: resolves true when nothing is dirty (or there is no
 * shell registry) or the person chose to leave.
 */
export function useConfirmLeave(): () => Promise<boolean> {
  const registry = useContext(UnsavedContext)
  return useCallback(
    () => (registry ? registry.confirmLeave() : Promise.resolve(true)),
    [registry]
  )
}

/**
 * Marks the surrounding edit surface dirty while `when` is true (spec §8.2).
 * Inside the admin shell it registers with `UnsavedChangesProvider`, which
 * guards links, ⌘K, sign-out, Back and reloads. Outside it (tests, auth
 * pages) it falls back to the browser's beforeunload prompt and a confirm()
 * for same-origin links.
 */
export function UnsavedGuard({ when }: { when: boolean }) {
  const registry = useContext(UnsavedContext)
  useEffect(() => {
    if (!when || !registry) return
    return registry.register()
  }, [when, registry])
  useEffect(() => {
    if (!when || registry) return
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ""
    }
    function onClick(event: MouseEvent) {
      if (!guardedLinkTarget(event)) return
      if (!window.confirm(UNSAVED_MESSAGE)) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    document.addEventListener("click", onClick, true)
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload)
      document.removeEventListener("click", onClick, true)
    }
  }, [when, registry])
  return null
}

/**
 * Has an uncontrolled form changed from its initial values? (text fields,
 * textareas, selects, checkboxes) — for `onInput` dirty tracking.
 */
export function formChanged(form: HTMLFormElement): boolean {
  return Array.from(form.elements).some((element) => {
    if (element instanceof HTMLInputElement) {
      if (element.disabled || element.readOnly) return false
      if (element.type === "checkbox" || element.type === "radio")
        return element.checked !== element.defaultChecked
      return element.value !== element.defaultValue
    }
    if (element instanceof HTMLTextAreaElement)
      return element.value !== element.defaultValue
    if (element instanceof HTMLSelectElement) {
      const options = Array.from(element.options)
      const initial = options.map((option) => option.defaultSelected)
      // A single select with no `selected` option starts on the first one.
      if (!element.multiple && options.length && !initial.some(Boolean))
        initial[0] = true
      return options.some((option, i) => option.selected !== initial[i])
    }
    return false
  })
}
