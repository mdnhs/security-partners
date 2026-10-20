"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import { FormCard } from "@/components/admin/form/form-ui"
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
import { usePermission } from "@/hooks/use-permission"
import { api, errorMessage, unwrap } from "@/lib/api-client"
import type { SubscriberLookup } from "@/lib/schemas/api/newsletter"

/**
 * The lead page's privacy helper (subject access / erasure by email): next
 * to "Export this person's data", whether the same address is also on the
 * newsletter list, and for newsletter:delete an erase action. Nothing is
 * shown (or asked) without newsletter:read.
 */
export function NewsletterPrivacy({ email }: { email: string }) {
  const canRead = usePermission({ newsletter: ["read"] })
  if (!canRead) return null
  return <Lookup email={email} />
}

function Lookup({ email }: { email: string }) {
  const queryClient = useQueryClient()
  const canErase = usePermission({ newsletter: ["delete"] })
  const [confirming, setConfirming] = useState(false)
  // Only on request: each lookup is audited (newsletter.looked_up), so
  // opening a lead never checks (or logs) the address by itself.
  const [requested, setRequested] = useState(false)
  const key = ["newsletter", "lookup", email] as const
  const lookup = useQuery({
    queryKey: key,
    enabled: requested,
    // POST: the address stays out of URLs and access logs.
    queryFn: async () =>
      (await unwrap(
        api.newsletter.lookup.$post({ json: { email } })
      )) as SubscriberLookup,
  })
  const erase = useMutation({
    mutationFn: async () =>
      unwrap(api.newsletter.erase.$post({ json: { email } })),
    onSuccess: () => {
      setConfirming(false)
      queryClient.setQueryData<SubscriberLookup>(key, { subscriber: null })
      void queryClient.invalidateQueries({ queryKey: ["newsletter"] })
      toast.success("Erased from the newsletter")
    },
    onError: (error) => {
      setConfirming(false)
      toast.error("Not erased", { description: errorMessage(error) })
    },
  })

  const subscribed = lookup.data ? lookup.data.subscriber !== null : null
  return (
    <FormCard
      id="lead-newsletter"
      title="Newsletter"
      description="For privacy requests: the same address on the mailing list."
      aria-busy={
        (requested && lookup.isPending) || erase.isPending || undefined
      }
    >
      {!requested ? (
        <Button
          type="button"
          variant="outline"
          // 44 px on touch, like the rest of the admin's controls.
          className="self-start pointer-coarse:h-11 pointer-coarse:min-w-11"
          onClick={() => setRequested(true)}
        >
          Check the newsletter list
        </Button>
      ) : lookup.isError ? (
        <p role="alert" className="text-sm text-destructive">
          Could not check the newsletter list: {errorMessage(lookup.error)}
        </p>
      ) : subscribed === null ? (
        <p role="status" className="text-sm text-muted-foreground">
          Checking the newsletter list…
        </p>
      ) : (
        <p role="status" className="text-sm">
          {`Also on the newsletter list: ${subscribed ? "Yes" : "No"}`}
        </p>
      )}
      {subscribed && canErase ? (
        <Button
          type="button"
          variant="outline"
          // 44 px on touch, like the rest of the admin's controls.
          className="self-start pointer-coarse:h-11 pointer-coarse:min-w-11"
          onClick={() => setConfirming(true)}
        >
          Erase from newsletter
        </Button>
      ) : null}
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Erase from the newsletter?</AlertDialogTitle>
            <AlertDialogDescription>
              {email} is deleted from the newsletter list. The enquiry is kept.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              disabled={erase.isPending}
              onClick={() => erase.mutate()}
            >
              Erase
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </FormCard>
  )
}
