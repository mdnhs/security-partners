import { draftMode } from "next/headers"

/**
 * Admin-only bar while previewing drafts (spec §5.6; global constraint:
 * the one allowed addition to public pages). Renders nothing outside
 * draft mode, so the public markup is unchanged.
 */
export async function PreviewBar() {
  const { isEnabled } = await draftMode()
  if (!isEnabled) return null
  return (
    <div
      role="region"
      aria-label="Preview"
      style={{
        position: "fixed",
        insetInline: 0,
        bottom: 0,
        zIndex: 2147483000,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
        padding: "10px 16px",
        background: "#0d1b36",
        color: "#fff",
        font: "600 14px/1.4 system-ui, sans-serif",
        boxShadow: "0 -4px 16px rgb(0 0 0 / 0.25)",
      }}
    >
      <span>Preview: you are seeing unpublished changes.</span>
      {/* GET form, never <Link>: prefetching would leave preview (notes §4). */}
      <form method="GET" action="/api/v1/preview/exit">
        <button
          type="submit"
          style={{
            border: "1px solid rgb(255 255 255 / 0.6)",
            borderRadius: "999px",
            padding: "4px 14px",
            background: "transparent",
            color: "#fff",
            font: "inherit",
            cursor: "pointer",
          }}
        >
          Exit preview
        </button>
      </form>
    </div>
  )
}
