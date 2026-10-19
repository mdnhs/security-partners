"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { ArrowLeft, Eye, LockKeyhole, UserX } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import {
  ADMIN_CONTROL,
  ADMIN_TEXTAREA,
  FormCard,
} from "@/components/admin/form/form-ui"
import { useListHref } from "@/components/admin/data-table/list-url"
import { UnsavedGuard } from "@/components/admin/editor/unsaved-guard"
import { EmptyState } from "@/components/admin/kit/empty-state"
import { CardSkeleton } from "@/components/admin/kit/skeletons"
import { OptionSelect } from "@/components/admin/option-select"
import { StatusPill } from "@/components/admin/kit/status-pill"
import {
  FORM_ACTION,
  LINK_FORM,
  PageHeader,
  SECONDARY_ACTION,
} from "@/components/admin/page-header"
import {
  describedBy,
  FieldShell,
} from "@/components/admin/schema-form/widgets/field-shell"
import {
  SectionTabs,
  SectionTabsPanel,
} from "@/components/admin/section-tabs/section-tabs"
import { useAdminSession } from "@/components/admin/session-provider"
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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { usePermission } from "@/hooks/use-permission"
import {
  assignableRoles,
  mayManageUser,
  roleLabels,
} from "@/lib/admin/user-roles"
import { api, ApiError, errorMessage, unwrap } from "@/lib/api-client"
import type { Role } from "@/lib/auth/roles"
import { describeUserAgent, formatDateTime } from "@/lib/format"
import { banUserInput } from "@/lib/schemas/api/users"
import { cn } from "@/lib/utils"

import { CopyLink } from "./copy-link"
import { RolesField } from "./roles-field"
import type { PasswordLinkResult, UserItem, UserSessionItem } from "./types"
import { RoleBadges, TwoFactorIndicator, UserStatusPill } from "./user-badges"

const userKey = (id: string) => ["users", "detail", id] as const

const fetchUser = (id: string) =>
  unwrap(api.users[":id"].$get({ param: { id } }))

/** Puts a fresh user into the cache; refetches lists and sessions. */
async function storeUser(queryClient: QueryClient, user: UserItem) {
  queryClient.setQueryData(userKey(user.id), user)
  await queryClient.invalidateQueries({
    queryKey: ["users"],
    predicate: (q) => q.queryKey[1] !== "detail",
  })
}

/**
 * One user (spec §8.1 Users): profile, roles, access (ban), password link
 * and sessions as section tabs, plus "View as" in the header. Controls
 * follow usePermission and the owner rule; the API enforces both again.
 */
