"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardButton,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import Link from "next/link";
import React, { useActionState, useEffect, useState } from "react";
import {
  Modal,
  ModalHeader,
  ModalButton,
  ModalDropdown,
} from "@/components/ui/modal";
import { SubmitButton } from "@/components/SubmitButton";
import { Meeting } from "@/types/dashboard";
import { withBasePath } from "@/lib/paths";
import { TableEmptyState } from "./ui/TableEmptyState";
import { MeetingStatusBadge } from "./MeetingStatusBadge";
import { useDetailRow } from "@/hooks/useDetailRow";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { MeetingDetailSheet } from "./MeetingDetailSheet";
import { updateMeetingAction } from "@/app/actions/meetings";

interface MeetingsTableProps {
  meetings: Meeting[];
}

// Mirrors the MeetingType enum in prisma/schema.prisma. The POST /api/meetings
// route validates against this same set, so keep them in sync.
const MEETING_TYPES = [
  "GENERAL_MEETING",
  "BOARD_MEETING",
  "SOCIAL_EVENT",
  "FIRSTBITES",
  "CHV_WORKSHOP",
  "WORKSHOP",
] as const;

interface NewMeeting {
  title: string;
  type: string;
  teamId: string;
  scheduledAt: string;
  description: string;
  location: string;
  isRequired: boolean;
  maxCapacity: string;
}

const emptyMeeting: NewMeeting = {
  title: "",
  type: "",
  teamId: "none",
  scheduledAt: "",
  description: "",
  location: "",
  isRequired: false,
  maxCapacity: "",
};

/** `Date` -> the value a `<input type="datetime-local">` expects, in local time. */
function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

interface EditMeetingModalProps {
  meeting: Meeting;
  onClose: () => void;
}

