import { CircleAlert, CircleCheck } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"

export function FormError({ children }: { children: React.ReactNode }) {
  return (
    <Alert variant="destructive">
      <CircleAlert aria-hidden />
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  )
}

export function FormNotice({ children }: { children: React.ReactNode }) {
  return (
    <Alert role="status">
      <CircleCheck aria-hidden />
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  )
}
