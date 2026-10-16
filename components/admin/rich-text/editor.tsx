"use client"

import {
  EditorContent,
  type JSONContent,
  ReactNodeViewRenderer,
  useEditor,
} from "@tiptap/react"
import { useEffect, useMemo, useState } from "react"

import { isDeepEqual } from "@/lib/json"
import { cn } from "@/lib/utils"

import { type RichTextMode, richTextExtensions } from "./extensions"
import { ImageNodeView } from "./image-view"
import { RichTextToolbar } from "./toolbar"

/** Ctrl/⌘ K without other modifiers (the link shortcut inside the editor). */
const isLinkShortcut = (event: KeyboardEvent) =>
  (event.metaKey || event.ctrlKey) &&
  !event.altKey &&
  !event.shiftKey &&
  event.key.toLowerCase() === "k"

/**
 * TipTap editor for `richText` / `paragraphsText` fields. The JSON it emits
 * is what the public renderer reads (lib/rich-text/render.tsx); Phase 5
 * reuses it for article bodies.
 */
export function RichTextEditor({
  id,
  value,
  onChange,
  mode = "full",
  label,
  describedBy,
  invalid,
  disabled,
}: {
  id: string
  value: JSONContent | null
  onChange: (doc: JSONContent) => void
  mode?: RichTextMode
  label: string
  describedBy?: string
  invalid?: boolean
  disabled?: boolean
}) {
  const [linkOpen, setLinkOpen] = useState(false)
  const extensions = useMemo(
    () =>
      richTextExtensions(mode, {
        imageView: ReactNodeViewRenderer(ImageNodeView),
      }),
    [mode]
  )
  // ARIA state changes (validation) update the live editor; recreating it
  // would drop the selection and undo history mid-typing.
  const attributes = useMemo(
    () => ({
      id,
      role: "textbox",
      "aria-multiline": "true",
      "aria-label": label,
      ...(describedBy ? { "aria-describedby": describedBy } : {}),
      ...(invalid ? { "aria-invalid": "true" } : {}),
      class: "rich-text-content min-h-36 px-3 py-2 outline-none",
    }),
    [id, label, describedBy, invalid]
  )
  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions,
      content: value ?? undefined,
      editable: !disabled,
      editorProps: {
        attributes,
        // Mod-K opens the link form. Returning true makes ProseMirror call
        // preventDefault(), so the admin ⌘K palette leaves the event alone.
        handleKeyDown: (view, event) => {
          if (!isLinkShortcut(event)) return false
          if (view.editable) setLinkOpen(true)
          return true
        },
      },
      onUpdate: ({ editor: e }) => onChange(e.getJSON()),
    },
    [extensions]
  )

  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    editor.setOptions({
      editorProps: { ...editor.options.editorProps, attributes },
    })
  }, [editor, attributes])

  // Outside changes (reload after a conflict, restore) replace the content.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    if (value && !isDeepEqual(editor.getJSON(), value))
      editor.commands.setContent(value, { emitUpdate: false })
  }, [editor, value])

  // `false`: toggling editability is not an edit (setEditable emits an
  // update by default, which would mark the form dirty on load).
  useEffect(() => {
    if (editor && !editor.isDestroyed && editor.isEditable === !!disabled)
      editor.setEditable(!disabled, false)
  }, [editor, disabled])

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-input bg-background focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        invalid && "border-destructive ring-3 ring-destructive/20",
        disabled && "opacity-60"
      )}
    >
      {editor ? (
        <RichTextToolbar
          editor={editor}
          mode={mode}
          editorId={id}
          linkOpen={linkOpen}
          onLinkOpenChange={setLinkOpen}
        />
      ) : null}
      <EditorContent editor={editor} />
    </div>
  )
}
