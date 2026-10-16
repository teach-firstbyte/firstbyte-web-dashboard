import Image from "next/image";
import type { ViewMode } from "@/lib/auth/viewMode";
import { withBasePath } from "@/lib/paths";
import { cn } from "@/lib/utils";

const COMMAND = "firstbyte open dashboard";

// What each home actually loads, so the officer screen does not claim to load
// attendance while it is fetching approvals.
const STEPS: Record<ViewMode, [string, string]> = {
  member: ["loading your meetings", "loading attendance"],
  officer: ["loading meetings", "loading approvals"],
};

/**
 * The loading screen for the dashboard home: a small terminal that "boots" the
 * dashboard while its data loads. Shown on full page loads only (see page.tsx),
 * so mostly to someone arriving from the website's "Get Involved" button.
 *
 * Animated with CSS only, on purpose. This is a Suspense fallback, so it
 * arrives as plain HTML before any JavaScript has loaded; a timer-driven client
 * component would sit frozen until hydration, which can be after the real page
 * has already replaced it.
 *
 * The last step never says "ok". The screen cannot know when loading ends; the
 * real page simply takes its place.
 */
export function TerminalBoot({ view }: { view: ViewMode }) {
  const [first, last] = STEPS[view];

  return (
    <div
      role="status"
      className="grid min-h-dvh place-items-center px-4 pb-[10vh]"
    >
      <span className="sr-only">Loading your dashboard</span>

      {/* Waits 150ms before it shows, so a fast load does not flash it. */}
      <div
        aria-hidden="true"
        className="w-full max-w-md animate-in overflow-hidden rounded-xl bg-zinc-950 text-sm text-zinc-100 shadow-2xl ring-1 ring-black/10 delay-150 duration-200 fill-mode-both fade-in slide-in-from-bottom-1 motion-reduce:animate-none dark:ring-white/10"
      >
        <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
          <span className="size-3 rounded-full bg-red-400/80" />
          <span className="size-3 rounded-full bg-yellow-400/80" />
          <span className="size-3 rounded-full bg-green-400/80" />
          <span className="ml-3 flex items-center gap-2 text-xs text-zinc-400">
            <Image
              src={withBasePath("/FirstByteBitex4.png")}
              alt=""
              width={16}
              height={16}
              unoptimized
            />
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
          <Step text="signed in" at={600} done />
          <Step text={first} at={800} okAt={1300} />
          <Step text={last} at={1300} />
        </div>
      </div>
    </div>
  );
}

/**
 * One line of output. It appears at `at` ms. Its status is "ok" from the start
 * (`done`), turns from "…" to "ok" at `okAt`, or, with neither, stays "…".
 */
function Step({
  text,
  at,
  okAt,
  done,
}: {
  text: string;
  at: number;
  okAt?: number;
  done?: boolean;
}) {
  return (
    <p
      className={cn(
        "flex animate-in justify-between gap-4 fill-mode-both fade-in slide-in-from-bottom-1",
        "motion-reduce:animate-none",
      )}
      style={{ animationDelay: `${at}ms` }}
    >
      <span className="text-zinc-400">→ {text}</span>
      {done ? (
        <Ok />
      ) : okAt === undefined ? (
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
          <Ok at={okAt} />
        </span>
      )}
    </p>
  );
}

function Ok({ at }: { at?: number }) {
  return (
    <span
      className={cn(
        "text-green-400",
        at !== undefined &&
          "animate-in fill-mode-both fade-in motion-reduce:animate-none",
      )}
      style={at !== undefined ? { animationDelay: `${at}ms` } : undefined}
    >
      ok
    </span>
  );
}
