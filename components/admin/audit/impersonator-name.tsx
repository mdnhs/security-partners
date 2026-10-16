"use client"

import { useQuery } from "@tanstack/react-query"

import { usePermission } from "@/hooks/use-permission"
import { api, unwrap } from "@/lib/api-client"

/**
 * The name behind an audit row's impersonatorId. Looked up per id (shared
 * with the user detail cache) when the viewer may read users; otherwise a
 * neutral "an admin", since the id alone means nothing to a reader.
 */
export function ImpersonatorName({ id }: { id: string }) {
  const canReadUsers = usePermission({ user: ["read"] })
  const user = useQuery({
    queryKey: ["users", "detail", id],
    queryFn: () => unwrap(api.users[":id"].$get({ param: { id } })),
    enabled: canReadUsers,
    staleTime: 5 * 60_000,
    retry: false,
  })
  return <>{user.data?.name ?? "an admin"}</>
}
