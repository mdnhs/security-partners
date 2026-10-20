import "server-only"

/**
 * Byline-only users (spec §5.3): created banned and without a password so
 * they can never sign in. `.invalid` addresses cannot collide with a real
 * account (e.g. an owner invited as info@securitypartnersltd.com).
 */
export const AUTHORS = [
  {
    email: "michael.mcdonald@authors.invalid",
    name: "Michael McDonald",
    title: "Managing Director",
  },
] as const

export type AuthorEmail = (typeof AUTHORS)[number]["email"]
