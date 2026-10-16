"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { FormError, FormNotice } from "@/components/admin/auth/form-messages"
import { ADMIN_CONTROL } from "@/components/admin/form/form-ui"
import { FORM_ACTION } from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authClient, authErrorMessage } from "@/lib/auth-client"
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth/password"
import { cn } from "@/lib/utils"

export function ChangePasswordForm() {
  const router = useRouter()
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(
    null
  )
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const currentPassword = String(form.get("currentPassword") ?? "")
    const newPassword = String(form.get("newPassword") ?? "")
    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      setStatus({
        ok: false,
        message: `Use at least ${PASSWORD_MIN_LENGTH} characters.`,
      })
      return
    }
    if (newPassword !== form.get("confirm")) {
      setStatus({ ok: false, message: "The two new passwords do not match." })
      return
    }
    setPending(true)
    const { error } = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    })
    setPending(false)
    if (error) {
      setStatus({ ok: false, message: authErrorMessage(error) })
      return
    }
    formElement.reset()
    setStatus({
      ok: true,
      message: "Password changed. Your other devices are signed out.",
    })
    // The change rotates this device's session: re-read it for the device list.
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-4">
      {status ? (
        status.ok ? (
          <FormNotice>{status.message}</FormNotice>
        ) : (
          <FormError>{status.message}</FormError>
        )
      ) : null}
      <div className="grid gap-2">
        <Label htmlFor="current-password">Current password</Label>
        <Input
          className={ADMIN_CONTROL}
          id="current-password"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="new-password">New password</Label>
        <Input
          className={ADMIN_CONTROL}
          id="new-password"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          maxLength={PASSWORD_MAX_LENGTH}
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="confirm-password">Repeat new password</Label>
        <Input
          className={ADMIN_CONTROL}
          id="confirm-password"
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          maxLength={PASSWORD_MAX_LENGTH}
          required
        />
      </div>
      <Button
        type="submit"
        disabled={pending}
        className={cn(FORM_ACTION, "self-start")}
      >
        {pending ? "Changing…" : "Change password"}
      </Button>
    </form>
  )
}
