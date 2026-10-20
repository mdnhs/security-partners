import { describe, expect, it, vi } from "vitest"

// Plain function (not vi.fn): Vitest reports errors thrown by spies as
// test failures even when the code under test catches them.
const client = vi.hoisted(() => ({
  signOut: async (): Promise<unknown> => ({ data: null, error: null }),
}))

vi.mock("@/lib/auth-client", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/auth-client")>()
  return { ...actual, authClient: client }
})

const { signInNotice } = await import("@/components/admin/auth/sign-in-form")
const { signOutOrError } =
  await import("@/components/admin/auth/sign-out-button")

describe("signInNotice", () => {
  it("returns the notice for known keys", () => {
    expect(signInNotice("signed-out")).toBe("You are signed out.")
    expect(signInNotice("password-set")).toContain("password is set")
  })

  it.each([null, "", "nope", "__proto__", "constructor", "toString"])(
    "returns null for %s",
    (key) => {
      expect(signInNotice(key)).toBeNull()
    }
  )
})

describe("signOutOrError", () => {
  it("returns null when sign-out succeeds", async () => {
    client.signOut = async () => ({ data: { success: true }, error: null })
    expect(await signOutOrError()).toBeNull()
  })

  it("returns a readable message when the server refuses", async () => {
    client.signOut = async () => ({
      data: null,
      error: { status: 429, statusText: "Too Many Requests" },
    })
    expect(await signOutOrError()).toBe(
      "Too many attempts. Wait a minute and try again."
    )
  })

  it("returns a message when the request itself fails", async () => {
    client.signOut = async () => {
      throw new TypeError("Failed to fetch")
    }
    expect(await signOutOrError()).toBe("Something went wrong. Try again.")
  })
})
