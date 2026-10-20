import type { Metadata } from "next"
import { Suspense } from "react"

import { AuthCard } from "@/components/admin/auth/auth-card"
import { PasswordForm } from "@/components/admin/auth/password-form"

export const metadata: Metadata = { title: "Choose a new password" }

export default function ResetPasswordPage() {
  return (
    <AuthCard
      title="Choose a new password"
      description="Your other sessions will be signed out."
    >
      <Suspense fallback={null}>
        <PasswordForm mode="reset" />
      </Suspense>
    </AuthCard>
  )
}
