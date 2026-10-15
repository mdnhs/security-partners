import "server-only"

import type { ClientInput } from "@/lib/schemas/content/client"

import type { MediaLookup } from "./media"

/** Display order = sortOrder; the logo alt is the client name. */
export function clientsFixture(media: MediaLookup): ClientInput[] {
  return [
    { name: "Dinn Rí", logo: media("/images/client-dinn-ri.png"), url: null },
    {
      name: "Langton House Hotel",
      logo: media("/images/client-langton.png"),
      url: null,
    },
    { name: "Hayes Hotel", logo: media("/images/client-hayes.png"), url: null },
    {
      name: "Martin Reddin",
      logo: media("/images/client-martin-reddin.png"),
      url: null,
    },
    {
      name: "Killeen Civil Engineering",
      logo: media("/images/client-killeen.png"),
      url: null,
    },
    {
      name: "Greenfield",
      logo: media("/images/client-greenfield.png"),
      url: null,
    },
    { name: "Telfords", logo: media("/images/client-telfords.png"), url: null },
    {
      name: "Laois Hire",
      logo: media("/images/client-laois-hire.png"),
      url: null,
    },
  ]
}
