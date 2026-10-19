import { DashboardCard } from "@/components/admin/kit/dashboard-card"
import { PageHeader } from "@/components/admin/page-header"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EVENT_CATALOGUE } from "@/lib/analytics/events"

const COLUMNS = ["Event", "Fires when", "Params", "GA4", "Meta"] as const

/** Marketing › Event catalogue: what the site sends, and where it lands. */
export function EventsView() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Event catalogue"
        description="The events the site sends once a visitor consents, and their GA4 and Meta names."
      />
      <DashboardCard title="Events">
        <Table scrollLabel="Events table">
          <TableHeader>
            <TableRow>
              {COLUMNS.map((column) => (
                <TableHead
                  key={column}
                  scope="col"
                  className="text-muted-foreground"
                >
                  {column}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {EVENT_CATALOGUE.map((row) => (
              <TableRow key={row.event}>
                <TableCell>
                  <code className="font-mono text-[13px]">{row.event}</code>
                </TableCell>
                <TableCell className="min-w-48 whitespace-normal">
                  {row.firesWhen}
                </TableCell>
                <TableCell className="whitespace-normal">
                  {row.params.map((param, i) => (
                    <span key={param}>
                      {i > 0 ? ", " : null}
                      <code className="font-mono text-[13px]">{param}</code>
                    </span>
                  ))}
                </TableCell>
                <TableCell>
                  <code className="font-mono text-[13px]">{row.ga4}</code>
                </TableCell>
                <TableCell>
                  {row.meta ?? (
                    <>
                      <span aria-hidden="true">—</span>
                      <span className="sr-only">None</span>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-sm text-muted-foreground">
          To set up Google Tag Manager, import{" "}
          <code className="font-mono">docs/gtm-container.json</code> (ask your
          developer for the file).
        </p>
      </DashboardCard>
    </div>
  )
}
