"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Eye, LogOut, MessageSquarePlus, Settings, Undo2 } from "lucide-react";

import { logOut } from "@/app/login/actions";
import { setViewMode } from "@/app/actions/viewMode";
import { OfficerBadge } from "@/components/OfficerBadge";
import { PersonAvatar } from "@/components/common/PersonAvatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ViewMode } from "@/lib/auth/viewMode";
import { SUGGESTION_BOX_URL } from "./links";

export type AccountSummary = {
  /** Preferred name when set, else the full name. */
  name: string | null;
  fullName: string | null;
  email: string;
  isOfficer: boolean;
};

/**
 * The avatar menu at the right of the top bar. Replaces the loose row of
 * Settings / View as member / Log out buttons the old home page had.
 */
export function AccountMenu({
  account,
  mode,
  canSwitchView,
}: {
  account: AccountSummary;
  mode: ViewMode;
  canSwitchView: boolean;
}) {
  const [pending, startTransition] = useTransition();

  // Server actions called directly. setViewMode re-checks the role itself and
  // revalidates the layout, so the page re-renders in the new mode.
  const switchView = (next: ViewMode) =>
    startTransition(() => setViewMode(next));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="shrink-0 rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60"
        aria-label="Account menu"
        disabled={pending}
      >
        <PersonAvatar name={account.fullName} email={account.email} size="sm" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        <DropdownMenuLabel className="grid gap-0.5">
          <span className="truncate font-semibold">
            {account.fullName ?? account.email}
          </span>
          <span className="truncate text-xs font-normal text-muted-foreground">
            {account.email}
          </span>
          {account.isOfficer && mode === "officer" && (
            <OfficerBadge className="mt-1" />
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/settings">
              <Settings /> Settings
            </Link>
          </DropdownMenuItem>
          {canSwitchView &&
            (mode === "officer" ? (
              <DropdownMenuItem onSelect={() => switchView("member")}>
                <Eye /> View as member
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => switchView("officer")}>
                <Undo2 /> Back to officer view
              </DropdownMenuItem>
            ))}
          <DropdownMenuItem asChild>
            <a
              href={SUGGESTION_BOX_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageSquarePlus /> Suggestion box
            </a>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={() => startTransition(() => logOut())}>
            <LogOut /> Log out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
