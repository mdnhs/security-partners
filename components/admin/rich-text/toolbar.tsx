"use client"

import { type Editor, useEditorState } from "@tiptap/react"
import {
  Bold,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Undo2,
} from "lucide-react"
import { useState } from "react"

import { MediaPickerDialog } from "@/components/admin/media/picker-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

import { isRichTextHref, type RichTextMode } from "./extensions"

function ToolButton({
  label,
  pressed,
  disabled,
  onClick,
  children,
}: {
  label: string
  pressed?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className="aria-pressed:bg-muted aria-pressed:text-foreground"
    >
      {children}
    </Button>
  )
}

/**
 * Link form. Controlled by the editor so Mod-K (handled inside the editor)
 * opens the same popover as the toolbar button.
 */
function LinkButton({
  editor,
  active,
  disabled,
  open,
  onOpenChange,
}: {
  editor: Editor
  active: boolean
  disabled?: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [href, setHref] = useState("")
  const [error, setError] = useState<string | null>(null)
  // Prefill from the link under the cursor each time the form opens.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setHref((editor.getAttributes("link").href as string | undefined) ?? "")
      setError(null)
    }
  }

  function apply() {
    const value = href.trim()
    if (!isRichTextHref(value)) {
      setError("Use /path, #anchor, https://…, tel: or mailto:")
      return
    }
    const chain = editor.chain().focus().extendMarkRange("link")
    // No text selected: insert the address itself as the link text.
    if (editor.state.selection.empty && !editor.isActive("link"))
      chain
        .insertContent({
          type: "text",
          text: value,
          marks: [{ type: "link", attrs: { href: value } }],
        })
        .run()
    else chain.setLink({ href: value }).run()
    onOpenChange(false)
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        disabled={disabled}
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Link"
            title="Link (Ctrl/⌘ K)"
            aria-pressed={active}
            className="aria-pressed:bg-muted aria-pressed:text-foreground"
          />
        }
      >
        <Link2 aria-hidden />
      </PopoverTrigger>
      <PopoverContent
        className="w-80"
        align="start"
        // Back to the text being linked, not the toolbar button.
        finalFocus={() => {
          if (!editor.isDestroyed) editor.commands.focus()
          return false
        }}
      >
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            apply()
          }}
        >
          <Input
            aria-label="Link address"
            placeholder="/contact or https://…"
            value={href}
            aria-invalid={!!error}
            onChange={(event) => {
              setHref(event.target.value)
              setError(null)
            }}
          />
          {error ? (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            {active ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  editor
                    .chain()
                    .focus()
                    .extendMarkRange("link")
                    .unsetLink()
                    .run()
                  onOpenChange(false)
                }}
              >
                Remove link
              </Button>
            ) : null}
            <Button type="submit" size="sm">
              Apply
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  )
}

/** Formatting controls limited to what the site renders (spec §5.3). */
export function RichTextToolbar({
  editor,
  mode,
  editorId,
  linkOpen,
  onLinkOpenChange,
}: {
  editor: Editor
  mode: RichTextMode
  editorId: string
  linkOpen: boolean
  onLinkOpenChange: (open: boolean) => void
}) {
  const [picking, setPicking] = useState(false)
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      editable: e.isEditable,
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      link: e.isActive("link"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  })
  const full = mode === "full"
  const locked = !state.editable
  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      aria-controls={editorId}
      className="flex flex-wrap items-center gap-0.5 border-b bg-muted/40 p-1"
    >
      <ToolButton
        label="Bold"
        pressed={state.bold}
        disabled={locked}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold aria-hidden />
      </ToolButton>
      <ToolButton
        label="Italic"
        pressed={state.italic}
        disabled={locked}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic aria-hidden />
      </ToolButton>
      <LinkButton
        editor={editor}
        active={state.link}
        disabled={locked}
        open={linkOpen && !locked}
        onOpenChange={onLinkOpenChange}
      />
      {full ? (
        <>
          <span aria-hidden className="mx-1 h-5 w-px bg-border" />
          <ToolButton
            label="Heading"
            pressed={state.h2}
            disabled={locked}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
          >
            <Heading2 aria-hidden />
          </ToolButton>
          <ToolButton
            label="Subheading"
            pressed={state.h3}
            disabled={locked}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 3 }).run()
            }
          >
            <Heading3 aria-hidden />
          </ToolButton>
          <ToolButton
            label="Bulleted list"
            pressed={state.bullet}
            disabled={locked}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List aria-hidden />
          </ToolButton>
          <ToolButton
            label="Numbered list"
            pressed={state.ordered}
            disabled={locked}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered aria-hidden />
          </ToolButton>
          <ToolButton
            label="Quote"
            pressed={state.quote}
            disabled={locked}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          >
            <Quote aria-hidden />
          </ToolButton>
          <ToolButton
            label="Insert image"
            disabled={locked}
            onClick={() => setPicking(true)}
          >
            <ImagePlus aria-hidden />
          </ToolButton>
          <MediaPickerDialog
            open={picking}
            onOpenChange={setPicking}
            onSelect={(item) =>
              editor
                .chain()
                .focus()
                .insertContent({
                  type: "image",
                  attrs: { media: { mediaId: item.id }, alt: item.alt },
                })
                .run()
            }
          />
        </>
      ) : null}
      <span aria-hidden className="mx-1 h-5 w-px bg-border" />
      <ToolButton
        label="Undo"
        disabled={locked || !state.canUndo}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo2 aria-hidden />
      </ToolButton>
      <ToolButton
        label="Redo"
        disabled={locked || !state.canRedo}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo2 aria-hidden />
      </ToolButton>
    </div>
  )
}
