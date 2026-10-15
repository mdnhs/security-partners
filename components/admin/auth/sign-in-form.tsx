"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { safeNext } from "@/lib/auth/redirect"
import { authClient, authErrorMessage } from "@/lib/auth-client"

import { FormError, FormNotice } from "./form-messages"

const NOTICES: Record<string, string> = {
  "password-set": "Your password is set. Sign in to continue.",
  "password-reset": "Password changed. Sign in with your new password.",
  "signed-out": "You are signed out.",
}

/** The notice for `?notice=…`; only our own keys (never `__proto__` etc.). */
export function signInNotice(key: string | null): string | null {
  return key !== null && Object.hasOwn(NOTICES, key) ? NOTICES[key] : null
}

export function SignInForm() {
  const router = useRouter()
  const params = useSearchParams()
  const next = safeNext(params.get("next"))
  const notice = signInNotice(params.get("notice"))
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setPending(true)
    setError(null)
    const { data, error: failure } = await authClient.signIn.email({
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("password") ?? ""),
    })
    if (failure) {
      setError(authErrorMessage(failure))
      setPending(false)
      return
    }
    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
      router.push(`/admin/two-factor?next=${encodeURIComponent(next)}`)
      return
    }
    router.replace(next)
    router.refresh()
  }

  return (
    <form method="post" onSubmit={onSubmit} className="flex flex-col gap-4">
      {notice && !error ? <FormNotice>{notice}</FormNotice> : null}
      {error ? <FormError>{error}</FormError> : null}
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
        />
      </div>
      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link
            href="/admin/forgot-password"
            className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  )
}
