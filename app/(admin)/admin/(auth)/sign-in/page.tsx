import type { Metadata } from "next"
import { Suspense } from "react"

import { AuthCard } from "@/components/admin/auth/auth-card"
import { SignInForm } from "@/components/admin/auth/sign-in-form"

export const metadata: Metadata = { title: "Sign in" }

export default function SignInPage() {
  return (
    <AuthCard
      title="Sign in"
      description="Use your Security Partners admin account."
    >
      <Suspense fallback={null}>
        <SignInForm />
      </Suspense>
    </AuthCard>
  )
}
