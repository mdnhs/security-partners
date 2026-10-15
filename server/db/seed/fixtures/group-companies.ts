import "server-only"

import type { GroupCompanyInput } from "@/lib/schemas/content/group-company"

import type { MediaLookup } from "./media"

/** Footer "Other services in the group"; display order = sortOrder. */
export function groupCompaniesFixture(media: MediaLookup): GroupCompanyInput[] {
  return [
    {
      name: "MJS Eco",
      phone: "(087) 924 8880",
      site: "www.mjseco.ie",
      logo: media("/images/group-mjs-eco.png"),
    },
    {
      name: "Cleaning Partners",
      phone: "085 806 2369",
      site: "www.cleaningpartners.ie",
      logo: media("/images/group-cleaning-partners.png"),
    },
  ]
}
