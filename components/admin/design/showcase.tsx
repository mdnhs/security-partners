"use client"

import { BriefcaseBusiness, InboxIcon, PlusIcon } from "lucide-react"
import Link from "next/link"
import { type ReactNode, useId, useState } from "react"

import { NextUp } from "@/components/admin/dashboard/next-up"
import { ActivityFeed } from "@/components/admin/kit/activity-feed"
import { DashboardCard } from "@/components/admin/kit/dashboard-card"
import { EmptyState } from "@/components/admin/kit/empty-state"
import { Gauge } from "@/components/admin/kit/gauge"
import { KpiCard } from "@/components/admin/kit/kpi-card"
import { PillBarChart } from "@/components/admin/kit/pill-bar-chart"
import { CardSkeleton, KpiRowSkeleton } from "@/components/admin/kit/skeletons"
import { StatusPill } from "@/components/admin/kit/status-pill"
import { OptionSelect } from "@/components/admin/option-select"
import {
  PageHeader,
  PRIMARY_ACTION,
  SECONDARY_ACTION,
} from "@/components/admin/page-header"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

import {
  SAMPLE_CONTENT_HEALTH,
  SAMPLE_ITEMS,
  SAMPLE_KPIS,
  SAMPLE_LEADS,
  SAMPLE_NEXT_UP,
  SAMPLE_NOW,
  SAMPLE_REGIONS,
  SAMPLE_RESPONSE_TIMES,
  SAMPLE_STATUSES,
  SAMPLE_TEAM,
  SAMPLE_WEEK,
} from "./sample-data"

/** A titled block of the gallery: its h2 names the region. */
function Section({
  title,
  children,
  className,
}: {
  title: string
  children: ReactNode
  className?: string
}) {
  const id = useId()
  return (
    <section
      aria-labelledby={id}
      className={cn("flex flex-col gap-4", className)}
    >
      <h2 id={id} className="text-card-title">
        {title}
      </h2>
      {children}
    </section>
  )
}

function FormControls() {
  const ids = useId()
  const [region, setRegion] = useState("dublin")
  const id = (name: string) => `${ids}-${name}`
  return (
    <div className="rounded-card flex flex-col gap-6 bg-card p-5 text-card-foreground sm:p-6">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={id("name")}>Service name</FieldLabel>
          <Input id={id("name")} defaultValue="Alarm Responses" />
        </Field>
        <Field>
          <FieldLabel htmlFor={id("summary")}>Summary</FieldLabel>
          <Textarea
            id={id("summary")}
            aria-describedby={id("summary-help")}
            defaultValue="Keyholders on call around the clock: we attend every alarm activation."
          />
          <FieldDescription id={id("summary-help")}>
            Shown on the services page and in search results.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor={id("region")}>Region</FieldLabel>
          <OptionSelect
            id={id("region")}
            value={region}
            options={SAMPLE_REGIONS}
            onChange={setRegion}
            className="sm:w-64"
          />
        </Field>
        <FieldSet>
          <FieldLegend id={id("response")} variant="label">
            Response time
          </FieldLegend>
          <RadioGroup aria-labelledby={id("response")} defaultValue="30">
            {SAMPLE_RESPONSE_TIMES.map((option) => (
              <Field key={option.value} orientation="horizontal">
                <RadioGroupItem
                  id={id(`response-${option.value}`)}
                  value={option.value}
                />
                <FieldLabel
                  htmlFor={id(`response-${option.value}`)}
                  className="font-normal"
                >
                  {option.label}
                </FieldLabel>
              </Field>
            ))}
          </RadioGroup>
        </FieldSet>
        <Field orientation="horizontal">
          <Checkbox id={id("home")} defaultChecked />
          <FieldLabel htmlFor={id("home")} className="font-normal">
            Show on the home page
          </FieldLabel>
        </Field>
        <label className="flex min-h-16 cursor-pointer items-center justify-between gap-4 rounded-xl border bg-background px-4 py-3 shadow-xs">
          <span id={id("open")} className="text-sm font-medium">
            Accepting enquiries
          </span>
          <Switch defaultChecked aria-labelledby={id("open")} />
        </label>
      </FieldGroup>
      <Tabs defaultValue="details">
        <TabsList aria-label="Sample tabs">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="pt-3 text-sm">
          The service&apos;s name, summary and body.
        </TabsContent>
        <TabsContent value="seo" className="pt-3 text-sm">
          Title and description for search engines.
        </TabsContent>
        <TabsContent value="history" className="pt-3 text-sm">
          Every published version.
        </TabsContent>
      </Tabs>
    </div>
  )
}

