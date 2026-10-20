"use client"

import Link from "next/link"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authClient, authErrorMessage } from "@/lib/auth-client"

import { FormError, FormNotice } from "./form-messages"

export function ForgotPasswordForm() {
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const email = String(
      new FormData(event.currentTarget).get("email") ?? ""
    ).trim()
    setPending(true)
    setError(null)
    const { error: failure } = await authClient.requestPasswordReset({ email })
    setPending(false)
    // The answer is the same whether or not the account exists.
    if (failure && failure.status === 429) {
      setError(authErrorMessage(failure))
      return
    }
    setSentTo(email)
  }

  if (sentTo)
    return (
      <div className="flex flex-col gap-4">
        <FormNotice>
          If {sentTo} has an admin account, a reset link is on its way. It works
          once and expires in 1 hour. No email after a few minutes? Email may
          not be set up yet: ask an administrator for a password link.
        </FormNotice>
        <Link
          href="/admin/sign-in"
          className="text-center text-sm underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    )

  return (
    <form method="post" onSubmit={onSubmit} className="flex flex-col gap-4">
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
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
      <Link
        href="/admin/sign-in"
        className="text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        Back to sign in
      </Link>
    </form>
  )
}
