import "server-only"

import type { TeamMemberInput } from "@/lib/schemas/content/team-member"

import type { MediaLookup } from "./media"

/** Display order = sortOrder. Photos are the design's temporary image. */
export function teamFixture(media: MediaLookup): TeamMemberInput[] {
  const photo = media("/images/about.png")
  return [
    {
      name: "Michael McDonald",
      role: "Managing Director",
      bio: "Michael has over 20 years experience in the security industry. Having worked on the ground, he started his own security business in 2008 and takes pride in the reputation he has grown.",
      email: "info@securitypartnersltd.com",
      photo,
    },
    {
      name: "John McDonald",
      role: "Operations Director",
      bio: "John has many years of security experience. He operationally runs the business and is dedicated to deploying officers on the ground and inducting on-site training.",
      email: "operations@securitypartnersltd.com",
      photo,
    },
    {
      name: "Sarah Moran",
      role: "HR/Operations Manager",
      bio: "Sarah is CIPD qualified and is HR Manager. She also oversees the business day to day and is the point of contact for all operational queries.",
      email: "HR@securitypartnersltd.com",
      photo,
    },
    {
      name: "Louise Sheeran",
      role: "Accounts Manager",
      bio: "Louise is IPASS qualified and looks after all accounts and invoicing. She is the point of contact for all invoicing queries.",
      email: "accounts@securitypartnersltd.com",
      photo,
    },
  ]
}
