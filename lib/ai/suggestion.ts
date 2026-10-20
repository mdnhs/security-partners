const QUOTE_PAIRS: readonly (readonly [string, string])[] = [
  ['"', '"'],
  ["“", "”"],
  ["'", "'"],
  ["‘", "’"],
]

/**
 * The text "Insert" puts into a field: the reply trimmed, without the one
 * pair of quotes or the single code fence a model sometimes wraps it in.
 */
export function suggestionText(reply: string): string {
  let text = reply.trim()
  const fence = /^```[a-z]*\n([\s\S]*?)\n```$/i.exec(text)
  if (fence) text = fence[1].trim()
  for (const [open, close] of QUOTE_PAIRS) {
    if (text.length < 2 || !text.startsWith(open) || !text.endsWith(close))
      continue
    const inner = text.slice(open.length, text.length - close.length)
    if (!inner.includes(close)) return inner.trim()
  }
  return text
}
