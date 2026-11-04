import { describe, expect, it } from "vitest"

import { filterJobs } from "@/lib/careers/filter"

const jobs = [
  {
    title: "Static Security Officer",
    category: "Static Guarding",
    location: "Portlaoise",
    licence: "Security Guard (Static)",
    shift: "Days",
    pay: "€15",
  },
  {
    title: "Mobile Patrol Officer",
    category: "Mobile Patrol",
    location: "Laois & Offaly",
    licence: "Security Guard (Static)",
    shift: "Nights",
    pay: "€16",
  },
  {
    title: "CCTV Monitoring Operator",
    category: "Monitoring",
    location: "Mountmellick",
    licence: "Monitoring Centre Operative",
    shift: "Rota",
    pay: "€15.75",
  },
]
const titles = (list: typeof jobs) => list.map((j) => j.title)

describe("filterJobs", () => {
  it("with no filters returns everything in order", () => {
    expect(titles(filterJobs(jobs, {}))).toEqual(titles(jobs))
  })

  it("searches title, category, location and shift, ignoring case and extra spaces", () => {
    expect(titles(filterJobs(jobs, { q: "  cctv " }))).toEqual([
      "CCTV Monitoring Operator",
    ])
    expect(titles(filterJobs(jobs, { q: "NIGHTS" }))).toEqual([
      "Mobile Patrol Officer",
    ])
    expect(titles(filterJobs(jobs, { q: "offaly patrol" }))).toEqual([
      "Mobile Patrol Officer",
    ])
  })

  it("filters by exact location, licence and category, combined", () => {
    expect(
      titles(filterJobs(jobs, { licence: "Security Guard (Static)" }))
    ).toEqual(["Static Security Officer", "Mobile Patrol Officer"])
    expect(
      titles(
        filterJobs(jobs, {
          licence: "Security Guard (Static)",
          category: "Mobile Patrol",
        })
      )
    ).toEqual(["Mobile Patrol Officer"])
    expect(
      titles(filterJobs(jobs, { location: "Mountmellick", q: "static" }))
    ).toEqual([])
  })
})
