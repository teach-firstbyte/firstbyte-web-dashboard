import { TriangleAlertIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";

// SLACK PLACEHOLDERS. The two warnings the spec asks for, with nothing to feed
// them yet. Both take `undefined` to mean "not known", and render nothing for
// it, which is what every caller passes today.
//
// - NotConnectedToSlack: needs each e-board member's Slack link, which comes
//   with the Slack setup list in a later part of #137. Pass `linked` from it.
// - ReminderNotDelivered: needs per-task delivery state, which comes with the
//   reminder sender in #138. Pass `undelivered` from it.
//
// No schema for either is added here on purpose.

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
      title="Hector hasn't linked their Slack account yet"
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
