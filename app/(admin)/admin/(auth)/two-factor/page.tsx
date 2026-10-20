import type { Metadata } from "next"
import { Suspense } from "react"

import { AuthCard } from "@/components/admin/auth/auth-card"
import { TwoFactorForm } from "@/components/admin/auth/two-factor-form"

export const metadata: Metadata = { title: "Two-factor authentication" }

export default function TwoFactorPage() {
  return (
    <AuthCard
      title="Two-factor authentication"
      description="One more step: confirm it is you."
    >
      <Suspense fallback={null}>
        <TwoFactorForm />
      </Suspense>
    </AuthCard>
  )
}
