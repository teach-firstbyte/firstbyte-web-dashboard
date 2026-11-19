import { BackLink } from "@/components/BackLink";
import { EmptyState, PageHeader, Section } from "@/components/common/Section";
import { AppShell } from "@/components/layout/AppShell";
import { MeetingActionItems } from "@/components/tasks/MeetingActionItems";
import { requireTaskAccess } from "@/lib/auth/requireTaskAccess";
import { getViewMode } from "@/lib/auth/viewMode";
import { formatShortDate, formatTime } from "@/lib/format";
import { hasActionItems } from "@/lib/meetings";
import { findMeetingHeader } from "@/server/meetings/queries";
import { listTaskOwnerOptions, listTasks } from "@/server/tasks/queries";
import { parseId } from "@/server/validation";

/**
 * An e-board meeting's Action items: the page the president keeps on the
 * shared screen during the meeting, adding each item as it comes up.
 *
 * A page of its own rather than a part of the meeting's detail panel: the
 * panel is narrow, closes on Escape or a stray click (Escape is also how the
 * owner list closes), and has no address to reopen. A page has room for the
 * three fields at screensharing size, and a reload brings back the list.
 *
 * E-board members and super admins only. Anyone else goes to Home.
 */
export default async function MeetingActionItemsPage({
  params,
}: {
  params: Promise<{ meetingId: string }>;
}) {
  const { user } = await requireTaskAccess();
  const mode = await getViewMode(user);
  const { meetingId } = await params;

  const back = <BackLink href="/meetings" label="Meetings" />;
  const notHere = (title: string, body: string) => (
    <AppShell viewer={user} mode={mode}>
      <PageHeader back={back} title="Action items" />
      <Section title="Action items">
        <EmptyState title={title}>{body}</EmptyState>
      </Section>
    </AppShell>
  );

  const id = parseId(meetingId);
  const meeting = id === null ? null : await findMeetingHeader(id);
  if (meeting === null) {
    return notHere(
      "Meeting not found",
      "It may have been deleted. Tasks can still be added from the Tasks board.",
    );
  }
  if (!hasActionItems(meeting.type)) {
    return notHere(
      "Only e-board meetings have action items",
      `“${meeting.title}” isn't an e-board meeting.`,
    );
  }

  const [owners, tasks] = await Promise.all([
    listTaskOwnerOptions(user),
    listTasks(user, { meetingId: meeting.id, includeDone: true }),
  ]);

  const description = [
    `${formatShortDate(meeting.scheduledAt)} at ${formatTime(meeting.scheduledAt)}`,
    meeting.location,
    "Agenda and notes stay in the Google Doc",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <AppShell viewer={user} mode={mode}>
      <MeetingActionItems
        meeting={{ id: meeting.id, title: meeting.title }}
        description={description}
        back={back}
        owners={owners}
        // In the order they were added, the way the room said them.
        initialItems={tasks
          .sort((a, b) => a.id - b.id)
          .map((t) => ({
            id: t.id,
            title: t.title,
            dueDate: t.dueDate,
            owner: t.owner,
            can: { delete: t.can.delete },
          }))}
      />
    </AppShell>
  );
}
