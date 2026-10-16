"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";

import { PersonAvatar } from "@/components/common/PersonAvatar";
import { EmptyState, RowList } from "@/components/common/Section";
import { Button } from "@/components/ui/button";

export type MissingMember = {
  id: number;
  name: string | null;
  email: string;
  teams: string[];
  missed: number;
  outOf: number;
};

/**
 * Members who missed recent required meetings, so an officer can reach out
 * before they drop off. Comes from listMembersMissingMeetings, which only
 * counts absences someone actually recorded.
 */
export function MissedMeetingsList({ members }: { members: MissingMember[] }) {
  if (members.length === 0) {
    return (
      <EmptyState title="Everyone's showing up">
        No one was marked absent at 2 of the last 3 required meetings.
      </EmptyState>
    );
  }

  const copy = async (email: string, name: string) => {
    try {
      await navigator.clipboard.writeText(email);
      toast(`Copied ${name}'s email`);
    } catch {
      toast.error("Couldn't copy. Select the email to copy it.");
    }
  };

  return (
    <RowList>
      {members.map((m) => {
        const name = m.name || m.email;
        return (
          <li key={m.id} className="flex items-center gap-3 py-2.5">
            <PersonAvatar name={m.name} email={m.email} tone="danger" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{name}</p>
              <p className="truncate text-sm text-muted-foreground">
                Missed {m.missed} of {m.outOf}
                {m.teams.length > 0 && ` · ${m.teams.join(", ")}`}
              </p>
              <p className="truncate text-xs text-muted-foreground select-all">
                {m.email}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => copy(m.email, name)}
            >
              <Copy data-icon="inline-start" />
              Copy email
            </Button>
          </li>
        );
      })}
    </RowList>
  );
}
