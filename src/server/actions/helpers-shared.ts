// Client-safe pieces of the action helpers (no "server-only").
import type { ActionState } from "./helpers";

export const idleState: ActionState = { ok: false };
