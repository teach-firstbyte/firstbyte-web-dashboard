"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/components/ThemeToggle";
import type { ViewMode } from "@/lib/auth/viewMode";
import { withBasePath } from "@/lib/paths";
import { cn } from "@/lib/utils";
import { AccountMenu, type AccountSummary } from "./AccountMenu";
import { MEMBER_LINKS, OFFICER_LINKS } from "./links";

/**
 * The floating pill bar from the marketing site's navbar: logo, the links for
 * this view, the theme switch and the account menu.
 */
export function AppNav({
  mode,
  canSwitchView,
  account,
}: {
  mode: ViewMode;
  canSwitchView: boolean;
  account: AccountSummary;
}) {
  const pathname = usePathname();
  const links = mode === "officer" ? OFFICER_LINKS : MEMBER_LINKS;

  // "/" only matches itself; every other link also lights up on its sub-pages,
  // so /meetings/12/attendance keeps "Meetings" active.
  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      aria-label="Dashboard"
      className="sticky top-[calc(env(safe-area-inset-top,0px)+0.75rem)] z-40 flex items-center gap-2 rounded-full border border-border/70 bg-background/85 py-1.5 pr-2 pl-4 shadow-md backdrop-blur-lg"
    >
      <Link
        href="/"
        className="mr-1 flex shrink-0 items-center gap-2 font-bold"
        aria-label="FirstByte dashboard home"
      >
        {/* A plain basePath-prefixed src: next/image does not add the zone's
            basePath to a string src on its own. */}
        <Image
          src={withBasePath("/FirstByteBitex4.png")}
          alt=""
          width={28}
          height={28}
          className="size-7 scale-[1.35]"
          unoptimized
        />
        <span className="hidden sm:inline">FirstByte</span>
      </Link>

      <ul className="flex min-w-0 flex-1 gap-0.5 overflow-x-auto [scrollbar-width:none]">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={cn(
                "relative block rounded-full px-3 py-2 text-sm font-medium whitespace-nowrap text-foreground/75 transition-colors hover:text-primary",
                "aria-[current=page]:text-primary aria-[current=page]:after:absolute aria-[current=page]:after:inset-x-3 aria-[current=page]:after:bottom-1 aria-[current=page]:after:h-0.5 aria-[current=page]:after:rounded-full aria-[current=page]:after:bg-primary",
              )}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>

      <ThemeToggle className="shrink-0 rounded-full" />
      <AccountMenu
        account={account}
        mode={mode}
        canSwitchView={canSwitchView}
      />
    </nav>
  );
}
