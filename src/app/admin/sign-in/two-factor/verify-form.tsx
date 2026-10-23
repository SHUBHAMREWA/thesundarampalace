"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";
import { navigateAfterAuthChange } from "@/lib/auth/navigate";
import { backupCodeSchema, totpCodeSchema } from "@/lib/validation/auth";

type Mode = "totp" | "backup";

export function VerifyTwoFactorForm() {
  const [mode, setMode] = useState<Mode>("totp");
  const [error, setError] = useState<string | null>(null);
  const form = useForm<{ code: string }>({
    resolver: zodResolver(mode === "totp" ? totpCodeSchema : backupCodeSchema),
    defaultValues: { code: "" },
  });

  async function onSubmit({ code }: { code: string }) {
    setError(null);
    const result =
      mode === "totp"
        ? await authClient.twoFactor.verifyTotp({ code })
        : await authClient.twoFactor.verifyBackupCode({ code });
    if (result.error) {
      setError(
        result.error.status === 429
          ? "Too many attempts. Please wait a few minutes."
          : "That code didn't work. Check the time on your phone and try again.",
      );
      return;
    }
    navigateAfterAuthChange("/admin");
  }

  const submitting = form.formState.isSubmitting;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {error ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{mode === "totp" ? "Authentication code" : "Backup code"}</FormLabel>
              <FormControl>
                <Input
                  inputMode={mode === "totp" ? "numeric" : "text"}
                  autoComplete="one-time-code"
                  autoFocus
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          Verify
        </Button>
        <Button
          type="button"
          variant="link"
          className="w-full"
          onClick={() => {
            setMode(mode === "totp" ? "backup" : "totp");
            form.reset({ code: "" });
            setError(null);
          }}
        >
          {mode === "totp" ? "Use a backup code instead" : "Use the authenticator app instead"}
        </Button>
      </form>
    </Form>
  );
}
