"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import QRCode from "qrcode";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";
import { navigateAfterAuthChange } from "@/lib/auth/navigate";
import { passwordConfirmSchema, totpCodeSchema } from "@/lib/validation/auth";

type Enrollment = { qrDataUrl: string; secret: string; backupCodes: string[] };

export function TwoFactorSetup({ alreadyEnabled, required }: { alreadyEnabled: boolean; required: boolean }) {
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [error, setError] = useState<string | null>(null);

  const passwordForm = useForm<{ password: string }>({
    resolver: zodResolver(passwordConfirmSchema),
    defaultValues: { password: "" },
  });
  const codeForm = useForm<{ code: string }>({
    resolver: zodResolver(totpCodeSchema),
    defaultValues: { code: "" },
  });

  if (alreadyEnabled) {
    return (
      <div className="space-y-4">
        <p className="text-sm">Two-factor authentication is on for your account.</p>
        <Button asChild className="w-full">
          <Link href="/admin">Go to the dashboard</Link>
        </Button>
      </div>
    );
  }

  async function start({ password }: { password: string }) {
    setError(null);
    const { data, error: enableError } = await authClient.twoFactor.enable({ password });
    if (enableError || !data) {
      setError("Password is incorrect.");
      return;
    }
    if (data.method !== "totp") {
      setError("Unexpected two-factor method. Please contact the administrator.");
      return;
    }
    const secret = new URL(data.totpURI).searchParams.get("secret") ?? "";
    setEnrollment({
      qrDataUrl: await QRCode.toDataURL(data.totpURI, { margin: 1, width: 200 }),
      secret,
      backupCodes: data.backupCodes,
    });
  }

  async function confirm({ code }: { code: string }) {
    setError(null);
    const { error: verifyError } = await authClient.twoFactor.verifyTotp({ code });
    if (verifyError) {
      setError("That code didn't work. Check the time on your phone and try again.");
      return;
    }
    navigateAfterAuthChange("/admin");
  }

  if (!enrollment) {
    return (
      <Form {...passwordForm}>
        <form onSubmit={passwordForm.handleSubmit(start)} className="space-y-4" noValidate>
          {required ? (
            <Alert role="status">
              <AlertDescription>
                Your role requires two-factor authentication before you can use the CRM.
              </AlertDescription>
            </Alert>
          ) : null}
          {error ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <FormField
            control={passwordForm.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm your password</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="current-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={passwordForm.formState.isSubmitting}>
            {passwordForm.formState.isSubmitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Continue
          </Button>
        </form>
      </Form>
    );
  }

  return (
    <div className="space-y-6">
      <ol className="list-decimal space-y-2 pl-5 text-sm">
        <li>Scan this code with Google Authenticator, Microsoft Authenticator or a similar app.</li>
        <li>Save the backup codes somewhere safe. Each works once if you lose your phone.</li>
        <li>Enter the 6-digit code the app shows.</li>
      </ol>
      {/* eslint-disable-next-line @next/next/no-img-element -- local data URL, no optimisation needed */}
      <img src={enrollment.qrDataUrl} alt="QR code for your authenticator app" width={200} height={200} className="mx-auto" />
      <p className="text-center text-xs break-all text-text-muted">
        Can&apos;t scan? Enter this key: <span className="font-mono">{enrollment.secret}</span>
      </p>
      <div className="rounded-md border border-border bg-bg p-3">
        <p className="text-sm font-medium">Backup codes</p>
        <ul className="mt-2 grid grid-cols-2 gap-1 font-mono text-sm">
          {enrollment.backupCodes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>
      </div>
      <Form {...codeForm}>
        <form onSubmit={codeForm.handleSubmit(confirm)} className="space-y-4" noValidate>
          {error ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <FormField
            control={codeForm.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Authentication code</FormLabel>
                <FormControl>
                  <Input inputMode="numeric" autoComplete="one-time-code" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={codeForm.formState.isSubmitting}>
            {codeForm.formState.isSubmitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Turn on two-factor authentication
          </Button>
        </form>
      </Form>
    </div>
  );
}
