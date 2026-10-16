"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Segmented } from "@/components/common/Segmented";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { TEAM_JOIN_POLICY } from "@/lib/enums";
import { formatLongDateTime } from "@/lib/format";
import {
  MEETING_TYPES,
  meetingTypeLabel,
  type MeetingTypeValue,
} from "@/lib/meetings";
import { withBasePath } from "@/lib/paths";

/** The meeting fields this form reads and writes. */
export type MeetingFormSource = {
  id: number;
  title: string;
  type: string;
  scheduledAt: Date | string;
  location: string | null;
  teamId: number | null;
  isRequired: boolean;
  description: string | null;
  maxCapacity: number | null;
};

type TeamOption = { id: number; name: string; joinPolicy: string };

type FormState = {
  title: string;
  type: MeetingTypeValue;
  date: string;
  time: string;
  location: string;
  teamId: string;
  isRequired: boolean;
  description: string;
  maxCapacity: string;
};

const pad = (n: number) => String(n).padStart(2, "0");
const toDateInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeInput = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

function fromMeeting(m: MeetingFormSource, shiftDays = 0): FormState {
  const at = new Date(m.scheduledAt);
  at.setDate(at.getDate() + shiftDays);
  return {
    title: m.title,
    type: (MEETING_TYPES as readonly string[]).includes(m.type)
      ? (m.type as MeetingTypeValue)
      : "GENERAL_MEETING",
    date: toDateInput(at),
    time: toTimeInput(at),
    location: m.location ?? "",
    teamId: m.teamId ? String(m.teamId) : "",
    isRequired: m.isRequired,
    description: m.description ?? "",
    maxCapacity: m.maxCapacity ? String(m.maxCapacity) : "",
  };
}

const BLANK: FormState = {
  title: "",
  type: "GENERAL_MEETING",
  date: "",
  time: "19:00",
  location: "",
  teamId: "",
  isRequired: true,
  description: "",
  maxCapacity: "",
};

/** The next same weekday at the same time, at least a week from today. */
function nextOccurrence(template: MeetingFormSource) {
  const at = new Date(template.scheduledAt);
  const now = new Date();
  while (at <= now) at.setDate(at.getDate() + 7);
  return at;
}

export type MeetingFormMode = "new" | "edit" | "duplicate";

/**
 * Create, edit or duplicate a meeting. One form for all three, so the fields
 * and their rules can't drift apart the way the old add and edit modals did.
 *
 * Saves through the existing routes: POST /api/meetings to create (which also
 * builds the roster), PUT /api/meetings/:id to edit.
 *
 * The parent passes a `key` that changes per meeting and mode, so the form
 * starts fresh each time it opens rather than keeping the last one's input.
 */
