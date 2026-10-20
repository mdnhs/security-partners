import { jsonLdText } from "@/lib/seo/json-ld"

/** schema.org structured data (invisible; content cannot close the script). */
export function JsonLd({ data }: { data: object | object[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdText(data) }}
    />
  )
}
