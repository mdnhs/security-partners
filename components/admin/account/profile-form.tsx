"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { FormError, FormNotice } from "@/components/admin/auth/form-messages"
import {
  formChanged,
  UnsavedGuard,
} from "@/components/admin/editor/unsaved-guard"
import { ADMIN_CONTROL } from "@/components/admin/form/form-ui"
import { FORM_ACTION } from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authClient, authErrorMessage } from "@/lib/auth-client"
import { cn } from "@/lib/utils"

export function ProfileForm({
  name,
  email,
  title,
}: {
  name: string
  email: string
  title: string | null
}) {
  const router = useRouter()
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(
    null
  )
  const [pending, setPending] = useState(false)
  const [dirty, setDirty] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const nextName = String(form.get("name") ?? "").trim()
    const nextTitle = String(form.get("title") ?? "").trim()
    if (!nextName) {
      setStatus({ ok: false, message: "Enter your name." })
      return
    }
    setPending(true)
    const { error } = await authClient.updateUser({
      name: nextName,
      title: nextTitle || null,
    })
    setPending(false)
    if (error) {
      setStatus({ ok: false, message: authErrorMessage(error) })
      return
    }
    setStatus({ ok: true, message: "Profile saved." })
    setDirty(false)
    router.refresh()
  }

  return (
    <form
      onSubmit={onSubmit}
      onInput={(event) => setDirty(formChanged(event.currentTarget))}
      onChange={(event) => setDirty(formChanged(event.currentTarget))}
      className="flex max-w-md flex-col gap-4"
    >
      <UnsavedGuard when={dirty} />
      {status ? (
        status.ok ? (
          <FormNotice>{status.message}</FormNotice>
        ) : (
          <FormError>{status.message}</FormError>
        )
      ) : null}
      <div className="grid gap-2">
        <Label htmlFor="profile-email">Email</Label>
        <Input
          className={ADMIN_CONTROL}
          id="profile-email"
          value={email}
          disabled
          readOnly
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="profile-name">Name</Label>
        <Input
          className={ADMIN_CONTROL}
          id="profile-name"
          name="name"
          defaultValue={name}
          maxLength={100}
          autoComplete="name"
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="profile-title">Job title</Label>
        <Input
          className={ADMIN_CONTROL}
          id="profile-title"
          name="title"
          defaultValue={title ?? ""}
          maxLength={100}
          aria-describedby="profile-title-hint"
        />
        <p id="profile-title-hint" className="text-xs text-muted-foreground">
          Shown as the byline role on articles you write.
        </p>
      </div>
      <Button
        type="submit"
        disabled={pending}
        className={cn(FORM_ACTION, "self-start")}
      >
        {pending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  )
}
