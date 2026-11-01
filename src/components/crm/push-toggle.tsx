"use client";

import { BellOff, BellRing, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type State = "loading" | "unsupported" | "ios-install" | "blocked" | "off" | "on";

/** The VAPID public key (base64url) as the bytes the browser expects. */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isInstalled = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/**
 * Turns notifications on or off for THIS device (phone, tablet or laptop).
 * New enquiries and other staff alerts then pop up even when the CRM is closed.
 */
export function PushToggle({ publicKey }: { publicKey: string | null }) {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const supported =
        "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!publicKey || !supported) {
        // iPhones only allow notifications for apps added to the home screen.
        setState(isIos() && !isInstalled() ? "ios-install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") return setState("blocked");
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, [publicKey]);

  async function turnOn() {
    if (!publicKey) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }
      const reg =
        (await navigator.serviceWorker.getRegistration("/")) ??
        (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes(publicKey),
        }));
      const response = await fetch("/api/push/subscription", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!response.ok) throw new Error("Could not save this device.");
      setState("on");
      toast.success("Notifications are on for this device.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not turn notifications on.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscription", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("off");
      toast.success("Notifications are off for this device.");
    } finally {
      setBusy(false);
    }
  }

  const note: Record<State, string> = {
    loading: "Checking this device…",
    unsupported: publicKey
      ? "This browser can not show notifications. Use Chrome, Edge, Firefox or Safari."
      : "Notifications are not set up on the server yet (VAPID keys).",
    "ios-install":
      "On iPhone/iPad: tap Share → Add to Home Screen, open the CRM from there, then turn notifications on.",
    blocked:
      "Notifications are blocked for this site. Allow them in the browser's site settings, then reload.",
    off: "Get a pop-up on this device for new enquiries, payments and hold reminders — even when the CRM is closed.",
    on: "This device gets a pop-up for new enquiries, payments and hold reminders.",
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        {state === "on" ? (
          <BellRing className="mt-0.5 size-5 text-success" aria-hidden="true" />
        ) : (
          <BellOff className="mt-0.5 size-5 text-text-muted" aria-hidden="true" />
        )}
        <div>
          <p className="font-medium">
            Notifications on this device:{" "}
            {state === "on" ? "On" : state === "loading" ? "…" : "Off"}
          </p>
          <p className="text-sm text-text-muted">{note[state]}</p>
        </div>
      </div>
      {state === "on" ? (
        <Button type="button" variant="outline" onClick={turnOff} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : null} Turn off
        </Button>
      ) : state === "off" ? (
        <Button type="button" onClick={turnOn} disabled={busy}>
          {busy ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <BellRing aria-hidden="true" />
          )}{" "}
          Turn on
        </Button>
      ) : null}
    </div>
  );
}
