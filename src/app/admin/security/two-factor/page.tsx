import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthCard } from "@/components/crm/auth-card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/server/auth/session";

import { TwoFactorSetup } from "./two-factor-setup";

export const metadata: Metadata = { title: "Set up two-factor authentication" };

async function SetupForUser() {
  const user = await requireUser({ allowMissing2fa: true });
  return <TwoFactorSetup alreadyEnabled={user.twoFactorEnabled} required={user.requires2fa} />;
}

export default function TwoFactorSetupPage() {
  return (
    <AuthCard
      title="Two-factor authentication"
      description="Protects accounts that can see financial and customer data."
    >
      <Suspense fallback={<Skeleton className="h-40 w-full" />}>
        <SetupForUser />
      </Suspense>
    </AuthCard>
  );
}
