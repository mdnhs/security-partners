// Owner-only custom code (spec §10). React cannot put raw HTML into
// <head>, so the snippet travels as a JSON string inside one inline
// loader that parses it with Range.createContextualFragment (scripts in
// such a fragment run when inserted) and appends it to <head> or <body>.

/** The loader script; the snippet cannot close it ("<" is escaped). */
export function customCodeScript(html: string, target: "head" | "body") {
  const literal = JSON.stringify(html)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")
  return `(function(){var t=document.${target},r=document.createRange();r.selectNodeContents(t);t.appendChild(r.createContextualFragment(${literal}))})();`
}

export function CustomCode({
  html,
  target,
}: {
  html: string
  target: "head" | "body"
}) {
  if (html.trim() === "") return null
  return (
    <script
      id={`sp-custom-code-${target}`}
      dangerouslySetInnerHTML={{ __html: customCodeScript(html, target) }}
    />
  )
}