function EditMeetingModal({ meeting, onClose }: EditMeetingModalProps) {
  const [state, formAction] = useActionState(
    updateMeetingAction.bind(null, meeting.id),
    {},
  );
  const [teams, setTeams] = useState<{ id: number; name: string }[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [teamId, setTeamId] = useState(
    meeting.teamId ? String(meeting.teamId) : "none",
  );
  const [type, setType] = useState(meeting.type);

  useEffect(() => {
    setTeamsLoading(true);
    fetch(withBasePath("/api/teams"))
      .then((res) => res.json())
      .then((data) => setTeams(data))
      .catch(() => setTeams([]))
      .finally(() => setTeamsLoading(false));
  }, []);

  useEffect(() => {
    if (state.success) onClose();
  }, [state.success, onClose]);

  return (
    <Modal onClose={onClose}>
      <ModalHeader>Edit Meeting</ModalHeader>
      <form action={formAction} className="flex flex-col space-y-3">
        <Input
          type="text"
          name="title"
          defaultValue={meeting.title}
          placeholder="Title"
          required
        />
        <ModalDropdown
          label="Type"
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          required
          options={MEETING_TYPES.map((t) => ({
            value: t,
            label: t.replace(/_/g, " "),
          }))}
        />
        <ModalDropdown
          label="Team (optional)"
          name="teamId"
          loading={teamsLoading}
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
          options={[
            { value: "none", label: "General - all members" },
            ...teams.map((t) => ({ value: String(t.id), label: t.name })),
          ]}
        />
        <label className="block text-sm font-medium">Scheduled at</label>
        <Input
          type="datetime-local"
          name="scheduledAt"
          defaultValue={toDatetimeLocalValue(new Date(meeting.scheduledAt))}
          required
        />
        <textarea
          name="description"
          defaultValue={meeting.description ?? ""}
          placeholder="Description (optional)"
          className="min-h-16 w-full min-w-0 resize-y rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
        />
        <Input
          type="text"
          name="location"
          defaultValue={meeting.location ?? ""}
          placeholder="Location (optional)"
        />
        <Input
          type="number"
          name="maxCapacity"
          defaultValue={meeting.maxCapacity ?? ""}
          placeholder="Max capacity (optional)"
          min={0}
        />
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="isRequired"
            defaultChecked={meeting.isRequired}
          />
          Required
        </label>

        {state.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}

        <div className="flex justify-end space-x-2 pt-2">
          <ModalButton variant="cancel" type="button" onClick={onClose}>
            Cancel
          </ModalButton>
          <SubmitButton>Save</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}

export function MeetingsTable({ meetings }: MeetingsTableProps) {
  const router = useRouter();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMeeting, setNewMeeting] = useState<NewMeeting>(emptyMeeting);
  const [teams, setTeams] = useState<{ id: number; name: string }[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [teamsError, setTeamsError] = useState<string | null>(null);
  const detail = useDetailRow<Meeting>();
  const save = useAsyncAction();
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);

  useEffect(() => {
    if (!showAddModal) return;
    if (teams.length > 0) return;
    async function loadTeams() {
      setTeamsLoading(true);
      setTeamsError(null);
      try {
        const res = await fetch(withBasePath("/api/teams"));
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        const data = await res.json();
        setTeams(
          data.map((t: { id: number; name: string }) => ({
            id: t.id,
            name: t.name,
          })),
        );
      } catch {
        // Previously an empty catch, which left the Team dropdown looking merely
        // empty rather than broken.
        setTeamsError("Could not load teams.");
      } finally {
        setTeamsLoading(false);
      }
    }
    loadTeams();
  }, [showAddModal, teams.length]);

  const closeModal = () => {
    setShowAddModal(false);
    setNewMeeting(emptyMeeting);
    save.setError(null);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value, type, checked } = e.target as HTMLInputElement;
    setNewMeeting((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setNewMeeting((prev) => ({ ...prev, type: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    save.run(async () => {
      const res = await fetch(withBasePath("/api/meetings"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newMeeting.title,
          type: newMeeting.type,
          teamId:
            newMeeting.teamId === "none" ? null : Number(newMeeting.teamId),
          scheduledAt: new Date(newMeeting.scheduledAt).toISOString(),
          description: newMeeting.description || null,
          location: newMeeting.location || null,
          isRequired: newMeeting.isRequired,
          maxCapacity: newMeeting.maxCapacity
            ? Number(newMeeting.maxCapacity)
            : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create meeting");
      }

      // Re-fetch the server component data so the new meeting renders. Closing
      // after the refresh, inside the transition, keeps Save spinning until the
      // new row is actually on screen -- it used to close over a stale table.
      router.refresh();
      closeModal();
    });
  };

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Meetings</CardTitle>
          <CardDescription>All meetings and events</CardDescription>
        </div>
        <div data-slot="card-action" className="flex gap-2">
          <CardButton onClick={() => setShowAddModal(true)}>
            + Add Meeting
          </CardButton>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Scheduled</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Attendance</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {meetings.length === 0 ? (
              <TableEmptyState
                colSpan={7}
                message="No meetings scheduled yet."
              />
            ) : (
              meetings.map((meeting) => (
                <TableRow key={meeting.id} {...detail.getRowProps(meeting)}>
                  <TableCell>{meeting.title}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {meeting.type.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>{meeting.team?.name || "N/A"}</TableCell>
                  <TableCell>
                    {new Date(meeting.scheduledAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <MeetingStatusBadge scheduledAt={meeting.scheduledAt} />
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {
                        meeting.attendance.filter((a) => a.status === "PRESENT")
                          .length
                      }{" "}
                      / {meeting.attendance.length}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-3">
                      <Link
                        href={`/meetings/${meeting.id}/attendance`}
                        className="text-sm text-primary underline"
                      >
                        Attendance
                      </Link>
                      <Link
                        href={`/meetings/${meeting.id}/check-in-display`}
                        className="text-sm text-primary underline"
                      >
                        Check-in QR Code
                      </Link>
                      <Link
                        href={`/meetings/${meeting.id}/feedback-display`}
                        className="text-sm text-primary underline"
                      >
                        Feedback QR Code
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingMeeting(meeting)}
                      >
                        Edit
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <MeetingDetailSheet
          meeting={detail.selected}
          onOpenChange={detail.onOpenChange}
          onCloseAutoFocus={detail.onCloseAutoFocus}
        />
        {editingMeeting && (
          <EditMeetingModal
            key={editingMeeting.id}
            meeting={editingMeeting}
            onClose={() => setEditingMeeting(null)}
          />
        )}
        {showAddModal && (
          <Modal onClose={closeModal}>
            <ModalHeader>Add New Meeting</ModalHeader>
            <form onSubmit={handleSubmit} className="flex flex-col space-y-3">
              <Input
                type="text"
                name="title"
                value={newMeeting.title}
                onChange={handleChange}
                placeholder="Title"
                required
              />
              <ModalDropdown
                label="Type"
                value={newMeeting.type}
                onChange={handleTypeChange}
                required
                options={MEETING_TYPES.map((t) => ({
                  value: t,
                  label: t.replace(/_/g, " "),
                }))}
              />
              <ModalDropdown
                label="Team (optional)"
                loading={teamsLoading}
                value={newMeeting.teamId}
                onChange={(e) =>
                  setNewMeeting((prev) => ({ ...prev, teamId: e.target.value }))
                }
                options={[
                  { value: "none", label: "General - all members" },
                  ...teams.map((t) => ({ value: String(t.id), label: t.name })),
                ]}
              />
              {teamsError && (
                <p className="text-sm text-destructive">{teamsError}</p>
              )}
              <label className="block text-sm font-medium">Scheduled at</label>
              <Input
                type="datetime-local"
                name="scheduledAt"
                value={newMeeting.scheduledAt}
                onChange={handleChange}
                required
              />
              <textarea
                name="description"
                value={newMeeting.description}
                onChange={handleChange}
                placeholder="Description (optional)"
                className="min-h-16 w-full min-w-0 resize-y rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
              />
              <Input
                type="text"
                name="location"
                value={newMeeting.location}
                onChange={handleChange}
                placeholder="Location (optional)"
              />
              <Input
                type="number"
                name="maxCapacity"
                value={newMeeting.maxCapacity}
                onChange={handleChange}
                placeholder="Max capacity (optional)"
                min={0}
              />
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="isRequired"
                  checked={newMeeting.isRequired}
                  onChange={handleChange}
                />
                Required
              </label>

              {save.error && (
                <p className="text-sm text-destructive">{save.error}</p>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <ModalButton
                  variant="cancel"
                  type="button"
                  disabled={save.pending}
                  onClick={closeModal}
                >
                  Cancel
                </ModalButton>
                <ModalButton
                  variant="primary"
                  type="submit"
                  pending={save.pending}
                  pendingLabel="Saving..."
                >
                  Save
                </ModalButton>
              </div>
            </form>
          </Modal>
        )}
      </CardContent>
    </Card>
  );
}
