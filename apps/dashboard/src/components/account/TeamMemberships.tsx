"use client";

import * as React from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";

import { requestTeamAction, withdrawTeamAction } from "@/app/settings/actions";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { PersonAvatar } from "@/components/common/PersonAvatar";
import { EmptyState, RowList } from "@/components/common/Section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAsyncAction } from "@/hooks/useAsyncAction";

export type TeamRow = {
  teamId: number;
  name: string;
  description: string | null;
  inviteOnly: boolean;
  /** This person's membership, if any. */
  membership: {
    id: number;
    status: "PENDING" | "APPROVED" | "REJECTED";
  } | null;
};

/**
 * Your teams, on Settings: what you're on, what you've asked for, and what
 * you could ask to join. Each row says what you can do with it.
 */
export function TeamMemberships({ teams }: { teams: TeamRow[] }) {
  const action = useAsyncAction();
  const [leaving, setLeaving] = React.useState<TeamRow | null>(null);

  const call = (
    key: number,
    fn: () => Promise<{ error?: string }>,
    done: string,
  ) =>
    action.run(async () => {
      const result = await fn();
      if (result.error) throw new Error(result.error);
      setLeaving(null);
      toast(done);
    }, key);

  if (teams.length === 0) {
    return (
      <EmptyState title="No teams yet">
        Ask an officer which teams are open.
      </EmptyState>
    );
  }

  return (
    <>
      <RowList>
        {teams.map((t) => {
          const status = t.membership?.status;
          return (
            <li key={t.teamId} className="flex items-center gap-3 py-3">
              <PersonAvatar
                name={t.name}
                tone={status === "APPROVED" ? "brand" : "muted"}
              />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate font-semibold">
                  {t.name}
                  {status === "PENDING" && (
                    <Badge variant="warning">Request sent</Badge>
                  )}
                  {status === "REJECTED" && (
                    <Badge variant="muted">Not approved</Badge>
                  )}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {status === "APPROVED"
                    ? "You're on this team"
                    : (t.description ??
                      (t.inviteOnly ? "Invite only" : "Open to join"))}
                </p>
              </div>
              {t.inviteOnly ? (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Lock className="size-3" aria-hidden="true" />
                  Invite only
                </span>
              ) : status === "APPROVED" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground"
                  onClick={() => setLeaving(t)}
                >
                  Leave
                </Button>
              ) : status === "PENDING" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  pending={action.isPendingKey(t.teamId)}
                  onClick={() =>
                    call(
                      t.teamId,
                      () => withdrawTeamAction(t.membership!.id),
                      `Canceled your request for ${t.name}`,
                    )
                  }
                >
                  Cancel request
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  pending={action.isPendingKey(t.teamId)}
                  onClick={() =>
                    call(
                      t.teamId,
                      () => requestTeamAction(t.teamId),
                      `Asked to join ${t.name}. An officer will review it.`,
                    )
                  }
                >
                  {status === "REJECTED" ? "Ask again" : "Ask to join"}
                </Button>
              )}
            </li>
          );
        })}
      </RowList>
      {action.error && !leaving && (
        <p className="text-sm text-destructive">{action.error}</p>
      )}
      <ConfirmDialog
        open={leaving !== null}
        onOpenChange={(o) => !o && setLeaving(null)}
        title={`Leave ${leaving?.name ?? ""}?`}
        message="You'll stop seeing this team's meetings. You can ask to join again later."
        confirmLabel="Leave team"
        destructive
        pending={action.pending}
        error={action.error}
        onConfirm={() =>
          leaving &&
          call(
            leaving.teamId,
            () => withdrawTeamAction(leaving.membership!.id),
            `You left ${leaving.name}`,
          )
        }
      />
    </>
  );
}
