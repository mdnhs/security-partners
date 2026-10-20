import { Fragment } from "react"

/**
 * A visitor's message as lines joined by <br />: the HTML part keeps its
 * layout and the plain-text part (html-to-text) keeps the line breaks.
 */
export function MessageLines({ text }: { text: string }) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n")
  return (
    <>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 ? <br /> : null}
          {line}
        </Fragment>
      ))}
    </>
  )
}
