import type { Metadata } from "next";

import { AuthCard } from "@/components/crm/auth-card";

import { VerifyTwoFactorForm } from "./verify-form";

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
