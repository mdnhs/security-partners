"use client"

import { useId } from "react"

import { ADMIN_CONTROL, FormCard } from "@/components/admin/form/form-ui"
import {
  ErrorText,
  HelpText,
  LABEL_CLASS,
} from "@/components/admin/schema-form/widgets/field-shell"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

import {
  anchorProblem,
  type BlockMetaPatch,
  type DraftBlock,
  type DraftDocumentValue,
} from "./builder-state"

/**
 * A block's place on the page apart from its content: its anchor (the
 * section id in links like /p/<slug>#anchor) and whether it is hidden.
 * The anchor is checked as typed: format, reserved section ids
 * (about/services/team/blog/contact belong to their own blocks) and
 * uniqueness on the page. Invalid values still reach the draft (autosave
 * keeps work); publish refuses them.
 */
export function BlockMeta({
  block,
  doc,
  errors = [],
  readOnly = false,
  onChange,
}: {
  block: DraftBlock
  doc: DraftDocumentValue
  /** Server (publish) errors for this block's anchor. */
  errors?: string[]
  readOnly?: boolean
  onChange(p: BlockMetaPatch): void
}) {
  const id = useId()
  const anchorId = `${id}-anchor`
  const hiddenId = `${id}-hidden`
  const error = anchorProblem(block.anchor, block, doc) ?? errors[0] ?? null
  return (
    <FormCard id={`${id}-card`} title="Placement" headingLevel={3}>
      <div className="flex flex-col gap-2">
        <label htmlFor={anchorId} className={LABEL_CLASS}>
          Anchor
        </label>
        <HelpText id={`${anchorId}-help`}>
          Links to this section end in #{block.anchor || "anchor"}. Lower-case
          letters, digits and hyphens.
        </HelpText>
        <Input
          id={anchorId}
          className={cn(ADMIN_CONTROL, "font-mono pointer-coarse:h-11")}
          value={block.anchor}
          maxLength={40}
          autoComplete="off"
          spellCheck={false}
          disabled={readOnly}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            error ? `${anchorId}-help ${anchorId}-error` : `${anchorId}-help`
          }
          onChange={(event) => onChange({ anchor: event.target.value })}
        />
        {/* Polite: the problem is announced as it appears while typing. */}
        <div aria-live="polite">
          {error ? (
            <ErrorText id={`${anchorId}-error`}>{error}</ErrorText>
          ) : null}
        </div>
      </div>
      <div className="flex min-h-16 items-center justify-between gap-4 rounded-xl border bg-background px-4 py-3 shadow-xs">
        <div className="flex min-w-0 flex-col gap-0.5">
          <label htmlFor={hiddenId} className={LABEL_CLASS}>
            Hidden
          </label>
          <HelpText id={`${hiddenId}-help`}>
            Kept in the page, not shown on the site.
          </HelpText>
        </div>
        <Switch
          id={hiddenId}
          checked={block.hidden}
          disabled={readOnly}
          aria-describedby={`${hiddenId}-help`}
          onCheckedChange={(hidden) => onChange({ hidden })}
        />
      </div>
    </FormCard>
  )
}
