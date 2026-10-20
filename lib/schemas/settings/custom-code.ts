import { z } from "zod"

/**
 * settings.customCode — owner-only snippets (D2.3). Each snippet is either a
 * script URL on an allowed host or an HTML block, scoped to a placement,
 * routes and a consent category. `disabled` is the kill switch (also set by
 * `pnpm custom-code:off`): when on, nothing runs.
 */
export const SNIPPET_CATEGORIES = [
  "necessary",
  "analytics",
  "marketing",
] as const
export type SnippetCategory = (typeof SNIPPET_CATEGORIES)[number]

export const routePattern = z
  .string()
  .trim()
  .max(120)
  .regex(/^\/[\w\-/]*\*?$/, 'Use a path like "/" or "/blog/*"')
  // The regex allows "/blog*", which routeMatches would treat as a literal
  // path that never matches: a section is always "/blog/*".
  .refine((p) => !p.endsWith("*") || p.endsWith("/*"), {
    message: 'Use "/blog/*" for a section: "*" must follow "/"',
  })
  .refine((p) => !p.includes("//"), { message: 'Remove the double "/"' })

/**
 * A snippet's id. SchemaForm gives this schema (by identity, like mediaRef)
 * a fresh uuid when a snippet is added: the field is hidden, so it could
 * never be filled in (components/admin/schema-form/empty-value.ts).
 */
export const snippetId = z.uuid()

/** A bare DNS host name with at least one dot: no scheme, port, path or wildcard. */
export const hostname = z
  .string()
  .trim()
  .toLowerCase()
  .max(253)
  .regex(
    /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/,
    "Use a host name like cdn.example.com"
  )

export const snippet = z.object({
  id: snippetId,
  name: z.string().trim().min(1).max(60),
  placement: z.enum(["head", "body"]),
  src: z.string().trim().max(500),
  html: z.string().max(20_000),
  category: z.enum(SNIPPET_CATEGORIES),
  routes: z.array(routePattern).max(20),
  enabled: z.boolean(),
})
export type Snippet = z.infer<typeof snippet>

/** Why a script URL cannot be used, or null when it can. */
export function srcProblem(src: string, allowedHosts: string[]): string | null {
  let url: URL
  try {
    url = new URL(src)
  } catch {
    return "Enter a full https:// address"
  }
  if (url.protocol !== "https:") return "Use an https:// address"
  if (url.username !== "" || url.password !== "")
    return "Remove the user name and password from the address"
  if (url.port !== "") return "Remove the port from the address"
  if (!allowedHosts.includes(url.hostname))
    return `Add ${url.hostname} to Allowed hosts first`
  return null
}

export const customCodeSettings = z
  .object({
    disabled: z.boolean(),
    allowedHosts: z.array(hostname).max(20),
    snippets: z.array(snippet).max(20),
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>()
    value.snippets.forEach((s, i) => {
      if (seen.has(s.id))
        ctx.addIssue({
          code: "custom",
          path: ["snippets", i, "id"],
          message: "Duplicate snippet id",
        })
      seen.add(s.id)
      const hasSrc = s.src !== ""
      const hasHtml = s.html.trim() !== ""
      if (hasSrc && hasHtml)
        ctx.addIssue({
          code: "custom",
          path: ["snippets", i, "src"],
          message: "Use a script address or HTML, not both",
        })
      else if (!hasSrc && !hasHtml)
        ctx.addIssue({
          code: "custom",
          path: ["snippets", i, "html"],
          message: "Add a script address or HTML",
        })
      else if (hasSrc) {
        const problem = srcProblem(s.src, value.allowedHosts)
        if (problem)
          ctx.addIssue({
            code: "custom",
            path: ["snippets", i, "src"],
            message: problem,
          })
      }
    })
  })
export type CustomCodeSettings = z.infer<typeof customCodeSettings>
