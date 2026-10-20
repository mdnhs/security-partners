"use client"

import { useRouter } from "next/navigation"
import QRCode from "qrcode"
import { useState } from "react"

import { FormError, FormNotice } from "@/components/admin/auth/form-messages"
import { ADMIN_CONTROL } from "@/components/admin/form/form-ui"
import { FORM_ACTION } from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authClient, authErrorMessage } from "@/lib/auth-client"
import { cn } from "@/lib/utils"

type Setup = {
  totpUri: string
  secret: string
  qr: string
  backupCodes: string[]
}

function BackupCodes({ codes }: { codes: string[] }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">
        Save these backup codes somewhere safe. Each one signs you in once if
        you lose your phone. They are shown only now.
      </p>
      <ul
        aria-label="Backup codes"
        className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-3 font-mono text-sm"
      >
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
    </div>
  )
}

export function TwoFactorSettings({ enabled }: { enabled: boolean }) {
  const router = useRouter()
  const [setup, setSetup] = useState<Setup | null>(null)
  const [codes, setCodes] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function start(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const password = String(
      new FormData(event.currentTarget).get("password") ?? ""
    )
    setPending(true)
    setError(null)
    const { data, error: failure } = await authClient.twoFactor.enable({
      password,
    })
    setPending(false)
    if (failure || !data || data.method !== "totp") {
      setError(authErrorMessage(failure))
      return
    }
    const secret = new URL(data.totpURI).searchParams.get("secret") ?? ""
    setSetup({
      totpUri: data.totpURI,
      secret,
      qr: await QRCode.toDataURL(data.totpURI, { margin: 1, width: 192 }),
      backupCodes: data.backupCodes,
    })
  }

  async function confirm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const code = String(
      new FormData(event.currentTarget).get("code") ?? ""
    ).replace(/\s+/g, "")
    setPending(true)
    setError(null)
    const { error: failure } = await authClient.twoFactor.verifyTotp({ code })
    setPending(false)
    if (failure) {
      setError(authErrorMessage(failure))
      return
    }
    setSetup(null)
    setNotice("Two-factor authentication turned on.")
    router.refresh()
  }

  async function manage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null
    const password = String(
      new FormData(event.currentTarget).get("password") ?? ""
    )
    setPending(true)
    setError(null)
    setNotice(null)
    if (submitter?.value === "disable") {
      const { error: failure } = await authClient.twoFactor.disable({
        password,
      })
      setPending(false)
      if (failure) return setError(authErrorMessage(failure))
      setCodes(null)
      setNotice("Two-factor authentication turned off.")
      router.refresh()
      return
    }
    const { data, error: failure } =
      await authClient.twoFactor.generateBackupCodes({ password })
    setPending(false)
    if (failure || !data) return setError(authErrorMessage(failure))
    setCodes(data.backupCodes)
  }

  const messages = (
    <>
      {error ? <FormError>{error}</FormError> : null}
      {notice ? <FormNotice>{notice}</FormNotice> : null}
    </>
  )

  if (setup)
    return (
      <div className="flex max-w-xl flex-col gap-4">
        {messages}
        <p className="text-sm">
          Scan this code with an authenticator app (Google Authenticator,
          1Password, Microsoft Authenticator…), then enter the 6-digit code it
          shows.
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element -- data: URL */}
        <img
          src={setup.qr}
          alt="QR code for your authenticator app"
          width={192}
          height={192}
          className="rounded-lg border bg-white"
        />
        <p className="text-sm">
          Can&apos;t scan? Enter this key instead:{" "}
          <code
            data-testid="totp-secret"
            className="rounded bg-muted px-1.5 py-0.5 font-mono break-all"
          >
            {setup.secret}
          </code>
        </p>
        <BackupCodes codes={setup.backupCodes} />
        <form onSubmit={confirm} className="flex flex-col gap-3">
          <div className="grid max-w-xs gap-2">
            <Label htmlFor="setup-code">Code from the app</Label>
            <Input
              className={ADMIN_CONTROL}
              id="setup-code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              required
            />
          </div>
          <div className="flex gap-2">
            <Button className={FORM_ACTION} type="submit" disabled={pending}>
              {pending ? "Checking…" : "Turn on"}
            </Button>
            <Button
              className={FORM_ACTION}
              type="button"
              variant="ghost"
              onClick={() => setSetup(null)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    )

  if (!enabled)
    return (
      <form onSubmit={start} className="flex max-w-md flex-col gap-4">
        {messages}
        <p className="text-sm">
          Two-factor authentication is <strong>off</strong>. Turn it on so a
          stolen password alone cannot open your account.
        </p>
        <div className="grid gap-2">
          <Label htmlFor="twofactor-enable-password">Your password</Label>
          <Input
            className={ADMIN_CONTROL}
            id="twofactor-enable-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <Button
          type="submit"
          disabled={pending}
          className={cn(FORM_ACTION, "self-start")}
        >
          {pending ? "Starting…" : "Set up two-factor authentication"}
        </Button>
      </form>
    )

  return (
    <form onSubmit={manage} className="flex max-w-md flex-col gap-4">
      {messages}
      <p className="text-sm">
        Two-factor authentication is <strong>on</strong>.
      </p>
      {codes ? <BackupCodes codes={codes} /> : null}
      <div className="grid gap-2">
        <Label htmlFor="twofactor-manage-password">Your password</Label>
        <Input
          className={ADMIN_CONTROL}
          id="twofactor-manage-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          className={FORM_ACTION}
          type="submit"
          name="intent"
          value="codes"
          variant="outline"
          disabled={pending}
        >
          New backup codes
        </Button>
        <Button
          className={FORM_ACTION}
          type="submit"
          name="intent"
          value="disable"
          variant="destructive"
          disabled={pending}
        >
          Turn off
        </Button>
      </div>
    </form>
  )
}
