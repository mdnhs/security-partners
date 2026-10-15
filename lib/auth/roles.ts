export const ROLES = [
  "owner",
  "admin",
  "editor",
  "author",
  "marketer",
  "intake",
  "viewer",
] as const
export type Role = (typeof ROLES)[number]
