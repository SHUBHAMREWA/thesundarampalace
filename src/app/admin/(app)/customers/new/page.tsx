import type { Metadata } from "next";

import { PageHeader } from "@/components/crm/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermission } from "@/server/auth/session";
import { createCustomerAction } from "@/server/actions/customers";
import { can } from "@/server/policies/authorize";

import { CustomerForm } from "../customer-form";
import { customerFormOptions } from "../options";

export const metadata: Metadata = { title: "New customer" };

export default async function NewCustomerPage({ searchParams }: PageProps<"/admin/customers/new">) {
  const user = await requirePermission("customers.edit");
  const params = await searchParams;
  const next = params.next === "booking" ? "booking" : "";
  const options = await customerFormOptions();
  return (
    <>
      <PageHeader
        title="New customer"
        description="Only name and mobile are required. Collect personal details only when there's a reason to."
        crumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Customers", href: "/admin/customers" }, { label: "New" }]}
      />
      <Card>
        <CardContent className="pt-6">
          <CustomerForm
            action={createCustomerAction}
            {...options}
            showPersonal={can(user, "customers.personal.read")}
            submitLabel={next ? "Create customer and continue to booking" : "Create customer"}
            hidden={next ? { next } : {}}
          />
        </CardContent>
      </Card>
    </>
  );
}
