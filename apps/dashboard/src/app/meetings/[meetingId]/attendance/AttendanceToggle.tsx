"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { AttendanceRosterRow } from "@/types/dashboard";
import { withBasePath } from "@/lib/paths";
import { useEffect, useRef, useState } from "react";

const STATUSES = ["REGISTERED", "PRESENT", "ABSENT"] as const;

interface AttendanceToggleProps {
  meetingId: number;
  meetingTitle: string;
}

// Taking attendance is a rapid-fire task -- an officer works down the roster
// tapping a status per person. The round trip to the database is roughly a
// second, so this writes optimistically: the highlight moves on click and the
// request reconciles behind it. Rows stay clickable so a mis-tap can be
// corrected immediately, and a failed save reverts that person and says so.
//
// Deliberately not useAsyncAction: that hook exists for modal saves where the
// user should wait for confirmation. Here waiting is the thing to avoid, and its
// useTransition would also deprioritise exactly the updates that need to feel
// instant.
export function AttendanceToggle({
  meetingId,
  meetingTitle,
}: AttendanceToggleProps) {
  const [records, setRecords] = useState<AttendanceRosterRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Separate from saveErrors: this one gates the whole card's early return, so
  // routing a failed save through it would blank the roster.
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveErrors, setSaveErrors] = useState<Record<number, string>>({});
  const [savingCount, setSavingCount] = useState(0);

  // Keyed by userId, not attendanceId: a member eligible for this meeting but
  // never marked has no attendance row yet, so userId is the only id every
  // row is guaranteed to have.
  const seqRef = useRef(new Map<number, number>());

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(
          withBasePath(`/api/meetings/${meetingId}/roster`),
        );
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        setRecords(await res.json());
      } catch {
        setLoadError("Could not load attendance.");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [meetingId]);

  async function updateStatus(userId: number, status: string) {
    const record = records.find((r) => r.userId === userId);
    // Re-tapping the status someone already has is a no-op, not a write.
    if (!record || record.status === status) return;
    const previousStatus = record.status;
    const who = record.user.name || record.user.email;

    const seq = (seqRef.current.get(userId) ?? 0) + 1;
    seqRef.current.set(userId, seq);
    const isStale = () => seqRef.current.get(userId) !== seq;

    const setRecord = (patch: Partial<AttendanceRosterRow>) =>
      setRecords((prev) =>
        prev.map((r) => (r.userId === userId ? { ...r, ...patch } : r)),
      );

    setRecord({ status });
    setSavingCount((n) => n + 1);

    try {
      // No attendance row yet -- this member became eligible after the
      // meeting was created, or is being marked for the first time. Create
      // one instead of PUTting a row id that doesn't exist.
      const res = record.attendanceId
        ? await fetch(withBasePath(`/api/attendance/${record.attendanceId}`), {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
          })
        : await fetch(withBasePath("/api/attendance"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, meetingId, status }),
          });
      if (!res.ok) throw new Error("Save failed");
      const updated = await res.json();
      if (isStale()) return;
      // Trust the server's values over ours in case it normalised anything,
      // and so a freshly-created row picks up its new attendanceId.
      setRecord({ attendanceId: updated.id, status: updated.status });
      setSaveErrors((prev) => {
        if (!(userId in prev)) return prev;
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    } catch {
      if (isStale()) return;
      setRecord({ status: previousStatus });
      setSaveErrors((prev) => ({
        ...prev,
        [userId]: `Could not save ${who} — change reverted.`,
      }));
    } finally {
      setSavingCount((n) => n - 1);
    }
  }

  if (isLoading)
    return (
      <p className="text-sm text-muted-foreground">Loading attendance...</p>
    );
  if (loadError) return <p className="text-sm text-destructive">{loadError}</p>;

  const errors = Object.values(saveErrors);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Take attendance</CardTitle>
        <CardDescription className="flex items-center gap-2">
          {meetingTitle}
          {/* One aggregate indicator instead of a spinner per row: with
              optimistic writes the moving highlight is the feedback, and
              per-row spinners would just add noise to a fast task. */}
          {savingCount > 0 && (
            <span className="flex items-center gap-1.5">
              <Spinner className="size-3" />
              Saving {savingCount}
              {savingCount === 1 ? " change" : " changes"}…
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {records.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No eligible members for this meeting.
          </p>
        ) : (
          records.map((record) => (
            <div
              key={record.userId}
              className="flex items-center justify-between border-b py-2"
            >
              <div>
                <div className="font-medium">{record.user.name || "N/A"}</div>
                <div className="text-sm text-muted-foreground">
                  {record.user.email}
                </div>
              </div>
              <div className="flex gap-1">
                {STATUSES.map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={record.status === s ? "default" : "outline"}
                    onClick={() => updateStatus(record.userId, s)}
                  >
                    {s.charAt(0) + s.slice(1).toLowerCase()}
                  </Button>
                ))}
              </div>
            </div>
          ))
        )}
        {errors.length > 0 && (
          <div className="mt-3 space-y-1">
            {errors.map((message) => (
              <p key={message} className="text-sm text-destructive">
                {message}
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
