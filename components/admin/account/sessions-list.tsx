"use client"

import { useCallback, useEffect, useState } from "react"

import { FormError, FormNotice } from "@/components/admin/auth/form-messages"
import { Button } from "@/components/ui/button"
import { authClient, authErrorMessage } from "@/lib/auth-client"
import { describeUserAgent, formatDateTime } from "@/lib/format"

type Session = {
  id: string
  token: string
  ipAddress?: string | null
  userAgent?: string | null
  createdAt: Date | string
}

export function SessionsList({
  currentSessionId,
}: {
  currentSessionId: string
}) {
  const [sessions, setSessions] = useState<Session[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error: failure } = await authClient.listSessions()
    if (failure) setError(authErrorMessage(failure))
    else setSessions(data as Session[])
  }, [])

  useEffect(() => {
    // Client-only list (it holds session tokens). Reloads when the current
    // session changes (enabling 2FA or a password change rotates it).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load, currentSessionId])

  async function revoke(session: Session) {
    setError(null)
    const { error: failure } = await authClient.revokeSession({
      token: session.token,
    })
    if (failure) return setError(authErrorMessage(failure))
    setNotice("Device signed out.")
    await load()
  }

  async function revokeOthers() {
    setError(null)
    const { error: failure } = await authClient.revokeOtherSessions()
    if (failure) return setError(authErrorMessage(failure))
    setNotice("All other devices are signed out.")
    await load()
  }

  if (!sessions)
    return error ? (
      <FormError>{error}</FormError>
    ) : (
      <p className="text-sm text-muted-foreground">Loading…</p>
    )

  const others = sessions.filter((s) => s.id !== currentSessionId)
  return (
    <div className="flex flex-col gap-4">
      {error ? <FormError>{error}</FormError> : null}
      {notice ? <FormNotice>{notice}</FormNotice> : null}
      <ul aria-label="Signed-in devices" className="divide-y rounded-lg border">
        {sessions.map((session) => (
          <li
            key={session.id}
            className="flex flex-wrap items-center justify-between gap-3 p-3"
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">
                {describeUserAgent(session.userAgent)}
                {session.id === currentSessionId ? (
                  <span className="ml-2 rounded bg-brand-mint px-1.5 py-0.5 text-xs text-brand-green-dark">
                    This device
                  </span>
                ) : null}
              </span>
              <span className="text-xs text-muted-foreground">
                {session.ipAddress ?? "Unknown IP"} · signed in{" "}
                {formatDateTime(new Date(session.createdAt))}
              </span>
            </div>
            {session.id !== currentSessionId ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => revoke(session)}
              >
                Sign out
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {others.length > 0 ? (
        <Button variant="outline" className="self-start" onClick={revokeOthers}>
          Sign out all other devices
        </Button>
      ) : null}
    </div>
  )
}