/**
 * Every admin component on fixed sample data (MK-parity A7): for client
 * demos, the side-by-side review against the MK reference, and the visual
 * tests. Buttons do nothing and nothing is fetched or saved.
 */
export function Showcase() {
  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title="Design system"
        description="Every admin component on sample data."
        actions={
          <>
            <Button type="button" className={PRIMARY_ACTION}>
              <PlusIcon aria-hidden data-icon="inline-start" />
              New service
            </Button>
            <Button
              type="button"
              variant="outline"
              className={SECONDARY_ACTION}
            >
              View site
            </Button>
          </>
        }
      />

      <Section title="KPI cards">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {SAMPLE_KPIS.map((kpi) => (
            <KpiCard key={kpi.label} {...kpi} />
          ))}
        </div>
      </Section>

      <Section title="Dashboard cards">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <DashboardCard title="Enquiries this week" headingLevel={3}>
            <PillBarChart
              ariaLabel="Enquiries this week"
              labelFigure={false}
              legend={{ current: "This week", previous: "Last week" }}
              data={SAMPLE_WEEK}
            />
          </DashboardCard>
          <NextUp items={SAMPLE_NEXT_UP} headingLevel={3} />
        </div>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <DashboardCard title="Team activity" headingLevel={3}>
            <ActivityFeed
              label="Team activity list"
              entries={SAMPLE_TEAM}
              now={SAMPLE_NOW}
              emptyTitle="No activity yet"
              emptyDescription="Changes by your team will show here."
            />
          </DashboardCard>
          <DashboardCard title="Content health" headingLevel={3}>
            <Gauge
              title="Content health"
              centerLabel="SEO checks passing"
              headlineKey="passed"
              parts={SAMPLE_CONTENT_HEALTH}
            />
          </DashboardCard>
        </div>
      </Section>

      <Section title="Status pills">
        <div className="flex flex-wrap gap-2">
          {SAMPLE_STATUSES.map((status) => (
            <StatusPill key={status.tone} tone={status.tone}>
              {status.label}
            </StatusPill>
          ))}
        </div>
      </Section>

      <Section title="Form controls" className="max-w-2xl">
        <FormControls />
      </Section>

      <Section title="Table">
        <div className="rounded-card bg-card p-2 text-card-foreground sm:p-3">
          <Table scrollLabel="Recent enquiries table">
            <TableCaption className="sr-only">Recent enquiries</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SAMPLE_LEADS.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="font-semibold">{lead.name}</TableCell>
                  <TableCell>{lead.service}</TableCell>
                  <TableCell className="tabular-nums">
                    {lead.received}
                  </TableCell>
                  <TableCell>
                    <StatusPill tone={lead.status.tone}>
                      {lead.status.label}
                    </StatusPill>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Section>

      <Section title="Empty and loading states">
        <EmptyState
          icon={InboxIcon}
          title="No enquiries yet"
          description="New messages from the contact form will appear here."
          action={
            <Button
              type="button"
              variant="outline"
              className={SECONDARY_ACTION}
            >
              Open the contact page
            </Button>
          }
        />
        <KpiRowSkeleton />
        <CardSkeleton />
      </Section>

      <Section title="Breadcrumb and item list">
        <Breadcrumb aria-label="Sample breadcrumb">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink
                className="inline-flex items-center rounded-md pointer-coarse:min-h-11"
                render={<Link href="/admin" />}
              >
                Dashboard
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink
                className="inline-flex items-center rounded-md pointer-coarse:min-h-11"
                render={<Link href="/admin/services" />}
              >
                Services
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="font-medium">
                Alarm Responses
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <ItemGroup
          role="list"
          aria-label="Sample items"
          className="rounded-card bg-card p-2 text-card-foreground"
        >
          {SAMPLE_ITEMS.map((item) => (
            <Item key={item.id} role="listitem">
              <ItemMedia variant="icon">
                <BriefcaseBusiness aria-hidden />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{item.title}</ItemTitle>
                <ItemDescription>{item.description}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <StatusPill tone={item.status.tone}>
                  {item.status.label}
                </StatusPill>
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      </Section>
    </div>
  )
}
