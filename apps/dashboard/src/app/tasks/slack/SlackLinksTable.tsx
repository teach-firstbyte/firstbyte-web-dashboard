"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { PersonAvatar } from "@/components/common/PersonAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableEmptyState } from "@/components/ui/TableEmptyState";
import { withBasePath } from "@/lib/paths";
import {
  SLACK_MEMBER_ID_ERROR,
  normalizeSlackMemberId,
} from "@/lib/tasks/slack-member-id";
import { cn } from "@/lib/utils";

/** What the page passes in: one approved e-board member. */
export type SlackLinkRow = {
  userId: number;
  name: string;
  email: string;
  slackUserId: string | null;
};

const HINT = "In Slack: open their profile, click ⋮, then Copy member ID.";

async function send(userId: number, method: "PUT" | "DELETE", body?: unknown) {
  const res = await fetch(withBasePath(`/api/tasks/slack/${userId}`), {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? "That didn't save. Try again.");
  }
}

const firstName = (name: string) => name.split(/\s+/)[0] || name;

/**
 * The e-board's Slack links, with Link, Change and Unlink on each row. One row
 * is edited at a time, inline, like the mockup's Slack setup screen.
 *
 * The ID is checked here first for a quick answer, then again on the server,
 * which also refuses an ID already linked to someone else.
 */
export function SlackLinksTable({ rows }: { rows: SlackLinkRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<number | null>(null);
  const [value, setValue] = React.useState("");
  const [error, setError] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editing !== null) inputRef.current?.focus();
  }, [editing]);

  function startEditing(row: SlackLinkRow) {
    setEditing(row.userId);
    setValue(row.slackUserId ?? "");
    setError("");
  }

  function stopEditing() {
    setEditing(null);
    setValue("");
    setError("");
  }

  async function save(row: SlackLinkRow, e: React.FormEvent) {
    e.preventDefault();
    const id = normalizeSlackMemberId(value);
    if (!id) {
      setError(SLACK_MEMBER_ID_ERROR);
      inputRef.current?.focus();
      return;
    }
    if (id === row.slackUserId) {
      stopEditing();
      return;
    }
    setPending(true);
    try {
      await send(row.userId, "PUT", { slackUserId: id });
      stopEditing();
      toast.success(`Linked ${row.name}`, {
        description: `${firstName(row.name)} gets reminders from the next one on.`,
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      inputRef.current?.focus();
    } finally {
      setPending(false);
    }
  }

  async function unlink(row: SlackLinkRow) {
    setPending(true);
    try {
      await send(row.userId, "DELETE");
      toast.success(`Unlinked ${row.name}`, {
        description: `${firstName(row.name)} won't get reminders until they're linked again.`,
      });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Person</TableHead>
            <TableHead>Slack member ID</TableHead>
            <TableHead>
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableEmptyState
              colSpan={3}
              message="No one is on the e-board yet. Add people to the E-Board team first."
            />
          )}
          {rows.map((row) => {
            const isEditing = editing === row.userId;
            const inputId = `slack-${row.userId}`;
            const hintId = `${inputId}-hint`;
            return (
              <TableRow key={row.userId} className="align-top">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <PersonAvatar name={row.name} email={row.email} size="sm" />
                    <div className="flex min-w-0 flex-col">
                      <span className="font-medium">{row.name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {row.email}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="min-w-[16rem] whitespace-normal">
                  {isEditing ? (
                    <form
                      noValidate
                      onSubmit={(e) => save(row, e)}
                      className="flex flex-wrap items-start gap-2"
                    >
                      <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
                        <label htmlFor={inputId} className="sr-only">
                          Slack member ID for {row.name}
                        </label>
                        <Input
                          ref={inputRef}
                          id={inputId}
                          value={value}
                          onChange={(e) => {
                            setValue(e.target.value);
                            if (error) setError("");
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") stopEditing();
                          }}
                          placeholder="U07ABC1234"
                          autoComplete="off"
                          spellCheck={false}
                          aria-invalid={error ? true : undefined}
                          aria-describedby={hintId}
                          className="font-mono"
                          disabled={pending}
                        />
                        <span
                          id={hintId}
                          role={error ? "alert" : undefined}
                          className={cn(
                            "text-xs",
                            error
                              ? "text-destructive"
                              : "text-muted-foreground",
                          )}
                        >
                          {error || HINT}
                        </span>
                      </div>
                      <Button type="submit" size="sm" disabled={pending}>
                        Save
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={stopEditing}
                        disabled={pending}
                      >
                        Cancel
                      </Button>
                    </form>
                  ) : row.slackUserId ? (
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">
                      {row.slackUserId}
                    </code>
                  ) : (
                    <Badge variant="warning">
                      <TriangleAlert aria-hidden="true" />
                      Not linked: no reminders
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {!isEditing &&
                    (row.slackUserId ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEditing(row)}
                          disabled={pending}
                          aria-label={`Change ${row.name}'s Slack member ID`}
                        >
                          Change
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => unlink(row)}
                          disabled={pending}
                          aria-label={`Unlink ${row.name} from Slack`}
                        >
                          Unlink
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => startEditing(row)}
                        disabled={pending}
                        aria-label={`Link ${row.name} to Slack`}
                      >
                        Link
                      </Button>
                    ))}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
