"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useRef, useState } from "react"
import {
  type DefaultValues,
  type FieldErrors,
  FormProvider,
  get,
  type Path,
  type Resolver,
  set,
  useForm,
} from "react-hook-form"
import type { z } from "zod"

import { SchemaFormContext } from "./context"
import type { EditorMeta } from "./editor-meta"
import { linkErrors } from "./link-rules"
import { fromFormValues, toFormValues } from "./optional-values"
import { GroupWidget } from "./widgets/structure"
import { resolveWidget } from "./resolve-widget"

export type SchemaFormProps<S extends z.ZodObject> = {
  schema: S
  meta: EditorMeta
  value: z.input<S>
  onChange: (value: z.input<S>) => void
  /** Field errors by path ("hero.heading"), e.g. from a 422 or a failed publish check. */
  errors?: Record<string, string[]>
  disabled?: boolean
  /** Change it to load `value` again (reload after a conflict, restore). */
  resetKey?: string | number
  idPrefix?: string
}

/**
 * The Zod schema plus the editor's link rules (link-rules.ts): unknown
 * {placeholders} and non-URL whole placeholders are reported on the field
 * like any schema error. Validates the values SchemaForm emits (cleared
 * optionals dropped, see optional-values.ts).
 */
function withLinkRules<S extends z.ZodObject>(
  schema: S
): Resolver<z.input<S>, unknown, z.output<S>> {
  // zodResolver's overloads cannot see through the generic S; the
  // runtime types are exactly <input<S>, unknown, output<S>>.
  const zod = zodResolver(schema) as unknown as Resolver<
    z.input<S>,
    unknown,
    z.output<S>
  >
  return async (formValues, context, options) => {
    const values = fromFormValues(schema, formValues)
    const result = await zod(values, context, options)
    const problems = linkErrors(schema, values)
    if (!problems.length) return result
    const errors = { ...result.errors } as FieldErrors<z.input<S>>
    for (const [path, message] of problems)
      if (!get(errors, path)) set(errors, path, { type: "link", message })
    return { values: {}, errors }
  }
}

/**
 * Renders a form for any template/settings/collection Zod schema with
 * widgets chosen from the schema and `meta` (spec §8.2). react-hook-form
 * holds the field state; the same Zod schema validates here (zodResolver,
 * on blur then on change) and on the server.
 */
export function SchemaForm<S extends z.ZodObject>({
  schema,
  meta,
  value,
  onChange,
  errors,
  disabled = false,
  resetKey,
  idPrefix = "sf",
}: SchemaFormProps<S>) {
  const [defaults] = useState(() => toFormValues(schema, value))
  const form = useForm<z.input<S>, unknown, z.output<S>>({
    resolver: withLinkRules(schema),
    defaultValues: defaults as DefaultValues<z.input<S>>,
    mode: "onTouched",
  })
  const onChangeRef = useRef(onChange)
  const valueRef = useRef(value)
  const schemaRef = useRef(schema)
  useEffect(() => {
    onChangeRef.current = onChange
    valueRef.current = value
    schemaRef.current = schema
  })

  useEffect(
    () =>
      form.subscribe({
        formState: { values: true },
        callback: ({ values }) =>
          onChangeRef.current(fromFormValues(schemaRef.current, values)),
      }),
    [form]
  )

  const firstReset = useRef(true)
  useEffect(() => {
    if (firstReset.current) {
      firstReset.current = false
      return
    }
    form.reset(
      toFormValues(schemaRef.current, valueRef.current) as DefaultValues<
        z.input<S>
      >
    )
  }, [form, resetKey])

  useEffect(() => {
    if (!errors) return
    for (const [path, messages] of Object.entries(errors)) {
      if (!messages[0]) continue
      form.setError((path === "_root" ? "root" : path) as Path<z.input<S>>, {
        type: "server",
        message: messages[0],
      })
    }
  }, [form, errors])

  const root = resolveWidget(schema, {}, "", "")
  return (
    <FormProvider {...form}>
      <SchemaFormContext.Provider value={{ meta, disabled, idPrefix }}>
        <form noValidate onSubmit={(event) => event.preventDefault()}>
          <GroupWidget field={root} path="" />
        </form>
      </SchemaFormContext.Provider>
    </FormProvider>
  )
}
