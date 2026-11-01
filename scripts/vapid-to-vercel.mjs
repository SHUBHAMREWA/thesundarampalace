// Creates the Web Push (VAPID) key pair for production and saves it straight
// into the linked Vercel project's Production environment:
//
//   node scripts/vapid-to-vercel.mjs
//
// The private key is never printed or written to a file: it goes from memory
// into `vercel env add` through stdin. Run it once; running it again replaces
// the keys, and every device then has to turn notifications on again.
import { spawnSync } from "node:child_process";

import webpush from "web-push";

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

/** Replaces one Production variable on Vercel with the given value. */
function setVar(name, value) {
  // Remove an older value first (fine if there is none).
  spawnSync("vercel", ["env", "rm", name, "production", "-y"], { stdio: "ignore", shell: true });
  const result = spawnSync("vercel", ["env", "add", name, "production"], {
    input: value,
    stdio: ["pipe", "inherit", "inherit"],
    shell: true,
  });
  if (result.status !== 0) {
    console.error(`\n✖ Could not save ${name} on Vercel. Is the Vercel CLI signed in and this folder linked?`);
    process.exit(1);
  }
}

setVar("NEXT_PUBLIC_VAPID_PUBLIC_KEY", publicKey);
setVar("VAPID_PRIVATE_KEY", privateKey);
console.log(`\n✔ Saved both VAPID keys to Vercel (Production). Public key: ${publicKey}`);
console.log("The private key was not shown or saved anywhere else. Redeploy for it to take effect.");
