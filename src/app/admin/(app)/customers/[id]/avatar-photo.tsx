"use client";

import { Camera, Loader2, Trash2 } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { ImageViewer } from "@/components/crm/image-viewer";
import { PersonAvatar } from "@/components/crm/person-avatar";
import { compressToWebp } from "@/lib/media/to-webp";
import { idleState } from "@/server/actions/helpers-shared";
import type { ActionState } from "@/server/actions/helpers";

/**
 * The profile avatar with "change photo" and "remove photo" buttons. The
 * chosen photo is compressed to WebP in the browser and saved at once; the
 * server deletes the previous photo from Cloudinary.
 */
export function AvatarPhoto({
  name,
  photoUrl,
  hasOwnPhoto,
  action,
}: {
  name: string;
  photoUrl: string | null;
  /** True when the avatar shows the saved profile photo (not a fallback from documents). */
  hasOwnPhoto: boolean;
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
}) {
  const [state, run, pending] = useActionState(action, idleState);
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preparing, setPreparing] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!state.at) return;
    if (state.ok) toast.success(state.message ?? "Photo saved.");
    else
      toast.error(
        state.fieldErrors?.photo ??
          state.message ??
          "The photo could not be saved.",
      );
  }, [state]);

  async function choose(input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    setPreparing(true);
    try {
      const webp = await compressToWebp(file, "avatar");
      setPreview(URL.createObjectURL(webp));
      const transfer = new DataTransfer();
      transfer.items.add(webp);
      const hidden = formRef.current!.elements.namedItem(
        "photo",
      ) as HTMLInputElement;
      hidden.files = transfer.files;
      (
        formRef.current!.elements.namedItem("removePhoto") as HTMLInputElement
      ).value = "";
      formRef.current!.requestSubmit();
    } catch {
      toast.error("This photo could not be read. Try another one.");
    } finally {
      setPreparing(false);
    }
  }

  function remove() {
    (
      formRef.current!.elements.namedItem("removePhoto") as HTMLInputElement
    ).value = "true";
    const hidden = formRef.current!.elements.namedItem(
      "photo",
    ) as HTMLInputElement;
    hidden.value = "";
    formRef.current!.requestSubmit();
  }

  const busy = pending || preparing;
  return (
    <form ref={formRef} action={run} className="relative w-fit shrink-0">
      {/* The local preview shows only while saving; afterwards the page shows the saved photo. */}
      {photoUrl && !pending ? (
        <ImageViewer
          src={photoUrl}
          title={name}
          label={`Open ${name}'s photo`}
          className="rounded-full"
        >
          <PersonAvatar name={name} photoUrl={photoUrl} size="xl" />
        </ImageViewer>
      ) : (
        <PersonAvatar
          name={name}
          photoUrl={pending && preview ? preview : photoUrl}
          size="xl"
        />
      )}
      {busy ? (
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-text/40 text-primary-foreground">
          <Loader2 className="size-6 animate-spin" aria-hidden="true" />
          <span className="sr-only">Saving photo…</span>
        </span>
      ) : null}
      <input type="file" name="photo" hidden />
      <input type="hidden" name="removePhoto" defaultValue="" />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => choose(e.currentTarget)}
      />
      <div className="absolute -right-1 bottom-0 flex gap-1">
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="inline-flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-card)] ring-2 ring-surface hover:bg-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-60"
          aria-label={hasOwnPhoto ? "Change photo" : "Add photo"}
          title={hasOwnPhoto ? "Change photo" : "Add photo"}
        >
          <Camera className="size-4" aria-hidden="true" />
        </button>
        {hasOwnPhoto ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (
                window.confirm(
                  "Remove this photo? It is also deleted from Cloudinary.",
                )
              )
                remove();
            }}
            className="inline-flex size-8 items-center justify-center rounded-full bg-surface text-danger shadow-[var(--shadow-card)] ring-2 ring-surface hover:bg-danger/10 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-60"
            aria-label="Remove photo"
            title="Remove photo"
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </form>
  );
}
