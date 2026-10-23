import type { ReactNode } from "react";

import { MobileNav } from "@/components/crm/mobile-nav";
import { visibleNav } from "@/components/crm/nav";
import { SidebarNav } from "@/components/crm/sidebar-nav";
import { UserMenu } from "@/components/crm/user-menu";
import { Bell } from "lucide-react";
import Link from "next/link";

import { db } from "@/lib/db";
import { requireUser } from "@/server/auth/session";

/**
 * CRM shell. The session check runs before anything streams, so signed-out
 * users get a real redirect and missing permissions a real 403 status.
 * (The admin root layout opts out of prerendering — see ../layout.tsx.)
 */
export default async function CrmLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const hrefs = visibleNav(user.permissions).map((item) => item.href);
  const unread = await db.notification.count({ where: { userId: user.id, readAt: null } });
  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-64 shrink-0 border-r border-border bg-surface px-4 py-6 lg:block">
        <p className="px-3 font-display text-xl font-semibold text-primary">Sundaram Palace</p>
        <span className="gold-rule mt-3 ml-3" aria-hidden="true" />
        <div className="mt-6">
          <SidebarNav hrefs={hrefs} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-4 md:px-6">
          <MobileNav hrefs={hrefs} />
          <div className="ml-auto flex items-center gap-1">
            <Link
              href="/admin/notifications"
              className="relative rounded-md p-2 hover:bg-blush/60"
              aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
            >
              <Bell className="size-5" aria-hidden="true" />
              {unread ? (
                <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] leading-4 font-semibold text-primary-foreground">
                  {unread > 99 ? "99+" : unread}
                </span>
              ) : null}
            </Link>
            <UserMenu name={user.name} email={user.email} />
          </div>
        </header>
        <main id="main" className="flex-1 px-4 py-6 md:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
