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
import React, { useEffect, useState } from "react";
import {
  ConfirmDialog,
  Modal,
  ModalHeader,
  ModalButton,
  ModalDropdown,
} from "@/components/ui/modal";
import { Meeting } from "@/types/dashboard";
import { withBasePath } from "@/lib/paths";
import { TableEmptyState } from "./ui/TableEmptyState";
import { MeetingStatusBadge } from "./MeetingStatusBadge";
import { useDetailRow } from "@/hooks/useDetailRow";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { MeetingDetailSheet } from "./MeetingDetailSheet";
import { deleteMeetingAction } from "@/app/actions/meetings";

interface MeetingsTableProps {
  meetings: Meeting[];
}

interface DeleteMeetingButtonProps {
  meeting: Meeting;
}

function DeleteMeetingButton({ meeting }: DeleteMeetingButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const deleteAction = useAsyncAction();

  const handleConfirm = () => {
    deleteAction.run(async () => {
      const result = await deleteMeetingAction(meeting.id);
      if (result.error) throw new Error(result.error);
      setConfirming(false);
    });
  };

  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => setConfirming(true)}
      >
        Delete
      </Button>
      {confirming && (
        <ConfirmDialog
          title="Delete meeting?"
          message={`Delete "${meeting.title}"? This also removes its attendance and feedback records.`}
          confirmLabel="Delete"
          pending={deleteAction.pending}
          error={deleteAction.error}
          onConfirm={handleConfirm}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
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

export function MeetingsTable({ meetings }: MeetingsTableProps) {
  const router = useRouter();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMeeting, setNewMeeting] = useState<NewMeeting>(emptyMeeting);
  const [teams, setTeams] = useState<{ id: number; name: string }[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [teamsError, setTeamsError] = useState<string | null>(null);
  const detail = useDetailRow<Meeting>();
  const save = useAsyncAction();

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
                      <DeleteMeetingButton meeting={meeting} />
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
