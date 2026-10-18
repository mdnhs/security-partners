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
 * - the browser's Back button: while dirty a guard history entry (same URL)
 *   sits on top, so Back lands on the page's own entry and the dialog asks;
 *   "Keep editing" puts the guard entry back, "Leave" goes back for real,
 * - reloads and closing the tab: the browser's own beforeunload prompt.
 *
 * Limits (App Router has no navigation-blocking API): jumping several entries
 * at once from the browser's history menu, Forward after a Back, and code that
 * calls `router.push()` directly are not intercepted. The guard entry is
 * pushed on a page's first unsaved edit and kept for the visit: a Back press
 * with nothing unsaved passes straight through, and guarded links and ⌘K
 * replace it, so it does not linger in the history (a direct `router.push()`
 * leaves it behind as one same-page step).
 */
export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const tokens = useRef(new Set<symbol>())
  const [dirtyCount, setDirtyCount] = useState(0)
  const [prompt, setPrompt] = useState<((leave: boolean) => void) | null>(null)
  const leavingRef = useRef(false)
  /** URL the guard history entry was pushed for; null when none is armed. */
  const armedHref = useRef<string | null>(null)
  const [armed, setArmed] = useState(false)

  const ask = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        setPrompt(() => (leave: boolean) => {
          setPrompt(null)
          resolve(leave)
        })
      }),
    []
  )

  const arm = useCallback(() => {
    armedHref.current = window.location.href
    setArmed(true)
    window.history.pushState(
      { ...(window.history.state ?? {}), [SENTINEL_KEY]: true },
      "",
      window.location.href
    )
  }, [])
  const disarm = useCallback(() => {
    armedHref.current = null
    setArmed(false)
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
        if (armedHref.current === window.location.href) {
          disarm()
          router.replace(href)
        } else router.push(href)
        return true
      },
      leaving: () => leavingRef.current,
    }
  }, [ask, disarm, router])

  // Another page: its history entry is its own (any guard entry stays put).
  const [seenPath, setSeenPath] = useState(pathname)
  if (seenPath !== pathname) {
    setSeenPath(pathname)
    setArmed(false)
  }
  useEffect(() => {
    armedHref.current = null
  }, [pathname])

  // A confirmed leave only covers that one navigation.
  const dirty = dirtyCount > 0
  useEffect(() => {
    if (dirty) leavingRef.current = false
  }, [dirty])

  // The guard history entry: pushed on the first unsaved edit and kept for
  // the page's lifetime (autosave flips dirty every few seconds; consuming
  // and re-pushing it each time would churn the router).
  useEffect(() => {
    if (dirty && armedHref.current === null) arm()
  }, [dirty, arm])

  useEffect(() => {
    function onPopState() {
      const href = armedHref.current
      if (href === null) return
      disarm()
      // Several entries at once (history menu): the router is already leaving.
      if (window.location.href !== href) return
      if (tokens.current.size === 0) {
        // Nothing to lose: this Back press continues to the previous page.
        window.history.back()
        return
      }
      void ask().then((leave) => {
        if (leave) {
          leavingRef.current = true
          window.history.back()
        } else arm()
      })
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [ask, arm, disarm])

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

  // In-app links: ask while dirty; on the guard entry, replace it.
  useEffect(() => {
    if (!dirty && !armed) return
    function onClick(event: MouseEvent) {
      const url = guardedLinkTarget(event)
      if (!url) return
      if (!dirty && armedHref.current !== window.location.href) return
      event.preventDefault()
      event.stopPropagation()
      void registry.navigate(`${url.pathname}${url.search}${url.hash}`)
    }
    document.addEventListener("click", onClick, true)
    return () => document.removeEventListener("click", onClick, true)
  }, [dirty, armed, registry])

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

/** The same-origin page a plain left click on a link would open, or null. */
function guardedLinkTarget(event: MouseEvent): URL | null {
  if (event.defaultPrevented || event.button !== 0) return null
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
    return null
  const anchor = (event.target as Element | null)?.closest?.("a[href]")
  if (!(anchor instanceof HTMLAnchorElement)) return null
  if (anchor.target && anchor.target !== "_self") return null
  if (anchor.hasAttribute("download")) return null
  const url = new URL(anchor.href, window.location.href)
  if (url.origin !== window.location.origin) return null
  if (url.pathname === window.location.pathname && url.hash) return null
  return url
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
