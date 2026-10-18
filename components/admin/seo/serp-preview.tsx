const clip = (text: string, max: number) => {
  const chars = [...text]
  return chars.length > max
    ? `${chars
        .slice(0, max - 1)
        .join("")
        .trimEnd()}…`
    : text
}

/** How the page may look as a search result (title ~60, snippet ~160 chars). */
export function SerpPreview({
  title,
  url,
  description,
}: {
  title: string
  url: string
  description: string
}) {
  return (
    <figure className="flex flex-col gap-1 rounded-xl border bg-background p-4">
      <figcaption className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Search result preview
      </figcaption>
      <p className="truncate text-sm text-muted-foreground">{url}</p>
      <p className="text-lg leading-snug font-medium text-primary">
        {clip(title, 60)}
      </p>
      <p className="line-clamp-2 text-sm text-muted-foreground">
        {clip(description, 160)}
      </p>
    </figure>
  )
}
