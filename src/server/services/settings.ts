import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  DEFAULT_SETTINGS,
  SETTINGS_SECTIONS,
  type SettingsSection,
  type SettingsSectionKey,
} from "@/lib/settings/schemas";

/**
 * Reads one settings section. Stored values are layered over the defaults, so
 * sections gain new fields without a data migration; invalid data falls back
 * to the defaults rather than breaking the site.
 */
export async function getSettings<K extends SettingsSectionKey>(key: K): Promise<SettingsSection<K>> {
  const row = await db.siteSetting.findUnique({ where: { key } });
  const stored = row?.value && typeof row.value === "object" ? (row.value as object) : {};
  const parsed = SETTINGS_SECTIONS[key].safeParse({ ...DEFAULT_SETTINGS[key], ...stored });
  return (parsed.success ? parsed.data : DEFAULT_SETTINGS[key]) as SettingsSection<K>;
}

export async function getAllSettings(): Promise<{ [K in SettingsSectionKey]: SettingsSection<K> }> {
  const keys = Object.keys(SETTINGS_SECTIONS) as SettingsSectionKey[];
  const entries = await Promise.all(keys.map(async (key) => [key, await getSettings(key)] as const));
  return Object.fromEntries(entries) as { [K in SettingsSectionKey]: SettingsSection<K> };
}

/** Validates and stores a section. Callers check `settings.manage` first. */
export async function saveSettings<K extends SettingsSectionKey>(
  key: K,
  value: unknown,
  updatedById: string,
): Promise<SettingsSection<K>> {
  const parsed = SETTINGS_SECTIONS[key].parse(value) as SettingsSection<K>;
  const json = parsed as unknown as Prisma.InputJsonValue;
  await db.siteSetting.upsert({
    where: { key },
    update: { value: json, updatedById },
    create: { key, value: json, updatedById },
  });
  return parsed;
}
