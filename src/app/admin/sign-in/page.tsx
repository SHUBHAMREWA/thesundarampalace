import type { Metadata } from "next";

import { AuthCard } from "@/components/crm/auth-card";

import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <AuthCard title="Staff sign in" description="For The Sundaram Palace team only.">
      <SignInForm />
    </AuthCard>
  );
}
