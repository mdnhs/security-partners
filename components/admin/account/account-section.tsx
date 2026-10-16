import { FormCard } from "@/components/admin/form/form-ui"

/** One account panel: a titled card like the editors' field groups. */
export function AccountSection({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <FormCard id={`account-${id}`} title={title} description={description}>
      {children}
    </FormCard>
  )
}
