import { QueryClientProvider } from "@tanstack/react-query"
import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useEffect } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/pages/home",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import {
  AssistantProvider,
  useAssistant,
} from "@/components/admin/ai/assistant-context"
import { VersionedEditor } from "@/components/admin/editor/versioned-editor"
import { makeQueryClient } from "@/components/admin/providers"
import {
  type AdminSession,
  AdminSessionProvider,
} from "@/components/admin/session-provider"
import type { EditorMeta } from "@/components/admin/schema-form/editor-meta"
import {
  type FocusedTextField,
  SchemaForm,
} from "@/components/admin/schema-form/schema-form"
import type { VersionedDto } from "@/lib/schemas/api/content"

const schema = z.object({
  hero: z.object({
    heading: z.string().min(1).max(80),
    subheading: z.string().max(300),
    visible: z.boolean(),
  }),
})
type Hero = z.input<typeof schema>
const meta: EditorMeta = {
  fields: { "hero.heading": { label: "Main heading" } },
}
const value: Hero = {
  hero: { heading: "Old heading", subheading: "Old sub", visible: true },
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({ items: [], page: 1, pageSize: 20, total: 0 })
    )
  )
})

describe("SchemaForm focused-field API (master 9.2: Insert via SchemaForm)", () => {
  it("reports the focused text field; read and setValue go through the form", async () => {
    const onChange = vi.fn()
    const onFieldFocus = vi.fn<(field: FocusedTextField) => void>()
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <SchemaForm
          schema={schema}
          meta={meta}
          value={value}
          onChange={onChange}
          onFieldFocus={onFieldFocus}
        />
      </QueryClientProvider>
    )
    await user.click(screen.getByLabelText("Main heading"))
    expect(onFieldFocus).toHaveBeenCalledTimes(1)
    const field = onFieldFocus.mock.calls[0][0]
    expect(field).toMatchObject({
      path: "hero.heading",
      label: "Main heading",
      maxLength: 80,
      multiline: false,
      elementId: "sf-hero-heading",
    })
    expect(field.read()).toBe("Old heading")

    act(() => field.setValue("Safer nights"))
    expect(screen.getByLabelText("Main heading")).toHaveValue("Safer nights")
    expect(field.read()).toBe("Safer nights")
    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          hero: expect.objectContaining({ heading: "Safer nights" }),
        })
      )
    )

    await user.click(screen.getByLabelText("Subheading"))
    expect(onFieldFocus).toHaveBeenLastCalledWith(
      expect.objectContaining({
        path: "hero.subheading",
        maxLength: 300,
        multiline: true,
      })
    )
    // A switch is not a text field.
    await user.click(screen.getByRole("switch"))
    expect(onFieldFocus).toHaveBeenCalledTimes(2)
  })
})

const SESSION: AdminSession = {
  user: {
    id: "u1",
    name: "Olive Owner",
    email: "o@example.test",
    title: null,
    twoFactorEnabled: true,
  },
  roles: ["owner"],
  impersonatedBy: null,
}

describe("SchemaForm setValue when the field is gone (fix round 1)", () => {
  it("returns false and sets nothing once the list item no longer exists", async () => {
    const listSchema = z.object({ highlights: z.array(z.string().max(40)) })
    const onFieldFocus = vi.fn<(field: FocusedTextField) => void>()
    const onChange = vi.fn()
    const ui = (highlights: string[], resetKey: number) => (
      <QueryClientProvider client={makeQueryClient()}>
        <SchemaForm
          schema={listSchema}
          meta={{ fields: {} }}
          value={{ highlights }}
          onChange={onChange}
          resetKey={resetKey}
          onFieldFocus={onFieldFocus}
        />
      </QueryClientProvider>
    )
    const view = render(ui(["One", "Two"], 0))
    act(() => document.getElementById("sf-highlights-1")!.focus())
    const field = onFieldFocus.mock.calls.at(-1)![0]
    expect(field.path).toBe("highlights.1")
    view.rerender(ui(["One"], 1))
    await waitFor(() =>
      expect(document.getElementById("sf-highlights-1")).toBeNull()
    )
    let result: boolean | undefined
    act(() => {
      result = field.setValue("Three")
    })
    expect(result).toBe(false)
    expect(field.read()).toBe("")
  })
})

