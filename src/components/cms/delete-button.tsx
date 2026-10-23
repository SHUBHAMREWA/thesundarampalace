"use client";

import { useActionState } from "react";

import { ActionForm, ActionFeedback, SubmitButton } from "@/components/forms/form-kit";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/server/actions/helpers";
import { idleState } from "@/server/actions/helpers-shared";

/** Destructive action behind a confirmation dialog. */
export function DeleteButton({
  action,
  title,
  description,
  label = "Delete",
  size = "sm",
}: {
  action: (prev: ActionState) => Promise<ActionState>;
  title: string;
  description: string;
  label?: string;
  size?: "sm" | "default";
}) {
  const [state, formAction] = useActionState(action, idleState);
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="ghost" size={size} className="text-danger">
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <ActionForm action={formAction} className="space-y-4">
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <ActionFeedback state={state} />
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <SubmitButton variant="destructive">{label}</SubmitButton>
          </AlertDialogFooter>
        </ActionForm>
      </AlertDialogContent>
    </AlertDialog>
  );
}
