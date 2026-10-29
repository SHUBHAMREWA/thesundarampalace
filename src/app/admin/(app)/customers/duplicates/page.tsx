import { Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ConfirmAction } from "@/components/crm/action-kit";
import { PageHeader } from "@/components/crm/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { formatPhoneForDisplay } from "@/lib/contact/links";
import { formatIST } from "@/lib/time";
import {
  dismissMergeAction,
  mergeCustomersAction,
} from "@/server/actions/customers";
import { requirePermission } from "@/server/auth/session";
import { listMergeReviews } from "@/server/services/customers";

// CRM pages read the session on every request (see src/app/admin/layout.tsx).
export const instant = false;

export const metadata: Metadata = { title: "Possible duplicates" };

export default async function DuplicatesPage() {
  const user = await requirePermission("customers.merge");
  const reviews = await listMergeReviews(user);
  return (
    <>
      <PageHeader
        title="Possible duplicates"
        description="Merging moves bookings, enquiries and documents to the record you keep. It is never automatic."
        crumbs={[
          { label: "Dashboard", href: "/admin" },
          { label: "Customers", href: "/admin/customers" },
          { label: "Duplicates" },
        ]}
      />
      {reviews.length ? (
        <div className="space-y-4">
          {reviews.map((r) => (
            <Card key={r.id}>
              <CardContent className="grid gap-4 pt-6 md:grid-cols-[1fr_1fr_auto]">
                {[r.primary!, r.duplicate!].map((c) => (
                  <div key={c.id} className="text-sm">
                    <Link
                      href={`/admin/customers/${c.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {c.fullName}
                    </Link>
                    <p className="text-text-muted">
                      {c.reference} · {formatPhoneForDisplay(c.mobile)}
                    </p>
                    <p className="text-text-muted">
                      {c.email ?? "no email"} · {c.city ?? "no city"}
                    </p>
                    <p className="text-text-muted">
                      {c._count.bookings} bookings · {c._count.leads} enquiries
                      · added {formatIST(c.createdAt, "d MMM yyyy")}
                    </p>
                  </div>
                ))}
                <div className="flex flex-col gap-2">
                  <ConfirmAction
                    action={mergeCustomersAction.bind(null, r.id)}
                    label="Merge"
                    title="Merge these customers?"
                    description="Choose the record to keep. The other is archived and its bookings, enquiries and documents move across."
                    confirmLabel="Merge"
                  >
                    <fieldset className="space-y-2 text-sm">
                      <legend className="font-medium">Keep</legend>
                      {[r.primary!, r.duplicate!].map((c, i) => (
                        <label key={c.id} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="keepId"
                            value={c.id}
                            defaultChecked={i === 0}
                            className="accent-primary"
                          />
                          {c.fullName} ({c.reference})
                        </label>
                      ))}
                    </fieldset>
                  </ConfirmAction>
                  <ConfirmAction
                    action={dismissMergeAction.bind(null, r.id)}
                    label="Not the same"
                    title="Different people?"
                    description="The review is closed and both records stay."
                    reasonName="note"
                    reasonLabel="Note (optional)"
                    triggerVariant="ghost"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Users}
          title="Nothing to review"
          description="Records with the same mobile number appear here when staff create them anyway."
        />
      )}
    </>
  );
}
