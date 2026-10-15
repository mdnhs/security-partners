"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth/password"
import { authClient, authErrorMessage } from "@/lib/auth-client"

import { FormError } from "./form-messages"

/**
 * Sets a password from a single-use token: "set" for invites (first
 * password), "reset" for forgot-password and admin-issued links. Both call
 * POST /api/auth/reset-password; other sessions are signed out.
 */
export function PasswordForm({ mode }: { mode: "set" | "reset" }) {
  const router = useRouter()
  const token = useSearchParams().get("token")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  if (!token)
    return (
      <div className="flex flex-col gap-4">
        <FormError>
          This link is incomplete. Open the link from your email again, or ask
          an administrator for a new one.
        </FormError>
        <Link
          href="/admin/sign-in"
          className="text-center text-sm underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    )

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = String(form.get("password") ?? "")
    const confirm = String(form.get("confirm") ?? "")
    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(`Use at least ${PASSWORD_MIN_LENGTH} characters.`)
      return
    }
    if (password !== confirm) {
      setError("The two passwords do not match.")
      return
    }
    setPending(true)
    setError(null)
    const { error: failure } = await authClient.resetPassword({
      newPassword: password,
      token: token as string,
    })
    if (failure) {
      setError(authErrorMessage(failure))
      setPending(false)
      return
    }
    router.replace(
      `/admin/sign-in?notice=${mode === "set" ? "password-set" : "password-reset"}`
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {error ? <FormError>{error}</FormError> : null}
      <div className="grid gap-2">
        <Label htmlFor="password">
          {mode === "set" ? "Password" : "New password"}
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          maxLength={PASSWORD_MAX_LENGTH}
          required
          autoFocus
          aria-describedby="password-hint"
        />
        <p id="password-hint" className="text-xs text-muted-foreground">
          At least {PASSWORD_MIN_LENGTH} characters. A short sentence is easy to
          remember and hard to guess.
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="confirm">Repeat password</Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          maxLength={PASSWORD_MAX_LENGTH}
          required
        />
      </div>
      <Button type="submit" size="lg" disabled={pending}>
        {pending
          ? "Saving…"
          : mode === "set"
            ? "Set password"
            : "Change password"}
      </Button>
    </form>
  )
}
