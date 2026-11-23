"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { withBasePath } from "@/lib/paths";
import {
  hourLabel,
  joinNames,
  nextSummaryLabel,
  WEEKDAY_NAMES,
  type SummarySchedule,
  type SummarySlot,
} from "@/lib/tasks/weekly-summary";

/** What the page passes in: getSummarySetup's answer. */
export type SummarySetupProps = {
  schedule: SummarySchedule;
  next: SummarySlot & { now: boolean };
  recipients: { userId: number; name: string; getsIt: boolean }[];
};

// 6 AM to 9 PM, like the mockup. A saved hour outside it is still offered.
const HOURS = Array.from({ length: 16 }, (_, i) => i + 6);

const firstName = (name: string) => name.split(/\s+/)[0] || name;

/**
 * The weekly summary's day and time, on Slack setup. One setting for the
 * club. Saving takes effect from the next hourly run; a week that already had
 * its summary doesn't get another.
 *
 * The page keys it by the saved day and hour, so after a save (and
 * router.refresh) it starts again from the new values.
 */
export function SummaryScheduleForm({
  schedule,
  next,
  recipients,
}: SummarySetupProps) {
  const router = useRouter();
  const [day, setDay] = React.useState(schedule.day);
  const [hour, setHour] = React.useState(schedule.hour);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState("");

  const hours = HOURS.includes(schedule.hour)
    ? HOURS
    : [...HOURS, schedule.hour].sort((a, b) => a - b);
  const changed = day !== schedule.day || hour !== schedule.hour;
  const getting = recipients.filter((r) => r.getsIt).map((r) => r.name);
  const missing = recipients.filter((r) => !r.getsIt).map((r) => r.name);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      const res = await fetch(withBasePath("/api/tasks/summary"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day, hour }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "That didn't save. Try again.");
      }
      const saved = data as SummarySetupProps;
      toast.success("Saved", { description: nextSummaryLabel(saved.next) });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="-mt-1 text-sm text-muted-foreground">
        {getting.length > 0
          ? `A Slack DM to ${joinNames(getting.map(firstName))}: what's overdue or due in the next 7 days by person, tasks that need a new owner, and who isn't connected to Slack.`
          : "No super admin is on the e-board and linked to Slack yet, so nobody gets it."}
        {missing.length > 0 &&
          ` ${joinNames(missing)} won't get it until they're on the E-Board team and linked above.`}
      </p>
      <form
        noValidate
        onSubmit={save}
        className="flex flex-wrap items-end gap-3"
        aria-describedby="summary-next"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="summary-day" className="text-sm font-medium">
            Day
          </label>
          <NativeSelect
            id="summary-day"
            value={day}
            onChange={(e) => setDay(Number(e.target.value))}
            disabled={pending}
          >
            {WEEKDAY_NAMES.map((name, i) => (
              <NativeSelectOption key={name} value={i}>
                {name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="summary-hour" className="text-sm font-medium">
            Time (Boston)
          </label>
          <NativeSelect
            id="summary-hour"
            value={hour}
            onChange={(e) => setHour(Number(e.target.value))}
            disabled={pending}
          >
            {hours.map((h) => (
              <NativeSelectOption key={h} value={h}>
                {hourLabel(h)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <Button type="submit" disabled={pending || !changed}>
          Save
        </Button>
        <span
          id="summary-next"
          role="status"
          className="pb-2 text-sm text-muted-foreground"
        >
          {nextSummaryLabel(next)}
        </span>
      </form>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
