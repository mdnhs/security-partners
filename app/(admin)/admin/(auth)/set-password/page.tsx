import type { Metadata } from "next"
import { Suspense } from "react"

import { AuthCard } from "@/components/admin/auth/auth-card"
import { PasswordForm } from "@/components/admin/auth/password-form"

export const metadata: Metadata = { title: "Set your password" }

export default function SetPasswordPage() {
  return (
    <AuthCard
      title="Set your password"
      description="Choose a password to activate your admin account."
    >
      <Suspense fallback={null}>
        <PasswordForm mode="set" />
      </Suspense>
    </AuthCard>
  )
}
