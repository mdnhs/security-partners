import type { APIRequestContext } from "@playwright/test"

/** A complete application for `jobSlug`, sent as the form would (multipart). */
export async function submitApplication(
  request: APIRequestContext,
  jobSlug = "static-security-officer",
  name = { firstName: "Niamh", surname: "Kelly" }
): Promise<string> {
  const answers = {
    ...name,
    email: "niamh@example.ie",
    phone: "085 765 4321",
    address: "",
    town: "Tullamore",
    eircode: "",
    rightToWork: "Irish or UK citizen",
    permissionExpiry: "",
    psa: "valid",
    psaNumber: "07654321",
    psaCategory: "Security Guard (Static)",
    psaExpiry: "2027-09-30",
    qualifications: [],
    history: [
      {
        employer: "Midlands Guarding",
        role: "",
        from: "2020-01",
        to: "",
        reason: "",
      },
    ],
    gardaVetting: true,
    livedAbroad: false,
    experience: "3–5 years",
    startDate: "2026-12-15",
    shifts: ["Days"],
    transport: false,
    coverNote: "",
    heardFrom: "",
    consents: [true, true, false],
  }
  const res = await request.post("/api/v1/public/careers/applications", {
    multipart: {
      jobSlug,
      submissionId: crypto.randomUUID(),
      answers: JSON.stringify(answers),
      cv: {
        name: "niamh-cv.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.7\n% e2e\n%%EOF"),
      },
    },
  })
  if (res.status() !== 201)
    throw new Error(
      `application not stored: ${res.status()} ${await res.text()}`
    )
  return ((await res.json()) as { applicationId: string }).applicationId
}
