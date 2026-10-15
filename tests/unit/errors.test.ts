import { describe, expect, it } from "vitest"

import {
  AppError,
  conflict,
  ERROR_CODES,
  fieldErrorsFromIssues,
  forbidden,
  notFound,
} from "@/server/lib/errors"

describe("AppError", () => {
  it.each([
    ["VALIDATION_FAILED", 422],
    ["UNAUTHENTICATED", 401],
    ["FORBIDDEN", 403],
    ["NOT_FOUND", 404],
    ["CONFLICT", 409],
    ["RATE_LIMITED", 429],
    ["INTERNAL", 500],
  ] as const)("%s → %i", (code, status) => {
    expect(new AppError(code, "x").status).toBe(status)
  })

  it("covers every error code", () => {
    expect(ERROR_CODES).toEqual([
      "VALIDATION_FAILED",
      "UNAUTHENTICATED",
      "FORBIDDEN",
      "NOT_FOUND",
      "CONFLICT",
      "RATE_LIMITED",
      "INTERNAL",
    ])
  })

  it("is an Error with code, message and details", () => {
    const err = new AppError("VALIDATION_FAILED", "Invalid input", {
      fieldErrors: { slug: ["Required"] },
    })
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe("AppError")
    expect(err.message).toBe("Invalid input")
    expect(err.details?.fieldErrors).toEqual({ slug: ["Required"] })
  })
})

describe("helpers", () => {
  it("notFound", () => {
    const err = notFound("Service")
    expect([err.code, err.status, err.message]).toEqual([
      "NOT_FOUND",
      404,
      "Service not found",
    ])
  })

  it("forbidden", () => {
    expect(forbidden().status).toBe(403)
    expect(forbidden().code).toBe("FORBIDDEN")
  })

  it("conflict carries the current state", () => {
    const err = conflict({ version: 4 })
    expect(err.status).toBe(409)
    expect(err.details?.current).toEqual({ version: 4 })
  })

  it("fieldErrorsFromIssues joins nested paths with dots", () => {
    expect(
      fieldErrorsFromIssues([
        { path: ["hero", "heading"], message: "Required" },
        { path: ["items", 2, "label"], message: "Too long" },
        { path: ["items", 2, "label"], message: "Invalid" },
        { path: [], message: "Bad body" },
      ])
    ).toEqual({
      "hero.heading": ["Required"],
      "items.2.label": ["Too long", "Invalid"],
      _root: ["Bad body"],
    })
  })
})
