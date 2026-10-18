import "server-only"

/** Escapes LIKE/ILIKE wildcards (% _) and the escape character (\, Postgres' default ESCAPE). */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`)
}

/** `%value%` with wildcards escaped: a substring match for LIKE/ILIKE. */
export function containsPattern(value: string): string {
  return `%${escapeLike(value)}%`
}
