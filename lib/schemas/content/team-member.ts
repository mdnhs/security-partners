import { z } from "zod"

import { mediaRef, text } from "../common"

export const teamMemberSchema = z.object({
  name: text,
  role: text,
  bio: text,
  email: z.email(),
  photo: mediaRef.nullable(),
})
export type TeamMemberInput = z.infer<typeof teamMemberSchema>
