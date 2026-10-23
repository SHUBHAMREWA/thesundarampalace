/**
 * Full page navigation for auth state changes (sign-in, 2FA, sign-out).
 * A client-side transition could replay router-cache entries rendered for
 * the previous auth state; a full load also clears the previous user's
 * in-memory data.
 */
export function navigateAfterAuthChange(path: string): void {
  window.location.assign(path);
}
