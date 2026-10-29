"use client";

import { InlineAction } from "@/components/crm/action-kit";
import { sendRemainingAction } from "@/server/actions/whatsapp";

export function SendRemaining({ count }: { count: number }) {
  return (
    <InlineAction action={sendRemainingAction} variant="outline" size="sm">
      Send {count} waiting now
    </InlineAction>
  );
}
