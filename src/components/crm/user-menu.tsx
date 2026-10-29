"use client";

import { LogOut, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth/client";
import { navigateAfterAuthChange } from "@/lib/auth/navigate";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function UserMenu({ name, email }: { name: string; email: string }) {
  async function signOut() {
    await authClient.signOut();
    navigateAfterAuthChange("/admin/sign-in");
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-auto gap-2.5 px-2 py-1.5" aria-label={`Account menu for ${name} (${email})`}>
          <Avatar className="size-9">
            <AvatarFallback className="bg-lavender text-text">{initials(name)}</AvatarFallback>
          </Avatar>
          <span className="hidden min-w-0 flex-col items-start text-left leading-tight sm:flex">
            <span className="text-sm font-medium">{name}</span>
            <span className="max-w-56 truncate text-xs font-normal text-text-muted">{email}</span>
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium">{name}</p>
          <p className="truncate text-xs text-text-muted">{email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/admin/security/two-factor">
            <ShieldCheck aria-hidden="true" />
            Two-factor authentication
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={signOut}>
          <LogOut aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
