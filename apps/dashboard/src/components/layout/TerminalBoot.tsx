import Image from "next/image";
import { withBasePath } from "@/lib/paths";

const COMMAND = "firstbyte open dashboard";

/**
 * The loading screen for the dashboard home: a small terminal that "boots" the
 * dashboard while its data loads. Mostly seen by someone arriving from the
 * marketing site's "Get Involved" button.
 *
 * Animated with CSS only (the boot-* classes in globals.css), on purpose. This
 * is a Suspense fallback, so it arrives as plain HTML before any JavaScript has
 * loaded; a timer-driven client component would sit frozen until hydration,
 * which can be after the real page has already replaced it.
 *
 * The last step never says "ok". The screen cannot know when loading ends; the
 * real page simply takes its place.
 */
export function TerminalBoot() {
  return (
    <div
      role="status"
      className="grid min-h-dvh place-items-center px-4 pb-[10vh]"
    >
      <span className="sr-only">Loading your dashboard</span>

      <div
        aria-hidden="true"
        className="boot-card w-full max-w-md overflow-hidden rounded-xl bg-zinc-950 text-sm text-zinc-100 shadow-2xl ring-1 ring-black/10 dark:ring-white/10"
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
          {/* --at: when the line appears. --ok: when its "…" turns into "ok". */}
          <Step text="signed in" at={600} ok={600} />
          <Step text="loading your meetings" at={800} ok={1300} />
          <Step text="loading attendance" at={1300} />
        </div>
      </div>
    </div>
  );
}

function Step({ text, at, ok }: { text: string; at: number; ok?: number }) {
  return (
    <p
      className="boot-in flex justify-between gap-4"
      style={{ "--at": `${at}ms` } as React.CSSProperties}
    >
      <span className="text-zinc-400">→ {text}</span>
      {ok === undefined ? (
        <span className="boot-pulse text-zinc-500">…</span>
      ) : (
        <span
          className="grid"
          style={{ "--ok": `${ok}ms` } as React.CSSProperties}
        >
          <span className="boot-wait col-start-1 row-start-1 text-zinc-500">
            …
          </span>
          <span className="boot-ok col-start-1 row-start-1 text-green-400">
            ok
          </span>
        </span>
      )}
    </p>
  );
}
