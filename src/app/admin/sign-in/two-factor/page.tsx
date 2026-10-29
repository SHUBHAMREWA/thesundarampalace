import type { Metadata } from "next";

import { AuthCard } from "@/components/crm/auth-card";

import { VerifyTwoFactorForm } from "./verify-form";

// CRM pages read the session on every request (see src/app/admin/layout.tsx).
export const instant = false;

export const metadata: Metadata = { title: "Two-factor verification" };

export default function TwoFactorPage() {
  return (
    <AuthCard
      title="Two-factor verification"
      description="Enter the 6-digit code from your authenticator app."
    >
      <VerifyTwoFactorForm />
    </AuthCard>
  );
}
