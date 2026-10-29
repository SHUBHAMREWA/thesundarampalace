export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { syncEnvAdmin } = await import("@/server/auth/sync-env-admin");
    await syncEnvAdmin();
  }
}
