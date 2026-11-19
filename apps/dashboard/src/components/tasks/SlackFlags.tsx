import { TriangleAlertIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";

// The two Slack warnings the spec asks for. Both take `undefined` to mean "not
// known", and render nothing for it.
//
// - NotConnectedToSlack: fed by each owner's `slackConnected`, which is false
//   until a super admin links them on /tasks/slack.
// - ReminderNotDelivered: fed by each task's `reminderUndelivered`, true when
//   its latest Slack reminder was given up on (server/tasks/reminders.ts).

/** Next to a person on the board: they won't get reminders. */
export function NotConnectedToSlack({
  linked,
}: {
  linked: boolean | undefined;
}) {
  if (linked !== false) return null;
  return (
    <Badge
      variant="warning"
      title="A super admin hasn't linked their Slack account on Slack setup yet"
    >
      <TriangleAlertIcon aria-hidden="true" />
      Not connected to Slack: won&apos;t get reminders
    </Badge>
  );
}

/** On a task whose last reminder failed after a day of retries. */
export function ReminderNotDelivered({
  undelivered,
}: {
  undelivered: boolean | undefined;
}) {
  if (!undelivered) return null;
  return (
    <Badge
      variant="warning"
      title="Slack didn't accept the reminder after a day of retries"
    >
      <TriangleAlertIcon aria-hidden="true" />
      Reminder not delivered
    </Badge>
  );
}
