"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ClipboardCheck,
  Copy,
  MoreHorizontal,
  Pencil,
  QrCode,
  Star,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { meetingPhase } from "@/lib/meetings";
import { withBasePath } from "@/lib/paths";
import {
  MeetingFormDialog,
  type MeetingFormMode,
  type MeetingFormSource,
} from "./MeetingFormDialog";

/**
 * The ⋯ menu on a meeting. Everything an officer can do to one meeting lives
 * here, so each list row stays a title and one number instead of the old row
 * of five buttons. What's offered depends on where the meeting is in its life.
 */
export function MeetingActionsMenu({
  meeting,
  locations,
}: {
  meeting: MeetingFormSource;
  locations: string[];
}) {
  const router = useRouter();
  const [form, setForm] = React.useState<MeetingFormMode | null>(null);
  const [confirming, setConfirming] = React.useState(false);
  const remove = useAsyncAction();
  const phase = meetingPhase(meeting.scheduledAt);

  const confirmDelete = () =>
    remove.run(async () => {
      const res = await fetch(withBasePath(`/api/meetings/${meeting.id}`), {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "That meeting could not be deleted.");
      }
      router.refresh();
      setConfirming(false);
      toast(`Deleted “${meeting.title}”`);
    });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Actions for ${meeting.title}`}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuGroup>
            {phase !== "past" && (
              <DropdownMenuItem asChild>
                <Link href={`/meetings/${meeting.id}/check-in-display`}>
                  <QrCode /> Show check-in QR
                </Link>
              </DropdownMenuItem>
            )}
            {phase !== "upcoming" && (
              <DropdownMenuItem asChild>
                <Link href={`/meetings/${meeting.id}/feedback-display`}>
                  <Star /> Show feedback QR
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <Link href={`/meetings/${meeting.id}/attendance`}>
                <ClipboardCheck />
                {phase === "past" ? "View attendance" : "Take attendance"}
              </Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={() => setForm("edit")}>
              <Pencil /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setForm("duplicate")}>
              <Copy /> Duplicate
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => setConfirming(true)}
            >
              <Trash2 /> Delete…
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {form && (
        <MeetingFormDialog
          key={`${form}-${meeting.id}`}
          mode={form}
          meeting={meeting}
          locations={locations}
          open
          onOpenChange={(open) => !open && setForm(null)}
        />
      )}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Delete this meeting?"
        message={`“${meeting.title}” and all of its attendance and feedback records will be removed. This can't be undone.`}
        confirmLabel="Delete meeting"
        destructive
        pending={remove.pending}
        error={remove.error}
        onConfirm={confirmDelete}
      />
    </>
  );
}

/** "+ New meeting", with the form behind it. */
export function NewMeetingButton({
  template,
  locations,
  className,
}: {
  template?: MeetingFormSource | null;
  locations: string[];
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  // Bumped per open, so each new meeting starts from a clean form.
  const [session, setSession] = React.useState(0);

  return (
    <>
      <Button
        className={className}
        onClick={() => {
          setSession((s) => s + 1);
          setOpen(true);
        }}
      >
        + New meeting
      </Button>
      {open && (
        <MeetingFormDialog
          key={session}
          mode="new"
          template={template}
          locations={locations}
          open
          onOpenChange={setOpen}
        />
      )}
    </>
  );
}
