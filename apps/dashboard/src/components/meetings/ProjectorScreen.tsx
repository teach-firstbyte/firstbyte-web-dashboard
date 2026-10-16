"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, Maximize } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatShortDate } from "@/lib/format";
import { absoluteUrl, withBasePath } from "@/lib/paths";
import { cn } from "@/lib/utils";

/** How often the count refreshes while the code is on screen. */
const REFRESH_MS = 8000;

/**
 * The full-screen page that goes on the projector: a big QR code, the backup
 * code, and a live count, readable from the back of a room.
 *
 * One component for both screens. Check-in and Feedback are tabs that link
 * between /check-in-display and /feedback-display, so at the end of a meeting
 * an officer switches with one click instead of going back to the dashboard.
 */
export function ProjectorScreen({
  meetingId,
  screen,
  title,
  scheduledAt,
  path,
  code,
  count,
  total,
}: {
  meetingId: number;
  screen: "checkin" | "feedback";
  title: string;
  scheduledAt: Date | string;
  /** App path the QR code opens, e.g. /check-in/12?code=7F3A9C. */
  path: string;
  /** The 6-character backup code, check-in only. */
  code?: string;
  /** People checked in, or feedback responses. */
  count: number;
  /** Roster size, for "13 of 24". */
  total?: number;
}) {
  const router = useRouter();
  const [url, setUrl] = React.useState<string | null>(null);
  const [bump, setBump] = React.useState(false);
  const previous = React.useRef(count);

  // window only exists in the browser. absoluteUrl adds the /dashboard base
  // path; without it the QR points at a 404 on the marketing site, which is
  // only discoverable by scanning it.
  React.useEffect(() => setUrl(absoluteUrl(path)), [path]);

  // Re-render the server page on a timer so the count stays live.
  React.useEffect(() => {
    const id = setInterval(() => router.refresh(), REFRESH_MS);
    return () => clearInterval(id);
  }, [router]);

  // A small pop on the number each time it goes up.
  React.useEffect(() => {
    if (count > previous.current) {
      setBump(true);
      const id = setTimeout(() => setBump(false), 450);
      previous.current = count;
      return () => clearTimeout(id);
    }
    previous.current = count;
  }, [count]);

  const fullscreen = () => {
    const el = document.documentElement;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else el.requestFullscreen?.().catch(() => {});
  };

  const tabs = [
    {
      key: "checkin",
      label: "Check-in",
      href: `/meetings/${meetingId}/check-in-display`,
    },
    {
      key: "feedback",
      label: "Feedback",
      href: `/meetings/${meetingId}/feedback-display`,
    },
  ] as const;

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-[calc(env(safe-area-inset-top,0px)+1rem)]">
        <Button asChild variant="outline" size="sm">
          <Link href="/">
            <ArrowLeft data-icon="inline-start" />
            Back
          </Link>
        </Button>
        <nav
          aria-label="Which QR code"
          className="inline-flex gap-0.5 rounded-full bg-muted p-1"
        >
          {tabs.map((tab) => (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={screen === tab.key ? "page" : undefined}
              className="rounded-full px-4 py-1.5 text-sm font-medium text-muted-foreground aria-[current=page]:bg-card aria-[current=page]:text-foreground aria-[current=page]:shadow-sm"
            >
              {tab.label}
            </Link>
          ))}
        </nav>
        <Button variant="outline" size="sm" onClick={fullscreen}>
          <Maximize data-icon="inline-start" />
          Full screen
        </Button>
      </div>

      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center justify-center gap-[clamp(1.5rem,5vw,4.5rem)] px-[clamp(1rem,5vw,4rem)] py-8 md:grid-cols-[auto_minmax(0,1fr)]">
        {/* Always black on white, whatever the theme: scanners need it. */}
        <div className="mx-auto aspect-square w-[min(62vh,440px,82vw)] max-w-full rounded-3xl bg-white p-[clamp(0.9rem,2vw,1.4rem)] shadow-[0_0_0_8px_color-mix(in_oklch,var(--primary)_14%,transparent),0_20px_60px_color-mix(in_oklch,var(--primary)_22%,transparent)]">
          {url ? (
            <QRCodeSVG
              value={url}
              size={512}
              className="size-full"
              title={
                screen === "checkin" ? "Check-in QR code" : "Feedback QR code"
              }
            />
          ) : (
            <div className="size-full animate-pulse rounded-xl bg-neutral-200" />
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-5 text-center md:text-left">
          <div className="flex items-center justify-center gap-2.5 font-bold md:justify-start">
            <Image
              src={withBasePath("/FirstByteBitex4.png")}
              alt=""
              width={44}
              height={44}
              className="size-11 scale-[1.35]"
              unoptimized
            />
            <span className="text-xl">FirstByte</span>
          </div>
          <p className="text-[clamp(14px,1.6vw,18px)] text-muted-foreground">
            {title} · {formatShortDate(scheduledAt)}
          </p>
          <h1 className="text-[clamp(2rem,5vw,3.6rem)] leading-none font-extrabold tracking-tight">
            {screen === "checkin" ? "Scan to check in" : "How was it?"}
          </h1>
          <p className="text-[clamp(15px,1.8vw,20px)] text-muted-foreground">
            {screen === "checkin"
              ? "Can't scan? Enter this code on the check-in page:"
              : "Scan to rate this meeting. It takes 30 seconds, and you can stay anonymous."}
          </p>
          {screen === "checkin" && code && (
            <p className="font-mono text-[clamp(2.2rem,6vw,4.2rem)] font-bold tracking-[0.18em]">
              {code.slice(0, 3)} {code.slice(3)}
            </p>
          )}
          <p
            className="flex flex-wrap items-baseline justify-center gap-2 md:justify-start"
            aria-live="polite"
          >
            <strong
              className={cn(
                "text-[clamp(2rem,4vw,3rem)] text-primary tabular-nums transition-transform",
                bump && "motion-safe:scale-110",
              )}
            >
              {count}
            </strong>
            <span className="text-[clamp(15px,1.8vw,20px)] text-muted-foreground">
              {screen === "checkin"
                ? `checked in${total ? ` · ${total} invited` : ""}`
                : count === 1
                  ? "response so far"
                  : "responses so far"}
            </span>
          </p>
        </div>
      </main>
    </div>
  );
}
