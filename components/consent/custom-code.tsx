// Owner-only custom code snippets (spec §10, D2.3). React cannot put raw
// HTML into <head>, so each placement gets one inline loader holding a JSON
// payload of the snippets that may run on this page. The loader runs a
// `necessary` snippet at once; an analytics/marketing snippet waits until
// window.__spConsent allows its category (ConsentProvider dispatches the
// "sp:consent" event on every change). HTML goes through
// Range.createContextualFragment (scripts in such a fragment run when
// inserted); a script address becomes <script src async>.
// Keep <CustomCodeSnippets> server-rendered (components/site-extras.tsx):
// the loader runs because it arrives in the HTML; a <script> React creates
// during a client render is never executed, so the snippet would silently
// not run. Do not add "use client" here or render it from client code.

import { CONSENT_EVENT, runnableSnippets } from "@/lib/analytics/snippets"
import type {
  CustomCodeSettings,
  Snippet,
} from "@/lib/schemas/settings/custom-code"

/** A JS literal that cannot close the inline <script> ("<" is escaped). */
const jsLiteral = (value: unknown) =>
  JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")

/**
 * The loader for `snippets` (already route/placement filtered). Only what
 * the browser needs travels: no names, no routes. Each snippet runs at most
 * once per page. The loader itself contains no "<", so nothing in it can
 * end the script element.
 */
export function snippetsLoaderScript(
  snippets: Snippet[],
  placement: "head" | "body"
): string {
  const payload = snippets.map(({ id, category, src, html }) => ({
    id,
    category,
    src,
    html,
  }))
  return `(function(){var S=${jsLiteral(payload)},t=document.${placement},done={};function run(s){done[s.id]=1;if(s.src){var e=document.createElement("script");e.src=s.src;e.async=true;t.appendChild(e)}else{var r=document.createRange();r.selectNodeContents(t);t.appendChild(r.createContextualFragment(s.html))}}function check(){var c=window.__spConsent;S.forEach(function(s){if(!done[s.id]&&(s.category==="necessary"||(c&&c[s.category]===true)))run(s)})}check();window.addEventListener(${jsLiteral(CONSENT_EVENT)},check)})();`
}

export function CustomCodeSnippets({
  settings,
  pathname,
  placement,
}: {
  settings: CustomCodeSettings
  pathname: string
  placement: "head" | "body"
}) {
  const snippets = runnableSnippets(settings, pathname, placement)
  if (snippets.length === 0) return null
  return (
    <script
      id={`sp-custom-code-${placement}`}
      dangerouslySetInnerHTML={{
        __html: snippetsLoaderScript(snippets, placement),
      }}
    />
  )
}
