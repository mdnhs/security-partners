// Owner-only custom code snippets (spec §10, D2.3). React cannot put raw
// HTML into <head>, so each placement gets one inline loader holding a JSON
// payload of its enabled snippets. Right before running one, the loader
// checks location.pathname against the snippet's routes, then its consent:
// a `necessary` snippet needs none; an analytics/marketing snippet waits
// until window.__spConsent allows its category. It re-checks on
// "sp:consent" (ConsentProvider, after each choice) and on "sp:navigate"
// (a client-side navigation, route-change-event.tsx), so a snippet runs
// when the visitor reaches a matching page, and never twice. HTML goes through
// Range.createContextualFragment (scripts in such a fragment run when
// inserted); a script address becomes <script src async>.
// Keep <CustomCodeSnippets> server-rendered (components/site-extras.tsx):
// the loader runs because it arrives in the HTML; a <script> React creates
// during a client render is never executed, so the snippet would silently
// not run. Do not add "use client" here or render it from client code.

import {
  CONSENT_EVENT,
  NAVIGATE_EVENT,
  placementSnippets,
  SNIPPET_RULES_JS,
} from "@/lib/analytics/snippets"
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
 * The loader for `snippets` (one placement). Only what the browser needs
 * travels: id, category, routes, src, html (no names). Each snippet runs at
 * most once per page session. The loader itself contains no "<", so
 * nothing in it can end the script element.
 */
export function snippetsLoaderScript(
  snippets: Snippet[],
  placement: "head" | "body"
): string {
  const payload = snippets.map(({ id, category, routes, src, html }) => ({
    id,
    category,
    routes,
    src,
    html,
  }))
  return `(function(){var S=${jsLiteral(payload)},t=document.${placement},done={};${SNIPPET_RULES_JS}function run(s){done[s.id]=1;if(s.src){var e=document.createElement("script");e.src=s.src;e.async=true;t.appendChild(e)}else{var r=document.createRange();r.selectNodeContents(t);t.appendChild(r.createContextualFragment(s.html))}}function check(){var c=window.__spConsent,path=location.pathname;S.forEach(function(s){if(!done[s.id]&&spRoutesMatch(s.routes,path)&&spAllowed(s,c))run(s)})}check();window.addEventListener(${jsLiteral(CONSENT_EVENT)},check);window.addEventListener(${jsLiteral(NAVIGATE_EVENT)},check)})();`
}

export function CustomCodeSnippets({
  settings,
  placement,
}: {
  settings: CustomCodeSettings
  placement: "head" | "body"
}) {
  const snippets = placementSnippets(settings, placement)
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
