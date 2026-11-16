"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Globe } from "lucide-react"
import Link from "next/link"
import { useId, useState } from "react"
import { toast } from "sonner"

import { OptionSelect } from "@/components/admin/option-select"
import { FORM_ACTION } from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"
import { usePermission } from "@/hooks/use-permission"
import { api, errorMessage, unwrap } from "@/lib/api-client"
import type { PreferredHost } from "@/lib/schemas/settings/seo-defaults"

export const PREFERRED_ADDRESS_KEY = ["seo", "preferred-address"] as const

/** The three choices, with this site's real addresses in them. */
export function preferredOptions(siteHost: string | null) {
  const host = siteHost ?? "example.ie"
  return [
    { value: "off", label: "Off: keep all four addresses working" },
    { value: "apex", label: `Without www: https://${host}` },
    { value: "www", label: `With www: https://www.${host}` },
  ] as const satisfies readonly { value: PreferredHost; label: string }[]
}

/**
 * SEO › Canonical URLs: the site's main address (VANTAGE "Preferred
 * address"). http://, https://, with and without www are four addresses to
 * Google; the chosen one stays and the other three 301 to it. Saved live;
 * the redirect starts within a minute.
 */
export function PreferredAddressCard() {
  const canUpdate = usePermission({ seo: ["update"] })
  const queryClient = useQueryClient()
  const selectId = useId()
  const query = useQuery({
    queryKey: PREFERRED_ADDRESS_KEY,
    queryFn: () => unwrap(api.seo["preferred-address"].$get()),
  })
  const [choice, setChoice] = useState<PreferredHost | null>(null)
  const saved = query.data?.preferredHost ?? "off"
  const value = choice ?? saved
  const siteHost = query.data?.siteHost ?? null
  const save = useMutation({
    mutationFn: (preferredHost: PreferredHost) =>
      unwrap(api.seo["preferred-address"].$put({ json: { preferredHost } })),
    onSuccess: (data) => {
      queryClient.setQueryData(PREFERRED_ADDRESS_KEY, data)
      setChoice(null)
      toast.success("Preferred address saved", {
        description:
          data.preferredHost === "off"
            ? "All four addresses keep working."
            : "The other addresses redirect to it within a minute.",
      })
    },
    onError: (error) =>
      toast.error("Not saved", { description: errorMessage(error) }),
  })
  const noHost = query.isSuccess && !siteHost

  return (
    <section
      aria-labelledby={`${selectId}-title`}
      className="rounded-card flex flex-col overflow-hidden border bg-card"
    >
      <header className="flex items-start gap-3 border-b p-4 sm:p-5">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
        >
          <Globe className="size-4.5" />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id={`${selectId}-title`} className="font-semibold">
            Preferred address
          </h2>
          <p className="text-sm text-muted-foreground">
            http://, https://, with and without www are four addresses to
            Google. Pick the main one; the other three redirect to it (301).
          </p>
        </div>
      </header>
      <div className="flex flex-col gap-3 p-4 sm:p-5">
        <label htmlFor={selectId} className="text-sm font-medium">
          Main address
        </label>
        <OptionSelect
          id={selectId}
          value={value}
          onChange={(next) => setChoice(next as PreferredHost)}
          options={preferredOptions(siteHost)}
          disabled={!canUpdate || query.isPending || noHost}
          aria-describedby={`${selectId}-hint`}
          className="w-full sm:max-w-md"
        />
        <p id={`${selectId}-hint`} className="text-xs text-muted-foreground">
          {noHost ? (
            <>
              Set the site&apos;s production URL first, under{" "}
              <Link
                href="/admin/settings/site"
                className="underline underline-offset-2"
              >
                Settings › Site
              </Link>
              .
            </>
          ) : (
            "Make sure the site's certificate covers both with and without www before choosing one. Takes effect within a minute."
          )}
        </p>
        {query.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(query.error)}
          </p>
        ) : null}
        {canUpdate ? (
          <div>
            <Button
              type="button"
              className={FORM_ACTION}
              disabled={value === saved || save.isPending || noHost}
              onClick={() => save.mutate(value)}
            >
              Save
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  )
}
