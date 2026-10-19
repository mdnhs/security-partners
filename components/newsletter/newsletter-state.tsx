import { buttonClassName } from "@/components/ui/button"
import {
  NEWSLETTER_UNSUBSCRIBE_ENDPOINT,
  type NewsletterState,
} from "@/lib/newsletter/placement"

/**
 * Body of a /newsletter/[state] page, in the legal pages' reading column.
 * "unsubscribe" is the button page: a plain POST form (works without JS),
 * because the API never unsubscribes on a GET (link scanners).
 */
export function NewsletterStateBody({
  state,
  body,
  button,
  token = "",
}: {
  state: NewsletterState
  body: string
  button?: string
  token?: string
}) {
  return (
    <article className="mx-auto flex max-w-[820px] min-w-0 flex-col items-start gap-[22px]">
      <p className="text-lg leading-[1.75] text-[#3b4556]">{body}</p>
      {state === "unsubscribe" && (
        <form method="post" action={NEWSLETTER_UNSUBSCRIBE_ENDPOINT}>
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
