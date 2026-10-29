import type { Metadata } from "next";

import { PageHeader } from "@/components/crm/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatIST } from "@/lib/time";
import { requirePermission } from "@/server/auth/session";
import { grantableRoles, listStaff } from "@/server/services/staff";

import { ActiveToggle, CreateStaffForm, RoleForm } from "./staff-forms";

// CRM pages read the session on every request (see src/app/admin/layout.tsx).
export const instant = false;

export const metadata: Metadata = { title: "Staff" };

export default async function StaffPage() {
  const user = await requirePermission("users.manage");
  const [staff, roles] = await Promise.all([listStaff(user), Promise.resolve(grantableRoles(user))]);
  const roleOptions = roles.map((r) => ({ value: r.key, label: r.name }));
  return (
    <>
      <PageHeader
        title="Staff"
        description="Staff sign in with their email and password. There is no public sign-up."
        crumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Staff" }]}
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="hidden md:table-cell">Security</TableHead>
                  <TableHead className="hidden md:table-cell">Last sign-in</TableHead>
                  <TableHead><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((member) => {
                  const roleKey = member.roles[0]?.role.key ?? "";
                  const editable = member.id !== user.id && (roles.some((r) => r.key === roleKey) || !roleKey);
                  return (
                    <TableRow key={member.id} className={member.active ? "" : "opacity-60"}>
                      <TableCell>
                        <p className="font-medium">{member.name}</p>
                        <p className="text-xs text-text-muted">{member.email}</p>
                      </TableCell>
                      <TableCell>
                        {editable ? (
                          <RoleForm userId={member.id} current={roleKey} options={roleOptions} />
                        ) : (
                          member.roles.map((r) => r.role.name).join(", ") || "—"
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {member.twoFactorEnabled ? <Badge variant="success">2FA on</Badge> : <Badge variant="secondary">2FA off</Badge>}
                        {!member.active ? <Badge variant="danger" className="ml-1">Inactive</Badge> : null}
                      </TableCell>
                      <TableCell className="hidden text-sm text-text-muted md:table-cell">
                        {member.lastLoginAt ? formatIST(member.lastLoginAt, "d MMM yyyy, h:mm a") : "Never"}
                      </TableCell>
                      <TableCell className="text-right">
                        {editable ? <ActiveToggle userId={member.id} active={member.active} name={member.name} /> : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Add a staff member</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateStaffForm roles={roleOptions} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