export function UserDetail({ id }: { id: string }) {
  const session = useAdminSession()
  const canUpdate = usePermission({ user: ["update"] })
  const canBan = usePermission({ user: ["ban"] })
  // "All users" returns to the list as it was left (filters, page, search).
  const listHref = useListHref("/admin/users")
  const query = useQuery({
    queryKey: userKey(id),
    queryFn: () => fetchUser(id),
  })

  if (query.isPending)
    return (
      <div role="status">
        <span className="sr-only">Loading user…</span>
        <CardSkeleton className="h-24" />
      </div>
    )
  if (query.isError)
    return (
      <EmptyState
        role="alert"
        icon={UserX}
        title={
          query.error instanceof ApiError && query.error.status === 404
            ? "This user does not exist"
            : "The user didn't load"
        }
        description={
          query.error instanceof ApiError && query.error.status === 404
            ? "They may have been removed, or the link is wrong."
            : errorMessage(query.error)
        }
        action={
          <Link href={listHref} className={LINK_FORM}>
            All users
          </Link>
        }
      />
    )

  const user = query.data
  const isSelf = user.id === session.user.id
  const manageable = mayManageUser(session.roles, user.roles)
  const tabs = [
    { id: "profile", label: "Profile" },
    { id: "roles", label: "Roles" },
    ...(canBan ? [{ id: "access", label: "Access" }] : []),
    ...(canUpdate ? [{ id: "password", label: "Password" }] : []),
    { id: "sessions", label: "Sessions" },
  ]
  return (
    <>
      <PageHeader
        breadcrumbs={
          <Link
            href={listHref}
            className="inline-flex w-fit items-center gap-1 rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <ArrowLeft aria-hidden className="size-4" />
            All users
          </Link>
        }
        title={user.name}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span>{user.email}</span>
            <UserStatusPill status={user.status} />
            <TwoFactorIndicator enabled={user.twoFactorEnabled} />
            <RoleBadges roles={user.roles} />
          </span>
        }
        actions={
          manageable && !isSelf && !session.impersonatedBy ? (
            <ViewAsButton user={user} />
          ) : null
        }
      />
      {manageable ? (
        <SectionTabs ariaLabel="User sections" heading="User" items={tabs}>
          <SectionTabsPanel id="profile">
            <ProfileSection user={user} canUpdate={canUpdate} />
          </SectionTabsPanel>
          <SectionTabsPanel id="roles">
            <RolesSection user={user} canUpdate={canUpdate} />
          </SectionTabsPanel>
          {canBan ? (
            <SectionTabsPanel id="access">
              <AccessSection user={user} isSelf={isSelf} />
            </SectionTabsPanel>
          ) : null}
          {canUpdate ? (
            <SectionTabsPanel id="password">
              <PasswordLinkSection user={user} />
            </SectionTabsPanel>
          ) : null}
          <SectionTabsPanel id="sessions">
            <SessionsSection user={user} />
          </SectionTabsPanel>
        </SectionTabs>
      ) : (
        <div
          role="note"
          className="rounded-card flex items-start gap-3 bg-card p-5 text-sm sm:p-6"
        >
          <LockKeyhole aria-hidden className="mt-0.5 size-4 shrink-0" />
          <div className="flex flex-col gap-1">
            <p className="font-semibold">
              Only an owner can change an owner&apos;s account.
            </p>
            <p className="text-muted-foreground">
              Roles: {roleLabels(user.roles)} · Added{" "}
              {formatDateTime(user.createdAt)}
            </p>
          </div>
        </div>
      )}
    </>
  )
}

const profileForm = z.object({
  name: z.string().trim().min(1, "Required").max(100),
  title: z.string().trim().max(100),
})

function ProfileSection({
  user,
  canUpdate,
}: {
  user: UserItem
  canUpdate: boolean
}) {
  const queryClient = useQueryClient()
  const form = useForm<
    z.input<typeof profileForm>,
    unknown,
    z.output<typeof profileForm>
  >({
    resolver: zodResolver(profileForm),
    defaultValues: { name: user.name, title: user.title ?? "" },
  })
  const { errors } = form.formState
  const save = useMutation({
    mutationFn: (values: z.output<typeof profileForm>) =>
      unwrap(
        api.users[":id"].$patch({
          param: { id: user.id },
          json: { name: values.name, title: values.title },
        })
      ),
    onSuccess: async (saved) => {
      await storeUser(queryClient, saved)
      form.reset({ name: saved.name, title: saved.title ?? "" })
      toast.success("Profile saved")
    },
    onError: (error) => {
      if (error instanceof ApiError)
        for (const [path, messages] of Object.entries(error.fieldErrors))
          if (path === "name" || path === "title")
            form.setError(path, { message: messages[0] })
      toast.error("Not saved", { description: errorMessage(error) })
    },
  })
  const nameError = errors.name?.message
  const titleError = errors.title?.message
  const titleHelp = "Shown under their name on articles they write."
  return (
    <FormCard
      id="user-profile"
      title="Profile"
      description="Name and job title as shown on articles."
    >
      <UnsavedGuard when={form.formState.isDirty} />
      <form
        noValidate
        className="flex max-w-md flex-col gap-5"
        onSubmit={form.handleSubmit((values) => save.mutate(values))}
      >
        <FieldShell id="user-name" label="Name" error={nameError}>
          <Input
            id="user-name"
            className={ADMIN_CONTROL}
            disabled={!canUpdate}
            aria-required
            aria-invalid={nameError ? true : undefined}
            aria-describedby={describedBy("user-name", { error: nameError })}
            {...form.register("name")}
          />
        </FieldShell>
        <FieldShell
          id="user-title"
          label="Job title"
          optional
          help={titleHelp}
          error={titleError}
        >
          <Input
            id="user-title"
            className={ADMIN_CONTROL}
            disabled={!canUpdate}
            aria-invalid={titleError ? true : undefined}
            aria-describedby={describedBy("user-title", {
              help: titleHelp,
              error: titleError,
            })}
            {...form.register("title")}
          />
        </FieldShell>
        {canUpdate ? (
          <Button
            type="submit"
            className={cn(FORM_ACTION, "self-start")}
            disabled={save.isPending || !form.formState.isDirty}
          >
            Save profile
          </Button>
        ) : null}
      </form>
    </FormCard>
  )
}