type Dto = VersionedDto<Hero>
const dto = (version: number, heading: string): Dto => ({
  draft: { hero: { ...value.hero, heading } },
  published: value,
  version,
  status: "published",
  dirty: heading !== value.hero.heading,
  publishedAt: "2026-10-16T09:00:00.000Z",
  updatedAt: "2026-10-16T10:00:00.000Z",
  updatedBy: null,
})

let assistant: ReturnType<typeof useAssistant> | null = null
function Probe() {
  const current = useAssistant()
  useEffect(() => {
    assistant = current
  })
  return null
}

function Editor({
  canEdit = true,
  saveDraft,
}: {
  canEdit?: boolean
  saveDraft: (draft: unknown, version: number) => Promise<Dto>
}) {
  // Real VersionedEditor reads the session (live preview per user).
  return (
    <AdminSessionProvider value={SESSION}>
      <VersionedEditor<Dto>
        title="Home page"
        queryKey={["pages", "home"]}
        load={async () => dto(1, "Old heading")}
        saveDraft={saveDraft}
        publish={vi.fn()}
        restore={vi.fn()}
        schema={schema}
        meta={meta}
        revisions={{ entity: "page", id: "home" }}
        canEdit={canEdit}
        canPublish={false}
      />
    </AdminSessionProvider>
  )
}

describe("VersionedEditor shares the open record with the assistant", () => {
  it("registers the live draft; Insert autosaves like typing; unmount clears", async () => {
    assistant = null
    const saveDraft = vi.fn(async (draft: unknown, version: number) =>
      dto(version + 1, (draft as Hero).hero.heading)
    )
    const client = makeQueryClient()
    const view = render(
      <QueryClientProvider client={client}>
        <AssistantProvider>
          <Probe />
          <Editor saveDraft={saveDraft} />
        </AssistantProvider>
      </QueryClientProvider>
    )
    const input = await screen.findByLabelText("Main heading")
    await waitFor(() =>
      expect(assistant!.screen).toEqual({
        title: "Home page",
        entityType: "page",
      })
    )
    expect(assistant!.snapshot()).toEqual({
      title: "Home page",
      entityType: "page",
      entityId: "home",
      record: {
        hero: { heading: "Old heading", subheading: "Old sub", visible: true },
      },
    })

    // Focus without typing (no keydown/pointerdown): only Insert edits.
    act(() => input.focus())
    await waitFor(() =>
      expect(assistant!.field).toMatchObject({
        path: "hero.heading",
        label: "Main heading",
        maxLength: 80,
      })
    )
    act(() => assistant!.field!.apply("From the assistant"))
    expect(input).toHaveValue("From the assistant")
    await waitFor(
      () =>
        expect(saveDraft).toHaveBeenCalledWith(
          expect.objectContaining({
            hero: expect.objectContaining({ heading: "From the assistant" }),
          }),
          1
        ),
      { timeout: 4000 }
    )
    expect(assistant!.snapshot()?.record).toMatchObject({
      hero: { heading: "From the assistant" },
    })

    view.rerender(
      <QueryClientProvider client={client}>
        <AssistantProvider>
          <Probe />
        </AssistantProvider>
      </QueryClientProvider>
    )
    await waitFor(() => expect(assistant!.screen).toBeNull())
    expect(assistant!.snapshot()).toBeNull()
    expect(assistant!.field).toBeNull()
  })

  it("a read-only editor shares the record but offers no field to insert into", async () => {
    assistant = null
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <AssistantProvider>
          <Probe />
          <Editor canEdit={false} saveDraft={vi.fn()} />
        </AssistantProvider>
      </QueryClientProvider>
    )
    const input = await screen.findByLabelText("Main heading")
    act(() => input.focus())
    await waitFor(() => expect(assistant!.screen?.title).toBe("Home page"))
    expect(assistant!.field).toBeNull()
  })

  it("does nothing outside the provider (editor DOM tests without the shell)", async () => {
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <Editor saveDraft={vi.fn()} />
      </QueryClientProvider>
    )
    const input = await screen.findByLabelText("Main heading")
    act(() => input.focus())
    expect(input).toHaveValue("Old heading")
  })
})
