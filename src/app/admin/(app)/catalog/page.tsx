import { Download } from "lucide-react";
import { FOOD_MENU_PDF_URL } from "@/lib/menu/food-menu";
import type { Metadata } from "next";

import { ConfirmAction } from "@/components/crm/action-kit";
import { PageHeader } from "@/components/crm/page-header";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { resetFoodMenuAction } from "@/server/actions/catalog";
import { requirePermission } from "@/server/auth/session";
import { getFoodMenu, menuImages } from "@/server/services/food-menu";

import { FoodMenuWorkspace } from "./food-menu-workspace";
import { FoodMenuPreview } from "./food-menu-preview";

// CRM pages read the session on every request (see src/app/admin/layout.tsx).
export const instant = false;

export const metadata: Metadata = { title: "Food menu" };

/** The food menu: edit it here, preview it, and download it as a PDF to share. */
export default async function FoodMenuPage() {
  await requirePermission("catalog.manage");
  const [menu, saved] = await Promise.all([
    getFoodMenu(),
    db.siteSetting.findUnique({
      where: { key: "foodMenu" },
      select: { updatedAt: true },
    }),
  ]);
  return (
    <>
      <PageHeader
        title="Food menu"
        description="Edit the menu right on its pages, save, then preview or download it. Or send the ready-made PDF as it is."
        crumbs={[
          { label: "Dashboard", href: "/admin" },
          { label: "Food menu" },
        ]}
        actions={
          <>
            <FoodMenuPreview
              version={saved?.updatedAt.toISOString() ?? "default"}
            />
            <Button asChild>
              <a href={FOOD_MENU_PDF_URL}>
                <Download aria-hidden="true" /> Download PDF
              </a>
            </Button>
            {saved ? (
              <ConfirmAction
                action={resetFoodMenuAction}
                label="Reset to original"
                title="Put back the original menu?"
                description="Your changes are replaced by the menu as first supplied."
                triggerVariant="ghost"
                destructive
              />
            ) : null}
          </>
        }
      />
      <FoodMenuWorkspace
        key={saved?.updatedAt.toISOString() ?? "default"}
        initial={menu}
        images={menuImages()}
        originalUrl="/api/food-menu/original"
      />
    </>
  );
}
