"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { CircleAlert } from "lucide-react"
import { type FocusEvent, useEffect, useMemo, useRef, useState } from "react"
import {
  type DefaultValues,
  FormProvider,
  type Path,
  type Resolver,
  useForm,
  useFormState,
} from "react-hook-form"
import type { z } from "zod"

import { Alert, AlertDescription } from "@/components/ui/alert"

import { SchemaFormContext } from "./context"
import type { EditorMeta } from "./editor-meta"
import { insertableTextField, stringMaxLength } from "./field-at-path"
import { FormTabs, formTabs } from "./form-tabs"
import { fromFormValues, toFormValues } from "./optional-values"
import { hasRequiredField, resolveWidget } from "./resolve-widget"
import { GroupWidget } from "./widgets/group"

/** The text field the user focused (AI assistant "Insert", spec §8.3). */
export type FocusedTextField = {
  /** react-hook-form path, e.g. "hero.heading". */
  path: string
  label: string
  maxLength: number | null
  /** DOM id of the input. */
  elementId: string
  read: () => string
  /** Sets the value as if typed: dirty, touched, validated, emitted through onChange. */
  setValue: (text: string) => void
}

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
  /**
   * Show the top-level groups as section tabs (labelled by this text) when
   * there are at least two; fields of hidden tabs stay mounted.
   */
  sectionTabs?: string
  /** Called when a plain text field (text or textarea widget) gains focus. */
  onFieldFocus?: (field: FocusedTextField) => void
}

/**
 * zodResolver over the values SchemaForm emits (cleared optionals dropped,
 * see optional-values.ts). The `link` schema itself carries the placeholder
 * rules, so client and server report the same errors.
 */
function emittedValuesResolver<S extends z.ZodObject>(
  schema: S
): Resolver<z.input<S>, unknown, z.output<S>> {
  // zodResolver's overloads cannot see through the generic S; the
  // runtime types are exactly <input<S>, unknown, output<S>>.
  const zod = zodResolver(schema) as unknown as Resolver<
    z.input<S>,
    unknown,
    z.output<S>
  >
  return (values, context, options) =>
    zod(fromFormValues(schema, values), context, options)
}

/** Errors on the whole form (server `_root`), shown above the fields. */
function FormRootError({ id }: { id: string }) {
  const { errors } = useFormState()
  const message = errors.root?.message
  if (!message) return null
  return (
    <Alert variant="destructive" id={id} className="mb-6">
      <CircleAlert aria-hidden />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
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
  sectionTabs,
  onFieldFocus,
}: SchemaFormProps<S>) {
  const [defaults] = useState(() => toFormValues(schema, value))
  const resolver = useMemo(() => emittedValuesResolver(schema), [schema])
  const form = useForm<z.input<S>, unknown, z.output<S>>({
    resolver,
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

  // Server errors: apply the new set, clear the ones that went away.
  const appliedErrors = useRef<string[]>([])
  useEffect(() => {
    const next = Object.entries(errors ?? {})
      .filter(([, messages]) => messages[0])
      .map(([path, messages]) => ({
        name: (path === "_root" ? "root" : path) as Path<z.input<S>>,
        message: messages[0],
      }))
    const names = new Set<string>(next.map((e) => e.name))
    for (const name of appliedErrors.current)
      if (!names.has(name)) form.clearErrors(name as Path<z.input<S>>)
    for (const { name, message } of next)
      form.setError(name, { type: "server", message })
    appliedErrors.current = [...names]
  }, [form, errors])

  const context = useMemo(
    () => ({ meta, disabled, idPrefix }),
    [meta, disabled, idPrefix]
  )
  // The field tree only depends on the schema (and the context above);
  // re-rendering SchemaForm per keystroke must not re-render every widget.
  const tabs = useMemo(
    () => (sectionTabs ? formTabs(schema, meta) : []),
    [sectionTabs, schema, meta]
  )
  const requiredNote = useMemo(() => hasRequiredField(schema), [schema])
  const tree = useMemo(
    () => <GroupWidget field={resolveWidget(schema, {}, "", "")} path="" />,
    [schema]
  )
  // Ids are fieldId(idPrefix, path): "sf-hero-heading" ← "hero.heading".
  const handleFocus = (event: FocusEvent<HTMLFormElement>) => {
    if (!onFieldFocus) return
    const target = event.target
    if (
      !(target instanceof HTMLInputElement) &&
      !(target instanceof HTMLTextAreaElement)
    )
      return
    const prefix = `${idPrefix}-`
    if (!target.id.startsWith(prefix)) return
    const path = target.id.slice(prefix.length).replaceAll("-", ".")
    const field = insertableTextField(schema, meta, path)
    if (!field) return
    const name = path as Path<z.input<S>>
    onFieldFocus({
      path,
      label: field.label,
      maxLength: field.meta.maxLength ?? stringMaxLength(field.schema),
      elementId: target.id,
      read: () => {
        const current: unknown = form.getValues(name)
        return typeof current === "string" ? current : ""
      },
      setValue: (text) =>
        form.setValue(name, text as never, {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        }),
    })
  }
  return (
    <FormProvider {...form}>
      <SchemaFormContext.Provider value={context}>
        <form
          noValidate
          onSubmit={(event) => event.preventDefault()}
          onFocusCapture={handleFocus}
        >
          {/* WCAG 3.3.2: required is the default, said once (JW). */}
          {requiredNote ? (
            <p className="mb-4 text-xs text-muted-foreground">
              All fields are required unless marked optional.
            </p>
          ) : null}
          <FormRootError id={`${idPrefix}-root-error`} />
          {sectionTabs && tabs.length > 1 ? (
            <FormTabs
              tabs={tabs}
              schema={schema}
              ariaLabel={sectionTabs}
              errors={errors}
            />
          ) : (
            tree
          )}
        </form>
      </SchemaFormContext.Provider>
    </FormProvider>
  )
}
