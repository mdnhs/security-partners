import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import {
  columnsFor,
  DataTable,
  type DataTableColumns,
  type DataTableParams,
} from "@/components/admin/data-table/data-table"
import { makeQueryClient } from "@/components/admin/providers"

import { pickOption } from "./select-helper"

type Row = { id: string; name: string; city: string } & Record<string, unknown>
const ch = columnsFor<Row>()
const COLUMNS = ch.columns([
  ch.accessor("name", { header: "Name" }),
  ch.accessor("city", { header: "City", enableSorting: false }),
]) as unknown as DataTableColumns<Row>

function renderTable() {
  const fetchPage = vi.fn(async (params: DataTableParams) => ({
    items: [
      { id: "1", name: "Ann", city: "Cork" },
      { id: "2", name: "Bob", city: "Galway" },
    ],
    page: params.page,
    pageSize: params.pageSize,
    total: 2,
  }))
  render(
    <QueryClientProvider client={makeQueryClient()}>
      <DataTable<Row>
        label="People"
        queryKey={["people-table"]}
        fetchPage={fetchPage}
        columns={COLUMNS}
        renderCard={(row) => row.name}
        empty="Nobody"
      />
    </QueryClientProvider>
  )
  return fetchPage
}

describe("DataTable on shadcn Table/Select (MK parity A5)", () => {
  it("sort header is a button inside a columnheader with aria-sort", async () => {
    const user = userEvent.setup()
    const fetchPage = renderTable()
    const table = await screen.findByRole("table", { name: "People" })
    expect(table).toHaveAttribute("data-slot", "table")
    const name = within(table).getByRole("columnheader", { name: /Name/ })
    expect(name).toHaveAttribute("data-slot", "table-head")
    expect(name).toHaveAttribute("scope", "col")
    expect(name).toHaveAttribute("aria-sort", "none")
    // A column that cannot sort has no aria-sort and no button.
    const city = within(table).getByRole("columnheader", { name: "City" })
    expect(city).not.toHaveAttribute("aria-sort")
    expect(within(city).queryByRole("button")).toBeNull()

    const button = within(name).getByRole("button", { name: /Name/ })
    button.focus()
    await user.keyboard("{Enter}")
    await waitFor(() => expect(name).toHaveAttribute("aria-sort", "ascending"))
    expect(fetchPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ sort: "name:asc" })
    )
    await user.click(button)
    await waitFor(() => expect(name).toHaveAttribute("aria-sort", "descending"))
    expect(
      within(table)
        .getAllByRole("cell")
        .map((c) => c.dataset.slot)
    ).toEqual(Array(4).fill("table-cell"))
  })

  it("phones sort with a labelled Select that shows the chosen label", async () => {
    const user = userEvent.setup()
    const fetchPage = renderTable()
    await screen.findByRole("table", { name: "People" })
    const sortBy = screen.getByRole("combobox", { name: "Sort by" })
    expect(sortBy).toHaveTextContent("Default order")
    await pickOption(user, sortBy, "Name (descending)")
    expect(sortBy).toHaveTextContent("Name (descending)")
    await waitFor(() =>
      expect(fetchPage).toHaveBeenLastCalledWith(
        expect.objectContaining({ sort: "name:desc" })
      )
    )
    await pickOption(user, sortBy, "Default order")
    await waitFor(() =>
      expect(fetchPage).toHaveBeenLastCalledWith(
        expect.objectContaining({ sort: undefined })
      )
    )
  })
})
