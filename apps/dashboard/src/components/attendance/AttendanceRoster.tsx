"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarX2, Check, QrCode, UserPlus, X } from "lucide-react";
import { toast } from "sonner";

import { Meter } from "@/components/common/Meter";
import { PersonAvatar } from "@/components/common/PersonAvatar";
import { EmptyState } from "@/components/common/Section";
import { Segmented } from "@/components/common/Segmented";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { formatDateTime, formatTime } from "@/lib/format";
import { meetingPhase } from "@/lib/meetings";
import { withBasePath } from "@/lib/paths";
import type {
  MeetingRoster,
  RosterRow,
  RosterStatus,
  User,
} from "@/types/dashboard";

type Filter = "all" | "unmarked" | "present" | "excused" | "absent";

const FILTER_STATUS: Record<Exclude<Filter, "all">, RosterStatus | null> = {
  unmarked: null,
  present: "PRESENT",
  excused: "EXCUSED",
  absent: "ABSENT",
};

async function send(path: string, method: string, body?: unknown) {
  const res = await fetch(withBasePath(path), {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? "That change could not be saved.");
  }
  return res.json().catch(() => null);
}

/**
 * Taking attendance at a meeting. The list is everyone the meeting is for
 * right now, so nobody has to be added by hand unless they walked in. Most
 * people check themselves in with the QR code, and some excuse themselves
 * before it starts, so this is for fixing the gaps: find a name, tap Present,
 * Excused or Absent, add a walk-in, and at the end Close attendance.
 *
 * Writes are optimistic: the row changes on tap and the request reconciles
 * behind it. A failed save reverts that person and says so. Rows stay
 * tappable, even after closing, so a mis-tap can be fixed at once.
 */
