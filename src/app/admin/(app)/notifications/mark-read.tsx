"use client";

import { useActionState } from "react";

import { ActionForm, SubmitButton } from "@/components/forms/form-kit";
import { markNotificationsReadAction } from "@/server/actions/notifications";
import { idleState } from "@/server/actions/helpers-shared";

export function MarkReadButton({ notificationId, label }: { notificationId: string | null; label: string }) {
  const [, action] = useActionState(markNotificationsReadAction.bind(null, notificationId), idleState);
  return (
    <ActionForm action={action}>
      <SubmitButton size="sm" variant="ghost">
        {label}
      </SubmitButton>
    </ActionForm>
  );
}
