import { buttonClassName } from "@/components/ui/button"

/**
 * Body of a /newsletter/[state] page, in the legal pages' reading column.
 * The button pages (confirm, unsubscribe) are a plain POST form: no script,
 * no autofocus, nothing submits without a person's click. The API never
 * confirms or unsubscribes on a GET, so a link scanner fetching or
 * rendering this page changes nothing.
 */
export function NewsletterStateBody({
  body,
  button,
  action,
  token = "",
}: {
  body: string
  button?: string
  /** The endpoint the button POSTs the token to; null renders no form. */
  action: string | null
  token?: string
}) {
  return (
    <article className="mx-auto flex max-w-[820px] min-w-0 flex-col items-start gap-[22px]">
      <p className="text-lg leading-[1.75] text-[#3b4556]">{body}</p>
      {action && (
        <form method="post" action={action}>
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            className={buttonClassName({ variant: "brand", size: "pill" })}
          >
            {button}
          </button>
        </form>
      )}
    </article>
  )
}
