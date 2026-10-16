"use client"

import type { ComponentType } from "react"
import type { z } from "zod"

import { useSchemaForm, type WidgetProps } from "./context"
import { metaFor, type WidgetKind } from "./editor-meta"
import { resolveWidget } from "./resolve-widget"
import {
  NumberWidget,
  SelectWidget,
  TextareaWidget,
  TextWidget,
  ToggleWidget,
} from "./widgets/basic"
import {
  CollectionWidget,
  LinkWidget,
  MediaWidget,
  RichTextWidget,
} from "./widgets/pickers"
import { GroupWidget } from "./widgets/group"
import { ListWidget } from "./widgets/list"

export const WIDGETS: Record<WidgetKind, ComponentType<WidgetProps>> = {
  text: TextWidget,
  textarea: TextareaWidget,
  richText: RichTextWidget,
  link: LinkWidget,
  media: MediaWidget,
  number: NumberWidget,
  toggle: ToggleWidget,
  select: SelectWidget,
  list: ListWidget,
  group: GroupWidget,
  collection: CollectionWidget,
}

/** Renders the widget for one schema node at `path` (recursive via group/list). */
export function Field({
  schema,
  name,
  path,
}: {
  schema: z.ZodType
  /** Key or list position, used for the default label. */
  name: string
  path: string
}) {
  const { meta } = useSchemaForm()
  const field = resolveWidget(schema, metaFor(meta, path), name, path)
  const Widget = WIDGETS[field.kind]
  return <Widget field={field} path={path} />
}
