"use client";

import * as React from "react";
import { ALargeSmall } from "lucide-react";
import { toast } from "sonner";

import { PersonAvatar } from "@/components/common/PersonAvatar";
import { EmptyState, PageHeader, Section } from "@/components/common/Section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Toggle } from "@/components/ui/toggle";
import { withBasePath } from "@/lib/paths";
import {
  bostonToday,
  describeDue,
  DUE_HELP,
  parseDue,
} from "@/lib/tasks/parseDue";
import {
  matchOwners,
  ownerName,
  ownerRole,
  ownerTeamId,
  type OwnerChoice,
} from "@/lib/tasks/owners";
import { cn } from "@/lib/utils";
import { OwnerCombobox } from "./OwnerCombobox";

/** The parts of a TaskView this list shows. */
export type ActionItem = {
  id: number;
  title: string;
  dueDate: string;
  owner: { id: number; name: string | null; preferredName: string | null };
  can: { delete: boolean };
};

type Errors = Partial<Record<"title" | "owner" | "due" | "form", string>>;

const BIG_TEXT_KEY = "firstbyte.actionItems.bigText";

async function errorMessage(res: Response, fallback: string) {
  const data = await res.json().catch(() => null);
  return typeof data?.error === "string" ? data.error : fallback;
}

/**
 * The Action items section of an e-board meeting: the president types each
 * one as it comes up, while screensharing. Every row becomes a task linked to
 * the meeting.
 *
 * One row is a title, an owner and a due date. Enter moves to the next field
 * that still needs something, and saves once all three are good. Then the
 * cursor is back in a fresh title, so five items is five lines of typing.
 * Nothing is saved until all three are valid: a name or a date that can't be
 * read stops on that field with a message, and the row stays as typed.
 */
