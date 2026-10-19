import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const FOCUS = ["focus-visible:ring-3", "focus-visible:ring-ring/50"]
const COARSE_HIT = [
  "relative",
  "after:absolute",
  "after:-inset-3.5",
  "pointer-fine:after:hidden",
]

describe("shadcn primitives", () => {
  it("Select is a labelled combobox that picks with the keyboard", async () => {
    const user = userEvent.setup()
    render(
      <>
        <Label htmlFor="s">Status</Label>
        {/* Base UI shows the raw value unless `items` maps values to labels. */}
        <Select
          defaultValue="a"
          items={[
            { value: "a", label: "Alpha" },
            { value: "b", label: "Beta" },
          ]}
        >
          <SelectTrigger id="s">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Letters</SelectLabel>
              <SelectItem value="a">Alpha</SelectItem>
              <SelectSeparator />
              <SelectItem value="b">Beta</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </>
    )
    const box = screen.getByRole("combobox", { name: "Status" })
    expect(box).toHaveTextContent("Alpha")
    expect(box).toHaveClass(
      "data-[size=default]:h-8",
      "data-[size=sm]:h-7",
      // h-11 alone loses to the data-[size] height (higher specificity);
      // min-h-11 guarantees the 44 px coarse target.
      "pointer-coarse:h-11",
      "pointer-coarse:min-h-11",
      ...FOCUS
    )
    await user.click(box)
    // Wait until the open list has highlighted the current value, so the
    // arrow key moves from it (timing differs under a loaded test run).
    const alpha = await screen.findByRole("option", { name: "Alpha" })
    await waitFor(() => expect(alpha).toHaveAttribute("data-highlighted"))
    await user.keyboard("{ArrowDown}{Enter}")
    expect(box).toHaveTextContent("Beta")
    expect(box.textContent).not.toContain("▼")
  })

  it("Tabs expose tablist/tab/tabpanel and arrow-key focus", async () => {
    const user = userEvent.setup()
    render(
      <Tabs defaultValue="one">
        <TabsList aria-label="Sections">
          <TabsTrigger value="one">One</TabsTrigger>
          <TabsTrigger value="two">Two</TabsTrigger>
        </TabsList>
        <TabsContent value="one">P1</TabsContent>
        <TabsContent value="two">P2</TabsContent>
      </Tabs>
    )
    expect(screen.getByRole("tablist", { name: "Sections" })).toBeVisible()
    const one = screen.getByRole("tab", { name: "One" })
    expect(one).toHaveClass("pointer-coarse:min-h-11", ...FOCUS)
    one.focus()
    await user.keyboard("{ArrowRight}{Enter}")
    const two = screen.getByRole("tab", { name: "Two" })
    expect(two).toHaveFocus()
    expect(two).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("tabpanel")).toHaveTextContent("P2")
  })

  it("Checkbox and RadioGroup toggle by keyboard", async () => {
    const user = userEvent.setup()
    render(
      <>
        <Checkbox aria-label="Publish" />
        <RadioGroup aria-label="Size" defaultValue="s">
          <RadioGroupItem value="s" aria-label="Small" />
          <RadioGroupItem value="l" aria-label="Large" />
        </RadioGroup>
      </>
    )
    const box = screen.getByRole("checkbox", { name: "Publish" })
    expect(box).toHaveClass(...COARSE_HIT, ...FOCUS)
    expect(box).toHaveAttribute("aria-checked", "false")
    box.focus()
    await user.keyboard(" ")
    expect(box).toHaveAttribute("aria-checked", "true")

    const small = screen.getByRole("radio", { name: "Small" })
    expect(small).toHaveClass(...COARSE_HIT, ...FOCUS)
    expect(small).toHaveAttribute("aria-checked", "true")
    small.focus()
    await user.keyboard("{ArrowDown}")
    const large = screen.getByRole("radio", { name: "Large" })
    expect(large).toHaveFocus()
    expect(large).toHaveAttribute("aria-checked", "true")
    expect(small).toHaveAttribute("aria-checked", "false")
  })

  it("Table renders semantic table roles with roomy cells", () => {
    render(
      <Table scrollLabel="Leads">
        <TableCaption>Recent leads</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Ada</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>1 lead</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    )
    expect(screen.getByRole("region", { name: "Leads" })).toHaveAttribute(
      "tabindex",
      "0"
    )
    expect(screen.getByRole("table", { name: "Recent leads" })).toBeVisible()
    expect(screen.getByRole("columnheader", { name: "Name" })).toHaveClass(
      "h-12",
      "px-4"
    )
    expect(screen.getByRole("cell", { name: "Ada" })).toHaveClass(
      "px-4",
      "py-3"
    )
  })

  it("Breadcrumb marks the current page", () => {
    render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/admin">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbEllipsis />
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Pages</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    )
    expect(screen.getByRole("navigation", { name: "breadcrumb" })).toBeVisible()
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveClass(
      ...FOCUS
    )
    expect(screen.getByText("Pages")).toHaveAttribute("aria-current", "page")
  })

  it("Item and ScrollArea render their slots", () => {
    render(
      <>
        <ItemGroup>
          <Item>
            <ItemMedia>M</ItemMedia>
            <ItemContent>
              <ItemTitle>Title</ItemTitle>
              <ItemDescription>Desc</ItemDescription>
            </ItemContent>
            <ItemActions>A</ItemActions>
          </Item>
          <ItemSeparator />
        </ItemGroup>
        <ScrollArea viewportProps={{ "aria-label": "Log" }}>
          <p>Body</p>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </>
    )
    expect(screen.getByRole("list")).toBeVisible()
    expect(screen.getByText("Title")).toHaveAttribute("data-slot", "item-title")
    expect(screen.getByText("Body")).toBeVisible()
  })
})
