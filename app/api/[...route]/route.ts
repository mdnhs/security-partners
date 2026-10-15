import { app } from "@/server/api/app"

const handler = (req: Request) => app.fetch(req)

export {
  handler as DELETE,
  handler as GET,
  handler as OPTIONS,
  handler as PATCH,
  handler as POST,
  handler as PUT,
}
