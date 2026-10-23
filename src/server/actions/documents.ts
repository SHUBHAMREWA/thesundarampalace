"use server";

import { revalidatePath } from "next/cache";

import { deletePreset, generateDocument, parseDocumentRequest, presetSchema, savePreset } from "@/server/services/documents";

import { currentActor, runAction, type ActionState } from "./helpers";

export type GenerateInput = {
  bookingId: string;
  type: string;
  template: string;
  fields: string[];
  sourceId: string | null;
  customNote: string | null;
};

/** Generates and records the document; the client then downloads /api/documents/[id]. */
export async function generateDocumentAction(input: GenerateInput): Promise<ActionState> {
  return runAction(async () => {
    const doc = await generateDocument(await currentActor(), parseDocumentRequest(input));
    revalidatePath(`/admin/bookings/${input.bookingId}`);
    return {
      message: doc.format === "pdf" ? `${doc.reference} generated.` : `${doc.reference} recorded. No PDF renderer is set up, so the copy is the printable page.`,
      data: { id: doc.id, format: doc.format },
    };
  });
}

export async function savePresetAction(input: { name: string; type: string; template: string; fields: string[]; shared: boolean }): Promise<ActionState> {
  return runAction(async () => {
    const preset = await savePreset(await currentActor(), presetSchema.parse(input));
    return { message: `Preset “${preset.name}” saved.`, data: { id: preset.id } };
  });
}

export async function deletePresetAction(id: string): Promise<ActionState> {
  return runAction(async () => {
    await deletePreset(await currentActor(), id);
    return { message: "Preset deleted." };
  });
}
