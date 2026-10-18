// The admin the shell screenshots sign in as. Created by tests/visual/seed.ts.
export const VISUAL_ADMIN = {
  email: "vera@visual.test",
  name: "Vera Visual",
  password: "visual-password-0123456789",
} as const

// An editor: the admin views the panel as them (impersonation banner), and
// signed in as them /admin/users is forbidden (the 403 state).
export const VISUAL_EDITOR = {
  email: "eddie@visual.test",
  name: "Eddie Visual",
  password: "visual-password-0123456789",
} as const

// An author (Phase 5): the article editor as they see it (no publishing).
export const VISUAL_AUTHOR = {
  email: "arthur@visual.test",
  name: "Arthur Visual",
  password: "visual-password-0123456789",
} as const
