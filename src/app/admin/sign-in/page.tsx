import type { Metadata } from "next";

import { AuthCard } from "@/components/crm/auth-card";
import { syncEnvAdmin } from "@/server/auth/sync-env-admin";

import { SignInForm } from "./sign-in-form";

// CRM pages read the session on every request (see src/app/admin/layout.tsx).
export const instant = false;

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage() {
  await syncEnvAdmin();

  return (
    <AuthCard title="Staff sign in" description="For The Sundaram Palace team only.">
      <SignInForm />
    </AuthCard>
  );
}
