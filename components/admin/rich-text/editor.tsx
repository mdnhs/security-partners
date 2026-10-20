"use client"

import {
  type Editor,
  EditorContent,
  type JSONContent,
  ReactNodeViewRenderer,
  useEditor,
  useEditorState,
} from "@tiptap/react"
import { useEffect, useMemo, useState } from "react"

import { isDeepEqual } from "@/lib/json"
import { countTextWords, minutesFor } from "@/lib/rich-text/read-time"
import { cn } from "@/lib/utils"

import { type RichTextMode, richTextExtensions } from "./extensions"
import { ImageNodeView, RichTextDisabledContext } from "./image-view"
import { RichTextToolbar } from "./toolbar"

/** ⌘K (macOS) / Ctrl+K without other modifiers: inside the editor it means "link", not the admin palette. */
export function isLinkShortcut(event: KeyboardEvent): boolean {
  return (
    event.key.toLowerCase() === "k" &&
    (event.metaKey || event.ctrlKey) &&
    !event.altKey &&
    !event.shiftKey
  )
}

/**
 * "N words · about M min read" under article bodies (same 200 wpm as the
 * site). Part of the editor's description, not a live region: it would
 * speak after every keystroke.
 */
function WordCount({ editor, id }: { editor: Editor; id: string }) {
  const words = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      countTextWords(
        e.state.doc.textBetween(0, e.state.doc.content.size, " ", " ")
      ),
  })
  return (
    <p
      id={id}
      className="border-t bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground"
    >
      {words === 0
        ? "No text yet"
        : `${words} ${words === 1 ? "word" : "words"} · about ${minutesFor(words)} min read`}
    </p>
  )
}

/**
 * TipTap editor for `richText` / `paragraphsText` fields. The JSON it emits
 * is what the public renderer reads (lib/rich-text/render.tsx); article
 * bodies use it in "full" mode, which also shows the word count. ⌘K opens
 * the link popover (and is kept from the admin ⌘K palette).
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
  const wordCountId = mode === "full" ? `${id}-word-count` : undefined
  const description =
    [describedBy, wordCountId].filter(Boolean).join(" ") || undefined
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
      ...(description ? { "aria-describedby": description } : {}),
      ...(invalid ? { "aria-invalid": "true" } : {}),
      class: "rich-text-content min-h-36 px-3 py-2 outline-none",
    }),
    [id, label, description, invalid]
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

  // Outside changes (reload after a conflict, restore, reset to empty)
  // replace the content.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    if (!value) {
      if (!editor.isEmpty) editor.commands.clearContent(false)
    } else if (!isDeepEqual(editor.getJSON(), value))
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
        "overflow-hidden rounded-lg border border-input bg-background shadow-xs focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        invalid && "border-destructive ring-3 ring-destructive/20"
      )}
    >
      {/* Dimmed when read-only; the word count below stays legible (AA). */}
      <div className={cn(disabled && "opacity-60")}>
        {editor ? (
          <RichTextToolbar
            editor={editor}
            mode={mode}
            editorId={id}
            disabled={disabled}
            linkOpen={linkOpen}
            onLinkOpenChange={setLinkOpen}
          />
        ) : null}
        <RichTextDisabledContext value={!!disabled}>
          <EditorContent editor={editor} />
        </RichTextDisabledContext>
      </div>
      {editor && wordCountId ? (
        <WordCount editor={editor} id={wordCountId} />
      ) : null}
    </div>
  )
}
