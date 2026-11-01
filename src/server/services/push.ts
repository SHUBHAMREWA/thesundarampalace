import "server-only";

import webpush from "web-push";
import { z } from "zod";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import type { Actor } from "@/server/policies/authorize";

/**
 * Web Push for staff alerts (new enquiry, payment, hold reminders): reaches
 * the CRM on a laptop or the installed app on a phone, even when it is
 * closed. Each device a staff member turns notifications on for is a
 * PushSubscription. Off unless the VAPID keys are set.
 */

export function pushConfigured(): boolean {
  const e = env();
  return Boolean(e.NEXT_PUBLIC_VAPID_PUBLIC_KEY && e.VAPID_PRIVATE_KEY);
}

let configured = false;
function setup(): boolean {
  if (!pushConfigured()) return false;
  if (!configured) {
    const e = env();
    // The "subject" tells push services who to contact: the site's https address
    // (live). It must be https: or mailto:, so a local http address is swapped.
    const subject = e.NEXT_PUBLIC_SITE_URL.startsWith("https://") ? e.NEXT_PUBLIC_SITE_URL : "https://localhost";
    webpush.setVapidDetails(subject, e.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, e.VAPID_PRIVATE_KEY!);
    configured = true;
  }
  return true;
}

export const subscriptionSchema = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
});

/** Saves (or moves to this user) the browser's subscription. */
export async function saveSubscription(actor: Actor, input: unknown, userAgent: string | null) {
  const sub = subscriptionSchema.parse(input);
  const data = {
    userId: actor.id,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
    userAgent: userAgent?.slice(0, 300) ?? null,
  };
  await db.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    update: data,
    create: { endpoint: sub.endpoint, ...data },
  });
}

export async function removeSubscription(actor: Actor, endpoint: string) {
  await db.pushSubscription.deleteMany({ where: { endpoint, userId: actor.id } });
}

export type PushPayload = {
  title: string;
  body?: string;
  /** CRM page to open when the notification is clicked. */
  link?: string;
  /** Same tag replaces an older notification instead of stacking. */
  tag?: string;
};

/**
 * Sends one alert to every device of these (active) staff members. Devices
 * that no longer exist (the push service answers 404/410) are forgotten.
 * Never throws: push is a bonus on top of the in-app notification and email.
 */
export async function pushToUsers(userIds: string[], payload: PushPayload): Promise<number> {
  if (!userIds.length || !setup()) return 0;
  const subs = await db.pushSubscription.findMany({
    where: { userId: { in: userIds }, user: { active: true } },
  });
  const body = JSON.stringify({
    title: payload.title,
    body: payload.body ?? "",
    url: payload.link ?? "/admin",
    tag: payload.tag,
  });
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
          { TTL: 60 * 60 * 24, urgency: "high" },
        );
        sent++;
        await db.pushSubscription.update({ where: { id: s.id }, data: { lastUsedAt: new Date() } });
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await db.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        else console.error("Push failed", status ?? error);
      }
    }),
  );
  return sent;
}
