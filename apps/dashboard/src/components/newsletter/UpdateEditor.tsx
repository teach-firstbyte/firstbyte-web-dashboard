"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Plus, X } from "lucide-react";
import { toast } from "sonner";

import {
  decideTeamUpdateAction,
  saveTeamUpdateAction,
} from "@/app/newsletter/actions";
import { SourceChips } from "@/components/newsletter/StatusBadges";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { withBasePath } from "@/lib/paths";
import { cn } from "@/lib/utils";
import type {
  SamplePhoto,
  TeamUpdateView,
  UpdateLine,
} from "@/types/newsletter";

type EditLine = { key: number; text: string; from: number | null };

const sameSources = (a: UpdateLine, b: UpdateLine) =>
  a.sources.map((s) => s.id).join("|") === b.sources.map((s) => s.id).join("|");

/**
 * Works out which of the AI's lines each saved line came from, so its sources
 * can be shown. Lines with no sources were written by a person.
 */
function toEditLines(update: TeamUpdateView): EditLine[] {
  const used = new Set<number>();
  return update.lines.map((line, i) => {
    let from: number | null = null;
    if (line.sources.length > 0) {
      const match = update.aiLines.findIndex(
        (ai, j) => !used.has(j) && sameSources(ai, line),
      );
      if (match >= 0) {
        used.add(match);
        from = match;
      }
    }
    return { key: i, text: line.text, from };
  });
}

/**
 * A lead's editor for their team's part of the issue. Lines can be reworded,
 * removed or added; the sources stay attached to the AI's original lines,
 * because the server copies them over by index rather than trusting the
 * browser (see saveTeamUpdateSchema).
 */
export function UpdateEditor({
  update,
  editable,
  photos,
}: {
  update: TeamUpdateView;
  /** False once the issue has final approval. */
  editable: boolean;
  photos: SamplePhoto[];
}) {
  const router = useRouter();
  const [lines, setLines] = React.useState<EditLine[]>(() =>
    toEditLines(update),
  );
  const [photo, setPhoto] = React.useState<string | null>(update.photo);
  const [dirty, setDirty] = React.useState(false);
  const [pending, start] = React.useTransition();
  const nextKey = React.useRef(lines.length);

  const isDraft = update.status === "DRAFT";
  const canEdit = editable && isDraft;

  const change = (fn: (prev: EditLine[]) => EditLine[]) => {
    setLines(fn);
    setDirty(true);
  };

  const save = async () => {
    const r = await saveTeamUpdateAction({
      updateId: update.id,
      lines: lines
        .map((l) => ({ text: l.text.trim(), from: l.from }))
        .filter((l) => l.text.length > 0),
      photo,
    });
    if (r.error) throw new Error(r.error);
    setDirty(false);
  };

  const act = (fn: () => Promise<void>, done: string) =>
    start(async () => {
      try {
        await fn();
        toast.success(done);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "That didn't save.");
      }
    });

  const decide = async (decision: "APPROVED" | "SKIPPED" | "DRAFT") => {
    const r = await decideTeamUpdateAction({ updateId: update.id, decision });
    if (r.error) throw new Error(r.error);
  };

  return (
    <div className="flex flex-col gap-4">
      {lines.length === 0 && (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          {update.aiError
            ? "No draft this week. Write the update yourself, or skip the week."
            : "The AI found nothing worth sharing this week. Add a line, or skip the week."}
        </p>
      )}

      <ol className="flex flex-col gap-3">
        {lines.map((line, i) => {
          const original =
            line.from === null ? null : update.aiLines[line.from];
          return (
            <li
              key={line.key}
              className={cn(
                "flex flex-col gap-2 rounded-xl border p-3",
                original?.flagged && "border-warning/50 bg-warning/5",
              )}
            >
              <div className="flex items-start gap-2">
                <Textarea
                  aria-label={`Line ${i + 1}`}
                  value={line.text}
                  disabled={!canEdit}
                  rows={2}
                  maxLength={300}
                  onChange={(e) =>
                    change((prev) =>
                      prev.map((l) =>
                        l.key === line.key ? { ...l, text: e.target.value } : l,
                      ),
                    )
                  }
                />
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove line ${i + 1}`}
                    onClick={() =>
                      change((prev) => prev.filter((l) => l.key !== line.key))
                    }
                  >
                    <X />
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <SourceChips sources={original?.sources ?? []} />
                {original?.flagged && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-warning-foreground">
                    <AlertTriangle className="size-3.5" aria-hidden="true" />
                    Based only on conversation. Is it ready to share?
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {canEdit && lines.length < 6 && (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() =>
            change((prev) => [
              ...prev,
              { key: nextKey.current++, text: "", from: null },
            ])
          }
        >
          <Plus aria-hidden="true" />
          Add a line
        </Button>
      )}

      <fieldset className="flex flex-col gap-2" disabled={!canEdit}>
        <legend className="mb-2 text-sm font-semibold">Photo (optional)</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <button
            type="button"
            onClick={() => {
              setPhoto(null);
              setDirty(true);
            }}
            aria-pressed={photo === null}
            className={cn(
              "grid aspect-[4/3] place-content-center rounded-lg border text-sm text-muted-foreground",
              photo === null && "border-primary ring-2 ring-primary/40",
            )}
          >
            No photo
          </button>
          {photos.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => {
                setPhoto(p.key);
                setDirty(true);
              }}
              aria-pressed={photo === p.key}
              aria-label={p.label}
              className={cn(
                "overflow-hidden rounded-lg border",
                photo === p.key && "border-primary ring-2 ring-primary/40",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- next/image is unoptimized in this app anyway (see next.config.ts) */}
              <img
                src={withBasePath(p.src)}
                alt=""
                className="aspect-[4/3] w-full object-cover"
              />
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Sample photos for the prototype. Later these come from the
          meeting&apos;s Google Drive folder.
        </p>
      </fieldset>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
        {canEdit ? (
          <>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={pending}
                onClick={() =>
                  act(async () => {
                    if (dirty) await save();
                    await decide("SKIPPED");
                  }, "Skipped this week.")
                }
              >
                Skip this week
              </Button>
              {dirty && (
                <Button
                  variant="ghost"
                  disabled={pending}
                  onClick={() => act(save, "Saved.")}
                >
                  Save draft
                </Button>
              )}
            </div>
            <Button
              pending={pending}
              onClick={() =>
                act(async () => {
                  if (dirty) await save();
                  await decide("APPROVED");
                }, "Approved. Thanks!")
              }
            >
              Approve update
            </Button>
          </>
        ) : editable ? (
          <>
            <p className="text-sm text-muted-foreground">
              {update.status === "APPROVED"
                ? "Approved. Reopen it to make changes."
                : "Skipped this week."}
            </p>
            <Button
              variant="outline"
              pending={pending}
              onClick={() => act(() => decide("DRAFT"), "Reopened.")}
            >
              Reopen
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            This issue has final approval, so it can&apos;t be changed.
          </p>
        )}
      </div>
    </div>
  );
}
