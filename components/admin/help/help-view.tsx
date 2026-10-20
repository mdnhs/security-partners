import { FormCard } from "@/components/admin/form/form-ui"
import { Kbd, KbdGroup } from "@/components/ui/kbd"

export type OwnerContact = { name: string; email: string }

/** ⌘ on a Mac, Ctrl elsewhere: both are listed (the page renders on the server). */
const SHORTCUTS: { keys: string[][]; action: string }[] = [
  {
    keys: [
      ["⌘", "K"],
      ["Ctrl", "K"],
    ],
    action: "Search and go",
  },
  {
    keys: [
      ["⌘", "J"],
      ["Ctrl", "J"],
    ],
    action: "AI assistant",
  },
  {
    keys: [
      ["⌘", "S"],
      ["Ctrl", "S"],
    ],
    action: "Save draft",
  },
  { keys: [["Esc"]], action: "Close panels" },
]

/**
 * Sections of docs/runbook.md (not served by the site, so titles only);
 * tests/unit/admin/help-guides.test.ts pins each to a `## ` heading there.
 */
export const HELP_GUIDES: readonly string[] = [
  "Owner locked out",
  "Sessions and sign-in",
  "Backups and the restore drill",
  "Restore a backup",
  "Custom code and Content-Security-Policy",
  "Background jobs",
]

/**
 * The Help page (MK dock): keyboard shortcuts, the owners to ask for access
 * or a reset, and the runbook's guides by title.
 */
export function HelpView({ owners }: { owners: OwnerContact[] }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <FormCard id="help-shortcuts" title="Keyboard shortcuts">
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-3 text-sm">
          {SHORTCUTS.map(({ keys, action }) => (
            <div key={action} className="contents">
              <dt className="flex flex-wrap items-center gap-1.5">
                {keys.map((combo, index) => (
                  <span
                    key={combo.join("+")}
                    className="flex items-center gap-1.5"
                  >
                    {index > 0 ? (
                      <span className="text-xs text-muted-foreground">or</span>
                    ) : null}
                    <KbdGroup>
                      {combo.map((key) => (
                        <Kbd key={key}>{key}</Kbd>
                      ))}
                    </KbdGroup>
                  </span>
                ))}
              </dt>
              <dd className="text-foreground">{action}</dd>
            </div>
          ))}
        </dl>
      </FormCard>
      <FormCard
        id="help-contact"
        title="Who to contact"
        description="Owners can invite people, change roles and reset access."
      >
        {owners.length > 0 ? (
          <ul className="flex flex-col gap-3 text-sm">
            {owners.map((owner) => (
              <li key={owner.email} className="flex min-w-0 flex-col">
                <span className="font-semibold text-foreground">
                  {owner.name}
                </span>
                {/* 44 px tall on coarse pointers; the inner span truncates. */}
                <a
                  href={`mailto:${owner.email}`}
                  className="inline-flex w-fit max-w-full items-center text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none pointer-coarse:min-h-11"
                >
                  <span className="truncate">{owner.email}</span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            There is no active owner yet. Ask whoever set up the site.
          </p>
        )}
      </FormCard>
      <FormCard
        id="help-guides"
        title="Guides"
        description="In the operations runbook (docs/runbook.md) kept with the site's code."
        className="xl:col-span-2"
      >
        <ul className="grid list-disc gap-2 pl-5 text-sm text-foreground sm:grid-cols-2">
          {HELP_GUIDES.map((guide) => (
            <li key={guide}>{guide}</li>
          ))}
        </ul>
      </FormCard>
    </div>
  )
}