export function AttendanceRoster({
  meetingId,
  scheduledAt,
}: {
  meetingId: number;
  scheduledAt: Date | string;
}) {
  const [roster, setRoster] = React.useState<MeetingRoster | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<Filter>("all");
  const [query, setQuery] = React.useState("");
  const [members, setMembers] = React.useState<User[] | null>(null);
  const [saving, setSaving] = React.useState(0);

  // Per-person request counter. Tapping ✓ then ✕ on one person races two
  // requests; only the newest may write state.
  const seqRef = React.useRef(new Map<number, number>());

  const load = React.useCallback(
    () =>
      send(`/api/meetings/${meetingId}/roster`, "GET")
        .then((data: MeetingRoster) => setRoster(data))
        .catch(() => setLoadError("Could not load attendance.")),
    [meetingId],
  );

  React.useEffect(() => {
    load();
  }, [load]);

  // The member list is only needed to add a walk-in, so fetch it the first
  // time someone searches.
  React.useEffect(() => {
    if (!query.trim() || members !== null) return;
    send("/api/users", "GET")
      .then((rows: User[]) => setMembers(rows))
      .catch(() => setMembers([]));
  }, [query, members]);

  const patchRow = (userId: number, patch: Partial<RosterRow>) =>
    setRoster((prev) =>
      prev
        ? {
            ...prev,
            rows: prev.rows.map((r) =>
              r.userId === userId ? { ...r, ...patch } : r,
            ),
          }
        : prev,
    );

  const track = async (work: () => Promise<void>) => {
    setSaving((n) => n + 1);
    try {
      await work();
    } finally {
      setSaving((n) => n - 1);
    }
  };

  /** Tap a status. Tapping the one already on clears it back to not marked. */
  const mark = (row: RosterRow, tapped: RosterStatus) => {
    const previous = row.status;
    const next = previous === tapped ? null : tapped;
    const seq = (seqRef.current.get(row.userId) ?? 0) + 1;
    seqRef.current.set(row.userId, seq);
    const isStale = () => seqRef.current.get(row.userId) !== seq;

    patchRow(row.userId, { status: next, selfMarked: false });
    track(async () => {
      try {
        await send(`/api/meetings/${meetingId}/roster/${row.userId}`, "PUT", {
          status: next,
        });
      } catch {
        if (isStale()) return;
        patchRow(row.userId, { status: previous, selfMarked: row.selfMarked });
        toast.error(`Couldn't save ${row.name || row.email}. Try again.`);
      }
    });
  };

  /** Close attendance: everyone not marked becomes Absent. */
  const closeAttendance = () => {
    track(async () => {
      try {
        const { markedAbsent } = await send(
          `/api/meetings/${meetingId}/close-attendance`,
          "POST",
        );
        await load();
        toast(
          markedAbsent > 0
            ? `Attendance closed. Marked ${markedAbsent} ${markedAbsent === 1 ? "person" : "people"} absent.`
            : "Attendance closed.",
        );
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't close it.");
      }
    });
  };

  /** Add someone the meeting wasn't for, as present. */
  const addWalkIn = (member: User) => {
    setQuery("");
    const row: RosterRow = {
      userId: member.id,
      name: member.name,
      email: member.email,
      status: "PRESENT",
      checkedInAt: null,
      notes: null,
      selfMarked: false,
      expected: false,
    };
    setRoster((prev) => (prev ? { ...prev, rows: [...prev.rows, row] } : prev));
    track(async () => {
      try {
        await send(`/api/meetings/${meetingId}/roster/${member.id}`, "PUT", {
          status: "PRESENT",
        });
        toast(`Added ${member.name || member.email} as present`, {
          action: {
            label: "Undo",
            onClick: () => {
              setRoster((prev) =>
                prev
                  ? {
                      ...prev,
                      rows: prev.rows.filter((r) => r.userId !== member.id),
                    }
                  : prev,
              );
              send(`/api/meetings/${meetingId}/roster/${member.id}`, "PUT", {
                status: null,
              }).catch(() =>
                toast.error("Couldn't undo that. Refresh and check."),
              );
            },
          },
        });
      } catch (e) {
        setRoster((prev) =>
          prev
            ? { ...prev, rows: prev.rows.filter((r) => r.userId !== member.id) }
            : prev,
        );
        toast.error(e instanceof Error ? e.message : "Couldn't add them.");
      }
    });
  };

  if (loadError) return <p className="text-sm text-destructive">{loadError}</p>;
  if (!roster) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Loading attendance…
      </div>
    );
  }

  // A walk-in someone cleared back to "not marked" has no reason to stay on
  // the list: the meeting wasn't for them.
  const rows = roster.rows.filter((r) => r.expected || r.status !== null);
  const count = (status: RosterStatus | null) =>
    rows.filter((r) => r.status === status).length;
  const present = count("PRESENT");
  const excused = count("EXCUSED");
  const absent = count("ABSENT");
  const unmarked = count(null);

  const q = query.trim().toLowerCase();
  const matches = (name: string | null, email: string) =>
    !q ||
    (name ?? "").toLowerCase().includes(q) ||
    email.toLowerCase().includes(q);

  const shown = rows
    .filter((r) => filter === "all" || r.status === FILTER_STATUS[filter])
    .filter((r) => matches(r.name, r.email))
    .sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email));

  const onRoster = new Set(rows.map((r) => r.userId));
  const walkIns = q
    ? (members ?? [])
        .filter(
          (m) =>
            m.status === "APPROVED" &&
            !onRoster.has(m.id) &&
            matches(m.name, m.email),
        )
        .slice(0, 5)
    : [];

  const started = meetingPhase(scheduledAt) !== "upcoming";

  return (
    <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Segmented
            label="Show"
            value={filter}
            onValueChange={setFilter}
            options={[
              { value: "all", label: "Everyone", count: rows.length },
              { value: "unmarked", label: "Not marked", count: unmarked },
              { value: "present", label: "Present", count: present },
              { value: "excused", label: "Excused", count: excused },
              { value: "absent", label: "Absent", count: absent },
            ]}
          />
          <span
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
            aria-live="polite"
          >
            {saving > 0 && (
              <>
                <Spinner className="size-3" /> Saving…
              </>
            )}
          </span>
        </div>
        <Meter
          parts={[
            { value: present },
            { value: excused, tone: "warning" },
            { value: absent, tone: "destructive" },
          ]}
          total={rows.length}
          label={`${present} present, ${excused} excused, ${absent} absent, ${unmarked} not marked`}
        />
      </div>

      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Find a name, or type one to add a walk-in"
        aria-label="Find a person"
        className="rounded-full"
      />

      <ul className="-my-1 divide-y">
        {shown.map((row) => (
          <RosterRowItem key={row.userId} row={row} onMark={mark} />
        ))}
      </ul>

      {walkIns.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Not on the list
          </p>
          <ul className="flex flex-col gap-2">
            {walkIns.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-3 rounded-xl border border-dashed p-2.5"
              >
                <PersonAvatar name={m.name} email={m.email} tone="muted" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{m.name || m.email}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    This meeting isn&apos;t for them
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => addWalkIn(m)}
                >
                  <UserPlus data-icon="inline-start" />
                  Add as present
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {shown.length === 0 && walkIns.length === 0 && (
        <EmptyState
          title={
            q
              ? `No one named “${query.trim()}”`
              : filter === "unmarked"
                ? "Everyone is marked"
                : "No one here yet"
          }
          action={
            q ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/meetings/${meetingId}/check-in-display`}>
                  <QrCode data-icon="inline-start" />
                  Show the check-in QR
                </Link>
              </Button>
            ) : undefined
          }
        >
          {q
            ? "Check the spelling, or ask them to scan the QR code."
            : filter === "unmarked"
              ? "You can still change anyone under Everyone."
              : undefined}
        </EmptyState>
      )}

      {roster.closed ? (
        <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
          {roster.closedAt
            ? `Attendance closed ${formatDateTime(roster.closedAt)}.`
            : "Attendance for this meeting is closed."}{" "}
          You can still change anyone.
        </p>
      ) : (
        started && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted px-4 py-3">
            <p className="text-sm">
              <span className="font-semibold">Meeting over?</span>{" "}
              <span className="text-muted-foreground">
                {unmarked === 0
                  ? "Everyone is marked."
                  : `${unmarked} ${unmarked === 1 ? "person isn't" : "people aren't"} marked yet. Closing marks them absent.`}{" "}
                It closes by itself 3 hours after the start.
              </span>
            </p>
            <Button size="sm" variant="outline" onClick={closeAttendance}>
              Close attendance
            </Button>
          </div>
        )
      )}
    </div>
  );
}

function rowDetail(row: RosterRow): string {
  switch (row.status) {
    case "PRESENT":
      return row.checkedInAt
        ? `Checked in ${formatTime(row.checkedInAt)}`
        : row.expected
          ? "Marked present"
          : "Walk-in, marked present";
    case "EXCUSED": {
      const who = row.selfMarked ? "Can't make it" : "Excused by an officer";
      return row.notes ? `${who}: ${row.notes}` : who;
    }
    case "ABSENT":
      return "Absent";
    default:
      return "Not marked";
  }
}

function RosterRowItem({
  row,
  onMark,
}: {
  row: RosterRow;
  onMark: (row: RosterRow, status: RosterStatus) => void;
}) {
  const who = row.name || row.email;

  return (
    <li className="flex items-center gap-3 py-2.5">
      <PersonAvatar
        name={row.name}
        email={row.email}
        tone={
          row.status === "PRESENT"
            ? "brand"
            : row.status === "ABSENT"
              ? "danger"
              : "muted"
        }
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{who}</p>
        <p className="truncate text-sm text-muted-foreground">
          {rowDetail(row)}
        </p>
      </div>
      <div className="flex gap-1.5">
        <MarkButton
          on={row.status === "PRESENT"}
          variantOn="default"
          label={`Mark ${who} present`}
          onClick={() => onMark(row, "PRESENT")}
        >
          <Check />
          <span className="hidden sm:inline">Present</span>
        </MarkButton>
        <MarkButton
          on={row.status === "EXCUSED"}
          variantOn="secondary"
          label={`Mark ${who} excused`}
          onClick={() => onMark(row, "EXCUSED")}
        >
          <CalendarX2 />
          <span className="hidden sm:inline">Excused</span>
        </MarkButton>
        <MarkButton
          on={row.status === "ABSENT"}
          variantOn="destructive"
          label={`Mark ${who} absent`}
          onClick={() => onMark(row, "ABSENT")}
        >
          <X />
          <span className="hidden sm:inline">Absent</span>
        </MarkButton>
      </div>
    </li>
  );
}

function MarkButton({
  on,
  variantOn,
  label,
  onClick,
  children,
}: {
  on: boolean;
  variantOn: "default" | "secondary" | "destructive";
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    // Switch variants rather than layering colors over "outline": its dark-mode
    // background would win over a plain bg-* class and hide the pressed state.
    <Button
      size="sm"
      variant={on ? variantOn : "outline"}
      aria-pressed={on}
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
