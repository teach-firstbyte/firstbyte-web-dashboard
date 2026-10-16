"use client";

import * as React from "react";
import Link from "next/link";
import { Check, QrCode, UserPlus, X } from "lucide-react";
import { toast } from "sonner";

import { Meter } from "@/components/common/Meter";
import { PersonAvatar } from "@/components/common/PersonAvatar";
import { EmptyState } from "@/components/common/Section";
import { Segmented } from "@/components/common/Segmented";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ATTENDANCE_STATUS, type AttendanceStatusValue } from "@/lib/enums";
import { formatTime } from "@/lib/format";
import { meetingPhase } from "@/lib/meetings";
import { withBasePath } from "@/lib/paths";
import type { Attendance, User } from "@/types/dashboard";

type Filter = "all" | "unmarked" | "present" | "absent";

const FILTER_STATUS: Record<Exclude<Filter, "all">, AttendanceStatusValue> = {
  unmarked: ATTENDANCE_STATUS.REGISTERED,
  present: ATTENDANCE_STATUS.PRESENT,
  absent: ATTENDANCE_STATUS.ABSENT,
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
 * Taking attendance at a meeting. Most people check themselves in with the QR
 * code, so this is for fixing the gaps: find a name, tap ✓ or ✕, add someone
 * who walked in, and at the end mark everyone left over as absent.
 *
 * Writes are optimistic, like the old AttendanceToggle: the row changes on tap
 * and the request reconciles behind it. A failed save reverts that person and
 * says so. Rows stay tappable so a mis-tap can be fixed at once.
 */
export function AttendanceRoster({
  meetingId,
  meetingTitle,
  scheduledAt,
}: {
  meetingId: number;
  meetingTitle: string;
  scheduledAt: Date | string;
}) {
  const [records, setRecords] = React.useState<Attendance[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<Filter>("all");
  const [query, setQuery] = React.useState("");
  const [members, setMembers] = React.useState<User[] | null>(null);
  const [saving, setSaving] = React.useState(0);

  // Per-row request counter. Tapping ✓ then ✕ on one person races two
  // requests; only the newest may write state.
  const seqRef = React.useRef(new Map<number, number>());

  React.useEffect(() => {
    let cancelled = false;
    send(`/api/attendance?meetingId=${meetingId}`, "GET")
      .then((rows: Attendance[]) => !cancelled && setRecords(rows))
      .catch(() => !cancelled && setLoadError("Could not load attendance."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [meetingId]);

  // The member list is only needed to add a walk-in, so fetch it the first
  // time someone searches.
  React.useEffect(() => {
    if (!query.trim() || members !== null) return;
    send("/api/users", "GET")
      .then((rows: User[]) => setMembers(rows))
      .catch(() => setMembers([]));
  }, [query, members]);

  const setStatus = (id: number, status: string) =>
    setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));

  const track = async (work: () => Promise<void>) => {
    setSaving((n) => n + 1);
    try {
      await work();
    } finally {
      setSaving((n) => n - 1);
    }
  };

  /** Tap ✓ or ✕. Tapping the one already on clears it back to not marked. */
  const mark = (record: Attendance, tapped: AttendanceStatusValue) => {
    const previous = record.status;
    const next = previous === tapped ? ATTENDANCE_STATUS.REGISTERED : tapped;
    const seq = (seqRef.current.get(record.id) ?? 0) + 1;
    seqRef.current.set(record.id, seq);
    const isStale = () => seqRef.current.get(record.id) !== seq;

    setStatus(record.id, next);
    track(async () => {
      try {
        const updated = await send(`/api/attendance/${record.id}`, "PUT", {
          status: next,
        });
        if (!isStale() && updated?.status) setStatus(record.id, updated.status);
      } catch {
        if (isStale()) return;
        setStatus(record.id, previous);
        toast.error(
          `Couldn't save ${record.user.name || record.user.email}. Try again.`,
        );
      }
    });
  };

  const unmarked = records.filter(
    (r) => r.status === ATTENDANCE_STATUS.REGISTERED,
  );

  /** "Mark the rest absent", with Undo. One request for everyone. */
  const markRestAbsent = () => {
    const ids = unmarked.map((r) => r.id);
    const apply = (status: AttendanceStatusValue) =>
      setRecords((prev) =>
        prev.map((r) => (ids.includes(r.id) ? { ...r, status } : r)),
      );
    apply(ATTENDANCE_STATUS.ABSENT);
    track(async () => {
      try {
        await send("/api/attendance/bulk", "PATCH", {
          meetingId,
          attendanceIds: ids,
          status: ATTENDANCE_STATUS.ABSENT,
        });
        toast(
          `Marked ${ids.length} ${ids.length === 1 ? "person" : "people"} absent`,
          {
            action: {
              label: "Undo",
              onClick: () => {
                apply(ATTENDANCE_STATUS.REGISTERED);
                send("/api/attendance/bulk", "PATCH", {
                  meetingId,
                  attendanceIds: ids,
                  status: ATTENDANCE_STATUS.REGISTERED,
                }).catch(() =>
                  toast.error("Couldn't undo that. Refresh and check."),
                );
              },
            },
          },
        );
      } catch (e) {
        apply(ATTENDANCE_STATUS.REGISTERED);
        toast.error(e instanceof Error ? e.message : "Couldn't save that.");
      }
    });
  };

  /** Add someone who walked in without being on the roster. */
  const addWalkIn = (member: User) => {
    setQuery("");
    track(async () => {
      try {
        const created = await send("/api/attendance", "POST", {
          userId: member.id,
          meetingId,
          status: ATTENDANCE_STATUS.PRESENT,
          checkedInAt: new Date().toISOString(),
        });
        const row: Attendance = {
          ...created,
          user: { name: member.name, email: member.email },
          meeting: { title: meetingTitle, scheduledAt: new Date(scheduledAt) },
        };
        setRecords((prev) => [...prev, row]);
        toast(`Added ${member.name || member.email} as present`, {
          action: {
            label: "Undo",
            onClick: () => {
              setRecords((prev) => prev.filter((r) => r.id !== row.id));
              send(`/api/attendance/${row.id}`, "DELETE").catch(() =>
                toast.error("Couldn't undo that. Refresh and check."),
              );
            },
          },
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't add them.");
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Loading attendance…
      </div>
    );
  }
  if (loadError) return <p className="text-sm text-destructive">{loadError}</p>;

  const count = (status: AttendanceStatusValue) =>
    records.filter((r) => r.status === status).length;
  const present = count(ATTENDANCE_STATUS.PRESENT);
  const absent = count(ATTENDANCE_STATUS.ABSENT);

  const q = query.trim().toLowerCase();
  const matches = (name: string | null, email: string) =>
    !q ||
    (name ?? "").toLowerCase().includes(q) ||
    email.toLowerCase().includes(q);

  const shown = records
    .filter((r) => filter === "all" || r.status === FILTER_STATUS[filter])
    .filter((r) => matches(r.user.name, r.user.email))
    .sort((a, b) =>
      (a.user.name ?? a.user.email).localeCompare(b.user.name ?? b.user.email),
    );

  const onRoster = new Set(records.map((r) => r.userId));
  const walkIns = q
    ? (members ?? [])
        .filter((m) => !onRoster.has(m.id) && matches(m.name, m.email))
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
              { value: "all", label: "Everyone", count: records.length },
              {
                value: "unmarked",
                label: "Not marked",
                count: unmarked.length,
              },
              { value: "present", label: "Present", count: present },
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
          parts={[{ value: present }, { value: absent, tone: "destructive" }]}
          total={records.length}
          label={`${present} present, ${absent} absent, ${unmarked.length} not marked`}
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
        {shown.map((record) => (
          <RosterRow key={record.id} record={record} onMark={mark} />
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
                    Didn&apos;t RSVP
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

      {started && unmarked.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted px-4 py-3">
          <p className="text-sm">
            <span className="font-semibold">Meeting over?</span>{" "}
            <span className="text-muted-foreground">
              {unmarked.length}{" "}
              {unmarked.length === 1 ? "person hasn't" : "people haven't"} been
              marked yet.
            </span>
          </p>
          <Button size="sm" variant="outline" onClick={markRestAbsent}>
            Mark the rest absent
          </Button>
        </div>
      )}
    </div>
  );
}

function RosterRow({
  record,
  onMark,
}: {
  record: Attendance;
  onMark: (record: Attendance, status: AttendanceStatusValue) => void;
}) {
  const who = record.user.name || record.user.email;
  const detail =
    record.status === ATTENDANCE_STATUS.PRESENT
      ? record.checkedInAt
        ? `Checked in ${formatTime(record.checkedInAt)}`
        : "Marked present"
      : record.status === ATTENDANCE_STATUS.ABSENT
        ? "Marked absent"
        : "Not marked";

  return (
    <li className="flex items-center gap-3 py-2.5">
      <PersonAvatar
        name={record.user.name}
        email={record.user.email}
        tone={
          record.status === ATTENDANCE_STATUS.PRESENT
            ? "brand"
            : record.status === ATTENDANCE_STATUS.ABSENT
              ? "danger"
              : "muted"
        }
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{who}</p>
        <p className="truncate text-sm text-muted-foreground">{detail}</p>
      </div>
      <div className="flex gap-1.5">
        <MarkButton
          on={record.status === ATTENDANCE_STATUS.PRESENT}
          tone="present"
          label={`Mark ${who} present`}
          onClick={() => onMark(record, ATTENDANCE_STATUS.PRESENT)}
        >
          <Check />
          <span className="hidden sm:inline">Present</span>
        </MarkButton>
        <MarkButton
          on={record.status === ATTENDANCE_STATUS.ABSENT}
          tone="absent"
          label={`Mark ${who} absent`}
          onClick={() => onMark(record, ATTENDANCE_STATUS.ABSENT)}
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
  tone,
  label,
  onClick,
  children,
}: {
  on: boolean;
  tone: "present" | "absent";
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    // Switch variants rather than layering colors over "outline": its dark-mode
    // background would win over a plain bg-* class and hide the pressed state.
    <Button
      size="sm"
      variant={
        on ? (tone === "present" ? "default" : "destructive") : "outline"
      }
      aria-pressed={on}
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
