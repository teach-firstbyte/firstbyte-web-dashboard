"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const COMMAND = "firstbyte open dashboard";

// If the navigation is stopped (Esc, the browser's stop button) nothing tells
// the page, so give up after this long rather than cover the site forever.
const GIVE_UP_MS = 15_000;

/**
 * A full-screen terminal that "boots" the dashboard, shown the moment someone
 * clicks a link to /dashboard (the "Get Involved" buttons).
 *
 * The dashboard is a separate app behind a rewrite, so that click is a full
 * page load. The browser keeps this page on screen until the dashboard's first
 * byte arrives, and most of the wait (cold start, the sign-in check) happens
 * before then. Showing the terminal here covers all of it.
 *
 * The dashboard has its own copy of this terminal for full loads of /dashboard
 * (apps/dashboard/src/components/layout/TerminalBoot.tsx); keep the two looking
 * the same.
 */
export function DashboardBoot() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => setOpen(false), GIVE_UP_MS);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      // Only a plain left click that will navigate this tab. A new tab, a
      // download, or a handler that cancelled the click leaves this page here.
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const link = (event.target as Element | null)?.closest("a[href]");
      if (
        !(link instanceof HTMLAnchorElement) ||
        (link.target && link.target !== "_self") ||
        link.hasAttribute("download")
      ) {
        return;
      }
      const url = new URL(link.href);
      const toDashboard =
        url.pathname === "/dashboard" || url.pathname.startsWith("/dashboard/");
      if (url.origin === window.location.origin && toDashboard) setOpen(true);
    }

    // Pressing Back can restore this page from the back/forward cache exactly
    // as it was left, terminal included. `persisted` is true only then.
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) setOpen(false);
    }

    document.addEventListener("click", onClick);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  if (!open) return null;

  return (
    <div
      role="status"
      className="fixed inset-0 z-[200] grid animate-in place-items-center bg-background px-4 pb-[10vh] duration-100 fade-in motion-reduce:animate-none"
    >
      <span className="sr-only">Opening the dashboard</span>

      <div
        aria-hidden="true"
        className="w-full max-w-md overflow-hidden rounded-xl bg-zinc-950 text-sm text-zinc-100 shadow-2xl ring-1 ring-black/10 dark:ring-white/10"
      >
        <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
          <span className="size-3 rounded-full bg-red-400/80" />
          <span className="size-3 rounded-full bg-yellow-400/80" />
          <span className="size-3 rounded-full bg-green-400/80" />
          <span className="ml-3 flex items-center gap-2 text-xs text-zinc-400">
            <Image src="/FirstByteBitex4.png" alt="" width={16} height={16} />
            firstbyte — zsh
          </span>
        </div>

        <div className="min-h-40 space-y-1.5 p-4 font-mono">
          <p className="flex">
            <span className="mr-2 text-green-400">$</span>
            <span
              className="boot-type"
              style={{ "--chars": COMMAND.length } as React.CSSProperties}
            >
              {COMMAND}
            </span>
          </p>
          <Step text="checking your session" at={450} okAt={1000} />
          <Step text="loading your dashboard" at={1000} />
        </div>
      </div>
    </div>
  );
}

/**
 * One line of output. It appears at `at` ms and turns from "…" to "ok" at
 * `okAt`; without `okAt` it stays "…" until the dashboard replaces the page.
 */
function Step({ text, at, okAt }: { text: string; at: number; okAt?: number }) {
  return (
    <p
      className="flex animate-in justify-between gap-4 fill-mode-both fade-in slide-in-from-bottom-1 motion-reduce:animate-none"
      style={{ animationDelay: `${at}ms` }}
    >
      <span className="text-zinc-400">→ {text}</span>
      {okAt === undefined ? (
        <span className="animate-pulse text-zinc-500 motion-reduce:animate-none">
          …
        </span>
      ) : (
        <span className="grid *:col-start-1 *:row-start-1">
          <span
            className="animate-out text-zinc-500 duration-0 fill-mode-both fade-out motion-reduce:hidden"
            style={{ animationDelay: `${okAt}ms` }}
          >
            …
          </span>
          <span
            className="animate-in text-green-400 fill-mode-both fade-in motion-reduce:animate-none"
            style={{ animationDelay: `${okAt}ms` }}
          >
            ok
          </span>
        </span>
      )}
    </p>
  );
}
