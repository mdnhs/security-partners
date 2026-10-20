"use client"

import { StatusPill } from "@/components/admin/kit/status-pill"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"

import { useAdminMode } from "./use-live-admin"

const CHARTS = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
]

// Sample admin controls drawn with the live tokens (see useLiveAdmin), which
// follow the admin's resolved mode. The caption names that same mode; a
// caller may pass it (the Appearance page passes useAdminMode's), and
// without one it is read here, so caption and colours cannot drift apart.
export function AdminPreview({ mode: given }: { mode?: "light" | "dark" }) {
  const resolved = useAdminMode().mode
  const mode = given ?? resolved
  return (
    <Card role="group" aria-label="Admin preview" data-mode={mode}>
      <CardHeader>
        <CardTitle>Admin preview</CardTitle>
        <CardDescription>
          {mode === "dark" ? "Dark mode" : "Light mode"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button">Primary</Button>
          <Button type="button" variant="secondary">
            Secondary
          </Button>
          <Button type="button" variant="outline">
            Outline
          </Button>
          <Badge>Badge</Badge>
        </div>
        <Input aria-label="Sample input" defaultValue="Sample text" />
        <label className="flex items-center gap-2 text-sm">
          <Switch defaultChecked aria-label="Sample switch" /> Sample switch
        </label>
        <div className="flex flex-wrap gap-2">
          <StatusPill tone="success">Published</StatusPill>
          <StatusPill tone="warning">Unpublished changes</StatusPill>
          <StatusPill tone="danger">Failed</StatusPill>
        </div>
        <div aria-hidden className="flex gap-2">
          {CHARTS.map((swatch) => (
            <span
              key={swatch}
              data-chart-swatch
              className={`h-8 flex-1 rounded-md ${swatch}`}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