export function MeetingActionItems({
  meeting,
  description,
  back,
  owners,
  initialItems,
}: {
  meeting: { id: number; title: string };
  description: string;
  back: React.ReactNode;
  owners: OwnerChoice[];
  initialItems: ActionItem[];
}) {
  const [items, setItems] = React.useState(initialItems);
  const [freshId, setFreshId] = React.useState<number | null>(null);
  const [removing, setRemoving] = React.useState<ReadonlySet<number>>(
    () => new Set(),
  );

  const [title, setTitle] = React.useState("");
  const [ownerText, setOwnerText] = React.useState("");
  const [ownerId, setOwnerId] = React.useState<number | null>(null);
  const [dueText, setDueText] = React.useState("");
  const [errors, setErrors] = React.useState<Errors>({});
  const [saving, setSaving] = React.useState(false);
  const savingRef = React.useRef(false);

  const titleRef = React.useRef<HTMLInputElement>(null);
  const ownerRef = React.useRef<HTMLInputElement>(null);
  const dueRef = React.useRef<HTMLInputElement>(null);

  // A per-viewer convenience, so a reload mid-meeting keeps the big text.
  const [big, setBig] = React.useState(false);
  React.useEffect(() => {
    try {
      setBig(window.localStorage.getItem(BIG_TEXT_KEY) === "1");
    } catch {
      // Private window or blocked storage: start small.
    }
  }, []);
  const toggleBig = (on: boolean) => {
    setBig(on);
    try {
      window.localStorage.setItem(BIG_TEXT_KEY, on ? "1" : "0");
    } catch {
      // Still works for this visit.
    }
  };

  const id = React.useId();
  const fieldId = (f: string) => `${id}-${f}`;

  const picked = owners.find((o) => o.id === ownerId) ?? null;
  // Read once per render, so the hint and the save agree on "today".
  const today = bostonToday();
  const due = parseDue(dueText, today);

  const clearError = (key: keyof Errors) =>
    setErrors((e) =>
      e[key] || e.form ? { ...e, [key]: undefined, form: undefined } : e,
    );

  const reset = () => {
    setTitle("");
    setOwnerText("");
    setOwnerId(null);
    setDueText("");
    setErrors({});
    titleRef.current?.focus();
  };

  const create = async (body: {
    title: string;
    ownerId: number;
    dueDate: string;
    teamId: number | null;
  }): Promise<ActionItem> => {
    const res = await fetch(withBasePath("/api/tasks"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, meetingId: meeting.id }),
    });
    if (!res.ok) {
      throw new Error(
        await errorMessage(res, "That item couldn't be saved. Try again."),
      );
    }
    return (await res.json()) as ActionItem;
  };

  const added = (item: ActionItem) => {
    setItems((list) => [...list, item]);
    setFreshId(item.id);
  };

  /**
   * Enter, from any field. `ownerNow` is the owner the combobox just picked,
   * which this render's state doesn't know about yet.
   */
  const advance = async (ownerNow?: OwnerChoice | null) => {
    if (savingRef.current) return;

    const t = title.trim();
    if (!t) {
      setErrors({ title: "Type the action item first." });
      titleRef.current?.focus();
      return;
    }

    let owner = ownerNow ?? picked;
    if (!owner) {
      const text = ownerText.trim();
      const found = text ? matchOwners(text, owners) : [];
      if (found.length === 1) owner = found[0];
      else {
        setErrors({
          owner: !text
            ? undefined
            : found.length === 0
              ? `No one on the e-board matches “${text}”.`
              : `More than one person matches “${text}”. Pick one from the list.`,
        });
        ownerRef.current?.focus();
        return;
      }
    }

    if (!due) {
      setErrors({
        due: dueText.trim()
          ? `Couldn't read “${dueText.trim()}”. ${DUE_HELP}.`
          : undefined,
      });
      dueRef.current?.focus();
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setErrors({});
    try {
      const item = await create({
        title: t,
        ownerId: owner.id,
        dueDate: due,
        teamId: ownerTeamId(owner),
      });
      added(item);
      reset();
      toast(`Added “${item.title}”`, {
        description: `${ownerName(owner)} · due ${describeDue(due, today)}`,
      });
    } catch (e) {
      setErrors({
        form:
          e instanceof Error && e.message !== "Failed to fetch"
            ? e.message
            : "Couldn't reach the dashboard. Check the connection, then press Enter to try again.",
      });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    e.preventDefault();
    void advance();
  };

  const remove = async (item: ActionItem) => {
    if (removing.has(item.id)) return;
    setRemoving((s) => new Set(s).add(item.id));
    try {
      const res = await fetch(withBasePath(`/api/tasks/${item.id}`), {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 404) {
        throw new Error(
          await errorMessage(res, "That item couldn't be removed."),
        );
      }
      setItems((list) => list.filter((i) => i.id !== item.id));
      // The button that had focus is gone. Back to typing.
      titleRef.current?.focus();
      toast(`Removed “${item.title}”`, {
        action: {
          label: "Undo",
          onClick: () => {
            const owner = owners.find((o) => o.id === item.owner.id);
            create({
              title: item.title,
              ownerId: item.owner.id,
              dueDate: item.dueDate,
              teamId: owner ? ownerTeamId(owner) : null,
            })
              .then(added)
              .catch((err: Error) => toast.error(err.message));
          },
        },
      });
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "That item couldn't be removed.",
      );
    } finally {
      setRemoving((s) => {
        const next = new Set(s);
        next.delete(item.id);
        return next;
      });
    }
  };

  const field = big
    ? "h-14 rounded-xl px-4 text-[22px] md:text-[22px]"
    : "h-11 rounded-lg px-3 text-base md:text-base";
  const hint = (tone: "muted" | "ok" | "bad") =>
    cn(
      "min-h-5 leading-snug",
      big ? "text-base" : "text-xs",
      tone === "muted" && "text-muted-foreground",
      tone === "ok" && "font-medium text-primary",
      tone === "bad" && "text-destructive",
    );
  const row = cn(
    "grid gap-2 md:grid-cols-[minmax(0,2.4fr)_minmax(0,1.3fr)_minmax(0,1.2fr)_auto]",
  );

  return (
    <>
      <PageHeader
        back={back}
        title={meeting.title}
        description={description}
        action={
          <Toggle
            variant="outline"
            pressed={big}
            onPressedChange={toggleBig}
            className="h-10 px-3"
          >
            <ALargeSmall />
            Big text for screensharing
          </Toggle>
        }
      />

      <Section
        title="Action items from this meeting"
        action={
          items.length > 0 ? (
            <span className="text-xs text-muted-foreground tabular-nums">
              {items.length} added
            </span>
          ) : undefined
        }
        className={cn(big && "gap-5 [&>div>h2]:text-xl")}
      >
        {items.length === 0 ? (
          <EmptyState title="No action items yet">
            Type the first one below as it comes up.
          </EmptyState>
        ) : (
          <ul
            className={cn("divide-y", big ? "text-[22px]" : "text-[15px]")}
            aria-label="Added action items"
          >
            {items.map((item) => (
              <li
                key={item.id}
                className={cn(
                  row,
                  "items-center py-2",
                  item.id === freshId &&
                    "animate-in duration-500 fade-in-0 slide-in-from-bottom-1 motion-reduce:animate-none",
                )}
              >
                <span className="min-w-0 font-medium break-words">
                  {item.title}
                </span>
                <span className="flex min-w-0 items-center gap-2">
                  <PersonAvatar
                    name={ownerName(item.owner)}
                    size={big ? "default" : "sm"}
                  />
                  <span className="truncate">{ownerName(item.owner)}</span>
                </span>
                <span className="text-[0.9em] text-muted-foreground">
                  {describeDue(item.dueDate, today)}
                </span>
                {item.can.delete ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size={big ? "default" : "sm"}
                    className="justify-self-start md:justify-self-end"
                    disabled={removing.has(item.id)}
                    onClick={() => void remove(item)}
                    aria-label={`Remove “${item.title}”`}
                  >
                    Remove
                  </Button>
                ) : (
                  <span />
                )}
              </li>
            ))}
          </ul>
        )}

        <form
          className={cn(row, "items-start border-t pt-4")}
          autoComplete="off"
          noValidate
          aria-label="New action item"
          onSubmit={(e) => {
            e.preventDefault();
            void advance();
          }}
        >
          <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor={fieldId("title")} className="sr-only">
              Action item
            </label>
            <Input
              ref={titleRef}
              id={fieldId("title")}
              autoFocus
              maxLength={200}
              placeholder={
                big
                  ? "Action item"
                  : "Action item, e.g. Book a room for the Dec GBM"
              }
              value={title}
              readOnly={saving}
              aria-invalid={errors.title ? true : undefined}
              aria-describedby={fieldId("title-hint")}
              className={field}
              onChange={(e) => {
                setTitle(e.target.value);
                clearError("title");
              }}
              onKeyDown={onEnter}
            />
            <span
              id={fieldId("title-hint")}
              className={hint("bad")}
              aria-live="polite"
            >
              {errors.title}
            </span>
          </div>

          <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor={fieldId("owner")} className="sr-only">
              Owner
            </label>
            <OwnerCombobox
              ref={ownerRef}
              id={fieldId("owner")}
              owners={owners}
              value={ownerId}
              onValueChange={(o) => {
                setOwnerId(o?.id ?? null);
                clearError("owner");
              }}
              inputValue={ownerText}
              onInputValueChange={(text) => {
                setOwnerText(text);
                clearError("owner");
              }}
              onEnter={(o) => void advance(o)}
              placeholder="Owner"
              readOnly={saving}
              aria-invalid={errors.owner ? true : undefined}
              aria-describedby={fieldId("owner-hint")}
              className={field}
              listClassName={big ? "text-lg" : undefined}
            />
            <span
              id={fieldId("owner-hint")}
              className={hint(errors.owner ? "bad" : "muted")}
              aria-live="polite"
            >
              {errors.owner ?? (picked ? ownerRole(picked) : "")}
            </span>
          </div>

          <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor={fieldId("due")} className="sr-only">
              Due date
            </label>
            <Input
              ref={dueRef}
              id={fieldId("due")}
              placeholder={big ? "Due: fri, 12/4" : "Due: fri, 12/4, next week"}
              value={dueText}
              readOnly={saving}
              spellCheck={false}
              aria-invalid={errors.due ? true : undefined}
              aria-describedby={fieldId("due-hint")}
              className={field}
              onChange={(e) => {
                setDueText(e.target.value);
                clearError("due");
              }}
              onKeyDown={onEnter}
            />
            <span
              id={fieldId("due-hint")}
              className={hint(errors.due ? "bad" : due ? "ok" : "muted")}
              aria-live="polite"
            >
              {errors.due ?? (due ? describeDue(due, today) : "")}
            </span>
          </div>

          <Button
            type="submit"
            size={big ? "lg" : "default"}
            className={cn(big ? "h-14 px-6 text-xl" : "h-11 px-5")}
            aria-disabled={saving}
          >
            {saving && <Spinner />}
            Add
          </Button>
        </form>

        {errors.form && (
          <p role="alert" className={hint("bad")}>
            {errors.form}
          </p>
        )}

        <div
          className={cn(
            "flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground",
            big ? "text-base" : "text-xs",
          )}
        >
          <span>
            Type the item, <Kbd>Enter</Kbd>, a name, <Kbd>Enter</Kbd>, a date,{" "}
            <Kbd>Enter</Kbd>. Then start the next one.
          </span>
          <span>
            Names match first names, last names or roles, like “events”.
          </span>
        </div>
      </Section>
    </>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-b-2 bg-card px-1.5 py-0.5 font-mono text-[0.85em] font-semibold text-foreground">
      {children}
    </kbd>
  );
}