/** The roles whose loss would lock the signed-in user out of this screen. */
const ADMINISTRATIVE: readonly Role[] = ["owner", "admin"]

function RolesSection({
  user,
  canUpdate,
}: {
  user: UserItem
  canUpdate: boolean
}) {
  const { roles: actorRoles, user: me } = useAdminSession()
  const queryClient = useQueryClient()
  const [roles, setRoles] = useState<Role[]>(user.roles)
  const [error, setError] = useState<string | undefined>()
  const [confirming, setConfirming] = useState(false)
  const changed =
    roles.length !== user.roles.length ||
    roles.some((role) => !user.roles.includes(role))
  // Lock-out: you hold an administrative role now and the new set keeps
  // none (an owner dropping only "admin" still manages users). Saving would
  // shut you out of Users; only another owner/admin could let you back in.
  const isAdministrative = (role: Role) => ADMINISTRATIVE.includes(role)
  const lockOut =
    user.id === me.id &&
    user.roles.some(isAdministrative) &&
    !roles.some(isAdministrative)
  const dropping = lockOut ? user.roles.filter(isAdministrative) : []
  const save = useMutation({
    mutationFn: () =>
      unwrap(
        api.users[":id"].roles.$put({ param: { id: user.id }, json: { roles } })
      ),
    onSuccess: async (saved) => {
      setConfirming(false)
      await storeUser(queryClient, saved)
      setRoles(saved.roles)
      toast.success("Roles saved", {
        description: "They apply on the user's next page load.",
      })
    },
    onError: (err) => {
      setConfirming(false)
      setError(err instanceof ApiError ? err.fieldErrors.roles?.[0] : undefined)
      toast.error("Roles not saved", { description: errorMessage(err) })
    },
  })
  return (
    <FormCard
      id="user-roles"
      title="Roles"
      description="What this user may see and change. They get everything any chosen role allows."
    >
      <UnsavedGuard when={canUpdate && changed} />
      <RolesField
        id="user-roles"
        options={assignableRoles(actorRoles)}
        value={roles}
        onChange={(next) => {
          setRoles(next)
          setError(next.length === 0 ? "Choose at least one role" : undefined)
        }}
        error={error}
        disabled={!canUpdate}
      />
      {canUpdate ? (
        <Button
          type="button"
          className={cn(FORM_ACTION, "self-start")}
          disabled={!changed || roles.length === 0 || save.isPending}
          onClick={() => (lockOut ? setConfirming(true) : save.mutate())}
        >
          Save roles
        </Button>
      ) : null}
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove your own {roleLabels(dropping)}{" "}
              {dropping.length > 1 ? "roles" : "role"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You would lose access to Users and the audit log as soon as this
              page reloads, and only another owner or admin could give the role
              back. Make sure someone else can still manage the admin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep my roles</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              disabled={save.isPending}
              onClick={() => save.mutate()}
            >
              Remove {dropping.length > 1 ? "roles" : "role"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </FormCard>
  )
}

const BAN_DURATIONS = [
  { value: "", label: "Until unbanned" },
  { value: "1", label: "1 day" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
] as const

function AccessSection({ user, isSelf }: { user: UserItem; isSelf: boolean }) {
  const queryClient = useQueryClient()
  const [reason, setReason] = useState("")
  const [days, setDays] = useState("")
  const [confirming, setConfirming] = useState(false)
  const ban = useMutation({
    mutationFn: () =>
      unwrap(
        api.users[":id"].ban.$post({
          param: { id: user.id },
          json: banUserInput.parse({
            reason: reason.trim() || undefined,
            expiresInDays: days ? Number(days) : undefined,
          }),
        })
      ),
    onSuccess: async (saved) => {
      setConfirming(false)
      setReason("")
      setDays("")
      await storeUser(queryClient, saved)
      toast.success(`${user.name} is banned`, {
        description: "They were signed out everywhere.",
      })
    },
    onError: (error) => {
      setConfirming(false)
      toast.error("Not banned", { description: errorMessage(error) })
    },
  })
  const unban = useMutation({
    mutationFn: () =>
      unwrap(api.users[":id"].ban.$delete({ param: { id: user.id } })),
    onSuccess: async (saved) => {
      await storeUser(queryClient, saved)
      toast.success(`${user.name} can sign in again`)
    },
    onError: (error) =>
      toast.error("Not unbanned", { description: errorMessage(error) }),
  })
  const reasonHelp = "Kept in the audit log."
  return (
    <FormCard
      id="user-access"
      title="Access"
      description="A banned user is signed out everywhere and cannot sign in."
    >
      <UnsavedGuard
        when={
          user.status !== "banned" &&
          !isSelf &&
          (reason.trim() !== "" || days !== "")
        }
      />
      {user.status === "banned" ? (
        <div className="flex flex-col items-start gap-4">
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <StatusPill tone="danger">Banned</StatusPill>
            <span>
              {user.banExpires
                ? `Until ${formatDateTime(user.banExpires)}`
                : "Until someone unbans them"}
              {user.banReason ? ` — “${user.banReason}”` : ""}
            </span>
          </p>
          <Button
            type="button"
            variant="outline"
            className={FORM_ACTION}
            disabled={unban.isPending}
            onClick={() => unban.mutate()}
          >
            Unban
          </Button>
        </div>
      ) : isSelf ? (
        <p className="text-sm text-muted-foreground">
          You cannot ban your own account.
        </p>
      ) : (
        <div className="flex max-w-md flex-col gap-5">
          <FieldShell id="ban-reason" label="Reason" optional help={reasonHelp}>
            <Textarea
              id="ban-reason"
              className={ADMIN_TEXTAREA}
              maxLength={200}
              value={reason}
              aria-describedby={describedBy("ban-reason", { help: reasonHelp })}
              onChange={(event) => setReason(event.target.value)}
            />
          </FieldShell>
          <FieldShell id="ban-duration" label="Duration">
            <OptionSelect
              id="ban-duration"
              value={days}
              onChange={setDays}
              options={BAN_DURATIONS}
              className="w-48"
            />
          </FieldShell>
          <Button
            type="button"
            variant="destructive"
            className={cn(FORM_ACTION, "self-start")}
            onClick={() => setConfirming(true)}
          >
            Ban user
          </Button>
        </div>
      )}
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ban {user.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They are signed out on every device and cannot sign in{" "}
              {days
                ? `for ${days} ${days === "1" ? "day" : "days"}`
                : "until you unban them"}
              .
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              disabled={ban.isPending}
              onClick={() => ban.mutate()}
            >
              Ban
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </FormCard>
  )
}

function PasswordLinkSection({ user }: { user: UserItem }) {
  const [link, setLink] = useState<PasswordLinkResult | null>(null)
  const create = useMutation({
    mutationFn: () =>
      unwrap(
        api.users[":id"]["password-link"].$post({ param: { id: user.id } })
      ),
    onSuccess: setLink,
    onError: (error) =>
      toast.error("No link created", { description: errorMessage(error) }),
  })
  const invited = user.status === "invited"
  return (
    <FormCard
      id="user-password-link"
      title={invited ? "Invitation link" : "Password reset"}
      description={
        invited
          ? "Send a fresh invitation link if the first one expired or got lost."
          : "Create a link that lets this user choose a new password."
      }
    >
      {link ? (
        <CopyLink
          id="password-link-url"
          label={invited ? "Invitation link" : "Password reset link"}
          url={link.url}
          emailDelivered={link.emailDelivered}
          email={user.email}
          expiry="in 24 hours"
        />
      ) : null}
      {user.status === "banned" ? (
        <p className="text-sm text-muted-foreground">
          Unban this user before sending a password link.
        </p>
      ) : (
        <Button
          type="button"
          variant="outline"
          className={cn(FORM_ACTION, "self-start")}
          disabled={create.isPending}
          onClick={() => create.mutate()}
        >
          {link
            ? "Create another link"
            : invited
              ? "Create invitation link"
              : "Create password reset link"}
        </Button>
      )}
    </FormCard>
  )
}

function SessionsSection({ user }: { user: UserItem }) {
  const canRevoke = usePermission({ user: ["revokeSessions"] })
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)
  const sessionsKey = ["users", "sessions", user.id] as const
  const sessions = useQuery({
    queryKey: sessionsKey,
    queryFn: async () =>
      (await unwrap(api.users[":id"].sessions.$get({ param: { id: user.id } })))
        .items,
  })
  const revoke = useMutation({
    mutationFn: () =>
      unwrap(api.users[":id"].sessions.$delete({ param: { id: user.id } })),
    onSuccess: async ({ revoked }) => {
      setConfirming(false)
      await queryClient.invalidateQueries({ queryKey: sessionsKey })
      toast.success(
        revoked === 1
          ? "1 session signed out"
          : `${revoked} sessions signed out`
      )
    },
    onError: (error) => {
      setConfirming(false)
      toast.error("Not signed out", { description: errorMessage(error) })
    },
  })
  const items: UserSessionItem[] = sessions.data ?? []
  return (
    <FormCard
      id="user-sessions"
      title="Sessions"
      description="Devices where this user is signed in."
    >
      {sessions.isPending ? (
        <CardSkeleton className="h-16" />
      ) : sessions.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(sessions.error)}
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Not signed in anywhere.</p>
      ) : (
        <ul
          aria-label="Sessions"
          className="divide-y rounded-xl border bg-background"
        >
          {items.map((s) => (
            <li key={s.id} className="flex flex-col gap-0.5 p-3">
              <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                {describeUserAgent(s.userAgent)}
                {s.impersonatedBy ? (
                  <StatusPill tone="info" className="h-6">
                    View as session
                  </StatusPill>
                ) : null}
              </span>
              <span className="text-xs text-muted-foreground">
                {s.ipAddress ?? "Unknown IP"} · signed in{" "}
                {formatDateTime(s.createdAt)} · expires{" "}
                {formatDateTime(s.expiresAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {canRevoke && items.length > 0 ? (
        <Button
          type="button"
          variant="outline"
          className={cn(FORM_ACTION, "self-start")}
          onClick={() => setConfirming(true)}
        >
          Sign out everywhere
        </Button>
      ) : null}
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Sign {user.name} out everywhere?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Every session ends now. They can sign in again with their
              password.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              disabled={revoke.isPending}
              onClick={() => revoke.mutate()}
            >
              Sign out everywhere
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </FormCard>
  )
}

/** "View as" (spec §6): confirm, start impersonation, reload the admin as them. */
function ViewAsButton({ user }: { user: UserItem }) {
  const canImpersonate = usePermission({ user: ["impersonate"] })
  const queryClient = useQueryClient()
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const start = useMutation({
    mutationFn: () =>
      unwrap(api.users[":id"].impersonate.$post({ param: { id: user.id } })),
    onSuccess: () => {
      // Every cached query belongs to the real user, not the viewed one.
      queryClient.clear()
      router.replace("/admin")
      router.refresh()
    },
    onError: (error) => {
      setConfirming(false)
      toast.error("Could not view as this user", {
        description: errorMessage(error),
      })
    },
  })
  if (!canImpersonate || user.status === "banned") return null
  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={SECONDARY_ACTION}
        onClick={() => setConfirming(true)}
      >
        <Eye aria-hidden />
        View as
      </Button>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>View the admin as {user.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              For up to one hour you see and can do exactly what {user.name}{" "}
              can. Changes are recorded as {user.name}, with you as the
              impersonator. Stop any time from the banner at the top.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              disabled={start.isPending}
              onClick={() => start.mutate()}
            >
              Start viewing
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