export function MeetingFormDialog({
  mode,
  meeting,
  template,
  locations,
  open,
  onOpenChange,
}: {
  mode: MeetingFormMode;
  /** The meeting being edited or duplicated. */
  meeting?: MeetingFormSource | null;
  /** For "Copy last general meeting" on a new meeting. */
  template?: MeetingFormSource | null;
  /** Rooms used before, offered as suggestions. */
  locations: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const save = useAsyncAction();
  const [form, setForm] = React.useState<FormState>(() =>
    meeting ? fromMeeting(meeting, mode === "duplicate" ? 7 : 0) : BLANK,
  );
  const [startFrom, setStartFrom] = React.useState<"blank" | "template">(
    "blank",
  );
  const [teams, setTeams] = React.useState<TeamOption[]>([]);
  const [teamsError, setTeamsError] = React.useState(false);
  const [touched, setTouched] = React.useState(false);

  // Loaded when the dialog opens: the team list is officer-only and small.
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch(withBasePath("/api/teams"))
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then((data: TeamOption[]) => !cancelled && setTeams(data))
      .catch(() => !cancelled && setTeamsError(true));
    return () => {
      cancelled = true;
    };
  }, [open]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  /** Picking a type fills in the usual audience on a new meeting. */
  const chooseType = (type: MeetingTypeValue) => {
    setForm((prev) => {
      if (mode !== "new") return { ...prev, type };
      const board = teams.find(
        (t) => t.joinPolicy === TEAM_JOIN_POLICY.INVITE_ONLY,
      );
      switch (type) {
        case "GENERAL_MEETING":
          return { ...prev, type, teamId: "", isRequired: true };
        case "EBOARD_MEETING":
          return {
            ...prev,
            type,
            teamId: board ? String(board.id) : prev.teamId,
            isRequired: true,
          };
        default:
          return { ...prev, type, isRequired: false };
      }
    });
  };

  const applyStartFrom = (choice: "blank" | "template") => {
    setStartFrom(choice);
    if (choice === "template" && template) {
      const next = fromMeeting(template);
      const at = nextOccurrence(template);
      setForm({ ...next, date: toDateInput(at), time: toTimeInput(at) });
    } else {
      setForm(BLANK);
    }
  };

  const titleError = touched && !form.title.trim() ? "Give it a name." : null;
  const dateError = touched && !form.date ? "Pick a date." : null;
  const when =
    form.date && form.time ? new Date(`${form.date}T${form.time}`) : null;
  const teamName = teams.find((t) => String(t.id) === form.teamId)?.name;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!form.title.trim() || !when) return;

    save.run(async () => {
      const body = {
        title: form.title.trim(),
        type: form.type,
        scheduledAt: when.toISOString(),
        description: form.description.trim() || null,
        teamId: form.teamId ? Number(form.teamId) : null,
        location: form.location.trim() || null,
        isRequired: form.isRequired,
        maxCapacity: form.maxCapacity ? Number(form.maxCapacity) : null,
      };
      const editing = mode === "edit" && meeting;
      const res = await fetch(
        withBasePath(editing ? `/api/meetings/${meeting.id}` : "/api/meetings"),
        {
          method: editing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "That meeting could not be saved.");
      }
      // Refresh inside the transition so Save keeps spinning until the list
      // underneath shows the change.
      router.refresh();
      onOpenChange(false);
      toast(editing ? "Changes saved" : `Created “${body.title}”`);
    });
  };

  const heading =
    mode === "edit"
      ? "Edit meeting"
      : mode === "duplicate"
        ? "Duplicate meeting"
        : "New meeting";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
          <DialogDescription>
            {mode === "duplicate"
              ? "Same details, one week later. Change anything you need."
              : "Members invited to it see it on their home page."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} noValidate>
          <FieldGroup className="gap-5">
            {mode === "new" && template && (
              <FieldSet>
                <FieldLegend variant="label">Start from</FieldLegend>
                <Segmented
                  label="Start from"
                  variant="chips"
                  value={startFrom}
                  onValueChange={applyStartFrom}
                  options={[
                    { value: "blank", label: "Blank" },
                    { value: "template", label: `Copy “${template.title}”` },
                  ]}
                />
              </FieldSet>
            )}

            <Field data-invalid={!!titleError || undefined}>
              <FieldLabel htmlFor="meeting-title">Name</FieldLabel>
              <Input
                id="meeting-title"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="e.g. General Meeting #8"
                aria-invalid={!!titleError}
                autoFocus
              />
              {titleError && <FieldError>{titleError}</FieldError>}
            </Field>

            <FieldSet>
              <FieldLegend variant="label">Type</FieldLegend>
              <Segmented
                label="Meeting type"
                variant="chips"
                value={form.type}
                onValueChange={chooseType}
                options={MEETING_TYPES.map((type) => ({
                  value: type,
                  label: meetingTypeLabel(type),
                }))}
              />
              {mode === "new" && (
                <FieldDescription>
                  Picking a type fills in who it&apos;s for and whether
                  it&apos;s required.
                </FieldDescription>
              )}
            </FieldSet>

            <div className="grid grid-cols-2 gap-3">
              <Field data-invalid={!!dateError || undefined}>
                <FieldLabel htmlFor="meeting-date">Date</FieldLabel>
                <Input
                  id="meeting-date"
                  type="date"
                  value={form.date}
                  onChange={(e) => set("date", e.target.value)}
                  aria-invalid={!!dateError}
                />
                {dateError && <FieldError>{dateError}</FieldError>}
              </Field>
              <Field>
                <FieldLabel htmlFor="meeting-time">Start time</FieldLabel>
                <Input
                  id="meeting-time"
                  type="time"
                  value={form.time}
                  onChange={(e) => set("time", e.target.value)}
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="meeting-location">Where</FieldLabel>
              <Input
                id="meeting-location"
                list="meeting-locations"
                value={form.location}
                onChange={(e) => set("location", e.target.value)}
                placeholder="Room or address"
              />
              <datalist id="meeting-locations">
                {locations.map((l) => (
                  <option key={l} value={l} />
                ))}
              </datalist>
            </Field>

            <Field data-invalid={teamsError || undefined}>
              <FieldLabel htmlFor="meeting-team">Who&apos;s invited</FieldLabel>
              <NativeSelect
                id="meeting-team"
                data-full
                value={form.teamId}
                onChange={(e) => set("teamId", e.target.value)}
              >
                <NativeSelectOption value="">All members</NativeSelectOption>
                {teams.map((t) => (
                  <NativeSelectOption key={t.id} value={t.id}>
                    {t.name} team
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {teamsError && (
                <FieldError>
                  Couldn&apos;t load teams. Try reopening.
                </FieldError>
              )}
            </Field>

            <Field orientation="horizontal" className="rounded-xl border p-3">
              <FieldContent>
                <FieldLabel htmlFor="meeting-required">Required</FieldLabel>
                <FieldDescription>
                  Members see it marked as required.
                </FieldDescription>
              </FieldContent>
              <Switch
                id="meeting-required"
                checked={form.isRequired}
                onCheckedChange={(v) => set("isRequired", v)}
              />
            </Field>

            <details
              className="group rounded-xl border p-3"
              open={!!(form.description || form.maxCapacity) || undefined}
            >
              <summary className="cursor-pointer text-sm font-medium text-muted-foreground select-none group-open:mb-4">
                More options
              </summary>
              <FieldGroup className="gap-4">
                <Field>
                  <FieldLabel htmlFor="meeting-description">
                    Description
                  </FieldLabel>
                  <Textarea
                    id="meeting-description"
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
                    placeholder="What will happen, what to bring"
                    rows={3}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="meeting-capacity">Max people</FieldLabel>
                  <Input
                    id="meeting-capacity"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={form.maxCapacity}
                    onChange={(e) => set("maxCapacity", e.target.value)}
                    className="max-w-32"
                  />
                  <FieldDescription>Leave empty for no limit.</FieldDescription>
                </Field>
              </FieldGroup>
            </details>

            <p className="text-sm text-muted-foreground" aria-live="polite">
              <span className="font-medium text-foreground">
                {when ? formatLongDateTime(when) : "No date yet"}
              </span>
              {form.location.trim() && ` · ${form.location.trim()}`} ·{" "}
              {form.isRequired ? "Required for " : "Open to "}
              {teamName ? `the ${teamName} team` : "all members"}
            </p>

            {save.error && (
              <p className="text-sm text-destructive">{save.error}</p>
            )}
          </FieldGroup>

          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={save.pending}
            >
              Cancel
            </Button>
            <Button type="submit" pending={save.pending} pendingLabel="Saving…">
              {mode === "edit" ? "Save changes" : "Create meeting"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
