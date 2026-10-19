"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"

import { Button, buttonClassName } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { safeNext } from "@/lib/auth/redirect"
import { authClient, authErrorMessage } from "@/lib/auth-client"

import { FormError } from "./form-messages"

const EXPIRED = new Set([
  "INVALID_TWO_FACTOR_COOKIE",
  "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE",
])

export function TwoFactorForm() {
  const router = useRouter()
  const next = safeNext(useSearchParams().get("next"))
  const [method, setMethod] = useState<"totp" | "backup">("totp")
  const [error, setError] = useState<string | null>(null)
  const [expired, setExpired] = useState(false)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const code = String(form.get("code") ?? "").replace(/\s+/g, "")
    const trustDevice = form.get("trustDevice") === "on"
    setPending(true)
    setError(null)
    const { error: failure } =
      method === "totp"
        ? await authClient.twoFactor.verifyTotp({ code, trustDevice })
        : await authClient.twoFactor.verifyBackupCode({ code, trustDevice })
    if (failure) {
      setError(authErrorMessage(failure))
      setExpired(EXPIRED.has(failure.code ?? ""))
      setPending(false)
      return
    }
    router.replace(next)
    router.refresh()
  }

  return (
    <form method="post" onSubmit={onSubmit} className="flex flex-col gap-4">
      {error ? <FormError>{error}</FormError> : null}
      {expired ? (
        <Link
          href={`/admin/sign-in?next=${encodeURIComponent(next)}`}
          className={buttonClassName({ variant: "outline", size: "lg" })}
        >
          Back to sign in
        </Link>
      ) : (
        <>
          <div className="grid gap-2">
            <Label htmlFor="code">
              {method === "totp" ? "Authentication code" : "Backup code"}
            </Label>
            <Input
              key={method}
              id="code"
              name="code"
              required
              autoFocus
              autoComplete="one-time-code"
              {...(method === "totp"
                ? {
                    inputMode: "numeric" as const,
                    pattern: "[0-9 ]{6,7}",
                    maxLength: 7,
                    placeholder: "123456",
                  }
                : { maxLength: 32 })}
            />
            <p className="text-xs text-muted-foreground">
              {method === "totp"
                ? "Enter the 6-digit code from your authenticator app."
                : "Enter one of the backup codes you saved when you turned on two-factor authentication. Each code works once."}
            </p>
          </div>
          <label className="flex min-h-8 items-center gap-2 text-sm pointer-coarse:min-h-11">
            <Checkbox name="trustDevice" />
            Trust this device for 30 days
          </label>
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Checking…" : "Verify"}
          </Button>
          <button
            type="button"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            onClick={() => {
              setMethod(method === "totp" ? "backup" : "totp")
              setError(null)
            }}
          >
            {method === "totp"
              ? "Use a backup code instead"
              : "Use your authenticator app instead"}
          </button>
        </>
      )}
    </form>
  )
}
