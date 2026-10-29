import "server-only";

import { hashPassword, verifyPassword } from "better-auth/crypto";
import { db } from "@/lib/db";

/**
 * Automatically synchronizes the Admin user credentials from `.env` to the database
 * whenever the server starts or the sign-in page is accessed.
 *
 * If SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are provided:
 * 1. Checks if the user exists in `db.user`. If not, creates the Super Admin.
 * 2. Checks the existing password hash in `db.account`.
 * 3. If the password in `.env` doesn't match the current hash (or is missing),
 *    hashes the new password from `.env` and updates `db.account.password`.
 */
export async function syncEnvAdmin(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL?.trim();
  const password = process.env.SEED_ADMIN_PASSWORD?.trim();

  if (!email || !password || password.includes("change-me")) {
    return;
  }

  try {
    let user = await db.user.findUnique({
      where: { email },
      include: {
        accounts: {
          where: { providerId: "credential" },
        },
      },
    });

    if (!user) {
      user = await db.user.create({
        data: {
          name: "Local Super Admin",
          email,
          emailVerified: true,
        },
        include: {
          accounts: {
            where: { providerId: "credential" },
          },
        },
      });

      const role = await db.role.findUnique({ where: { key: "super_admin" } });
      if (role) {
        await db.userRole.upsert({
          where: {
            userId_roleId: {
              userId: user.id,
              roleId: role.id,
            },
          },
          update: {},
          create: {
            userId: user.id,
            roleId: role.id,
          },
        });
      }
    }

    const credentialAccount = user.accounts[0];

    // Check if the current hashed password in DB matches the password in .env
    let passwordMatches = false;
    if (credentialAccount?.password) {
      passwordMatches = await verifyPassword({
        hash: credentialAccount.password,
        password,
      });
    }

    if (!passwordMatches) {
      const hashedPassword = await hashPassword(password);
      if (credentialAccount) {
        await db.account.update({
          where: { id: credentialAccount.id },
          data: { password: hashedPassword },
        });
        console.log(`[syncEnvAdmin] Updated password hash in database for admin: ${email}`);
      } else {
        await db.account.create({
          data: {
            userId: user.id,
            accountId: user.id,
            providerId: "credential",
            password: hashedPassword,
          },
        });
        console.log(`[syncEnvAdmin] Created credential account with hashed password for admin: ${email}`);
      }
    }
  } catch (error) {
    console.error("[syncEnvAdmin] Failed to sync admin credentials from .env:", error);
  }
}
