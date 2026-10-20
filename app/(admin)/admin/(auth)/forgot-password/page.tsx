import type { Metadata } from "next"

import { AuthCard } from "@/components/admin/auth/auth-card"
import { ForgotPasswordForm } from "@/components/admin/auth/forgot-password-form"

export const metadata: Metadata = { title: "Forgot password" }

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Forgot your password?"
      description="We will email you a link to choose a new one."
    >
      <ForgotPasswordForm />
    </AuthCard>
  )
}
