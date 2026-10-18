import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { CustomCode, customCodeScript } from "@/components/consent/custom-code"

describe("custom code loader", () => {
  it("renders nothing for empty code", () => {
    const { container } = render(<CustomCode html="  " target="body" />)
    expect(container.innerHTML).toBe("")
  })

  it("cannot close its own <script>, and appends the snippet to the target", () => {
    const html =
      '<meta name="x-e2e" content="1"></script><p id="custom-p">hi</p>'
    const script = customCodeScript(html, "body")
    expect(script).not.toContain("</script>")
    new Function(script)()
    expect(document.getElementById("custom-p")?.textContent).toBe("hi")
    new Function(customCodeScript('<meta name="x-head" content="2">', "head"))()
    expect(document.head.querySelector('meta[name="x-head"]')).not.toBeNull()
  })
})
