"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { UserPlus } from "lucide-react"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import type { z } from "zod"

import { ADMIN_CONTROL } from "@/components/admin/form/form-ui"
import { FORM_ACTION, PRIMARY_ACTION } from "@/components/admin/page-header"
import {
  describedBy,
  FieldShell,
} from "@/components/admin/schema-form/widgets/field-shell"
import { useAdminSession } from "@/components/admin/session-provider"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { assignableRoles } from "@/lib/admin/user-roles"
import { api, ApiError, errorMessage, unwrap } from "@/lib/api-client"
import { inviteUserInput } from "@/lib/schemas/api/users"

import { CopyLink } from "./copy-link"
import { RolesField } from "./roles-field"
import type { InviteResult } from "./types"

type InviteFields = z.input<typeof inviteUserInput>
type InviteValues = z.output<typeof inviteUserInput>

const BLANK: InviteFields = { email: "", name: "", title: "", roles: [] }

/** "Invite user" button + dialog: create the account, then show the link. */
export function InviteUserDialog() {
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState<InviteResult | null>(null)
  return (
    <>
      <Button
        type="button"
        className={PRIMARY_ACTION}
        onClick={() => setOpen(true)}
      >
        <UserPlus aria-hidden data-icon="inline-start" />
        Invite user
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setResult(null)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          {result ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold">
                  Invitation created
                </DialogTitle>
                <DialogDescription>
                  {result.user.name} can choose a password with this link and
                  then sign in.
                </DialogDescription>
              </DialogHeader>
              <CopyLink
                id="invite-link"
                label="Invitation link"
                url={result.inviteUrl}
                emailDelivered={result.emailDelivered}
                email={result.user.email}
                expiry="in 7 days"
              />
              <DialogFooter>
                <Button
                  type="button"
                  className={FORM_ACTION}
                  onClick={() => {
                    setOpen(false)
                    setResult(null)
                  }}
                >
                  Done
                </Button>
              </DialogFooter>
            </>
          ) : (
            <InviteForm onCancel={() => setOpen(false)} onInvited={setResult} />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function InviteForm({
  onCancel,
  onInvited,
}: {
  onCancel: () => void
  onInvited: (result: InviteResult) => void
}) {
  const { roles: actorRoles } = useAdminSession()
  const queryClient = useQueryClient()
  const form = useForm<InviteFields, unknown, InviteValues>({
    resolver: zodResolver(inviteUserInput),
    defaultValues: BLANK,
    mode: "onTouched",
  })
  const { errors } = form.formState
  const invite = useMutation({
    mutationFn: (values: InviteValues) =>
      unwrap(
        api.users.invite.$post({
          // A blank title parses to null; the API treats "no title" the same.
          json: { ...values, title: values.title ?? undefined },
        })
      ),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["users"] })
      toast.success(`${result.user.name} invited`)
      onInvited(result)
    },
    onError: (error) => {
      if (error instanceof ApiError)
        for (const [path, messages] of Object.entries(error.fieldErrors))
          form.setError(path as keyof InviteFields, { message: messages[0] })
      if (error instanceof ApiError && error.isConflict)
        form.setError("email", { message: error.message })
      toast.error("Not invited", { description: errorMessage(error) })
    },
  })

  const emailError = errors.email?.message
  const nameError = errors.name?.message
  const titleHelp = "Shown under their name on articles they write."
  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={form.handleSubmit((values) => invite.mutate(values))}
    >
      <DialogHeader>
        <DialogTitle className="text-lg font-semibold">Invite user</DialogTitle>
        <DialogDescription>
          They get a link to choose a password. Nobody can sign up on their own.
        </DialogDescription>
      </DialogHeader>
      <FieldShell id="invite-email" label="Email" error={emailError}>
        <Input
          id="invite-email"
          type="email"
          autoComplete="off"
          className={ADMIN_CONTROL}
          aria-required
          aria-invalid={emailError ? true : undefined}
          aria-describedby={describedBy("invite-email", { error: emailError })}
          {...form.register("email")}
        />
      </FieldShell>
      <FieldShell id="invite-name" label="Name" error={nameError}>
        <Input
          id="invite-name"
          autoComplete="off"
          className={ADMIN_CONTROL}
          aria-required
          aria-invalid={nameError ? true : undefined}
          aria-describedby={describedBy("invite-name", { error: nameError })}
          {...form.register("name")}
        />
      </FieldShell>
      <FieldShell id="invite-title" label="Job title" optional help={titleHelp}>
        <Input
          id="invite-title"
          autoComplete="off"
          className={ADMIN_CONTROL}
          aria-describedby={describedBy("invite-title", { help: titleHelp })}
          {...form.register("title")}
        />
      </FieldShell>
      <Controller
        control={form.control}
        name="roles"
        render={({ field, fieldState }) => (
          <RolesField
            id="invite-roles"
            options={assignableRoles(actorRoles)}
            value={field.value}
            onChange={field.onChange}
            error={fieldState.error?.message}
          />
        )}
      />
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          className={FORM_ACTION}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className={FORM_ACTION}
          disabled={invite.isPending}
        >
          Send invitation
        </Button>
      </DialogFooter>
    </form>
  )
}
