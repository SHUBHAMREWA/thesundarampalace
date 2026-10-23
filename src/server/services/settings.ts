import "server-only";

import { db } from "@/lib/db";
import {
  DEFAULT_SETTINGS,
  SETTINGS_SECTIONS,
  type SettingsSection,
  type SettingsSectionKey,
} from "@/lib/settings/schemas";

/** Reads one settings section, falling back to defaults if missing or invalid. */
export async function getSettings<K extends SettingsSectionKey>(key: K): Promise<SettingsSection<K>> {
  const row = await db.siteSetting.findUnique({ where: { key } });
  const parsed = SETTINGS_SECTIONS[key].safeParse(row?.value);
  return (parsed.success ? parsed.data : DEFAULT_SETTINGS[key]) as SettingsSection<K>;
}

export async function getAllSettings(): Promise<{ [K in SettingsSectionKey]: SettingsSection<K> }> {
  const keys = Object.keys(SETTINGS_SECTIONS) as SettingsSectionKey[];
  const entries = await Promise.all(keys.map(async (key) => [key, await getSettings(key)] as const));
  return Object.fromEntries(entries) as { [K in SettingsSectionKey]: SettingsSection<K> };
}
