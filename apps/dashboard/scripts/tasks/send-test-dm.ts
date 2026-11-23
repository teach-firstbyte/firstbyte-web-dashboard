// Sends one test DM from the FirstByte Tasks bot, to check the token and the
// app install. Run from apps/dashboard:
//
//   npm run slack:tasks:test-dm -- U0CK0SKF78E
//
// It reads TASKS_SLACK_BOT_TOKEN from .env.local (or the shell). It DMs only
// the member ID you pass, and only once.
import { normalizeSlackMemberId } from "../../src/lib/tasks/slack-member-id.ts";
import { taskDueTodayMessage } from "../../src/lib/tasks/slack-messages.ts";
import { sendSlackDm } from "../../src/lib/tasks/slack.ts";

const raw = process.argv[2] ?? "";
const memberId = normalizeSlackMemberId(raw);
if (!memberId) {
  console.error(
    `Usage: npm run slack:tasks:test-dm -- <Slack member ID>\n` +
      `"${raw}" isn't a member ID. They look like U07ABC1234.`,
  );
  process.exit(1);
}
if (!process.env.TASKS_SLACK_BOT_TOKEN) {
  console.error(
    "TASKS_SLACK_BOT_TOKEN isn't set. Put the FirstByte Tasks bot token (xoxb-...) in apps/dashboard/.env.local.",
  );
  process.exit(1);
}

const message = taskDueTodayMessage({
  title: "Test reminder from FirstByte Tasks (you can ignore this)",
  statusLabel: "To do",
  url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard`,
});

const result = await sendSlackDm(memberId, message);
if (result.ok) {
  console.log(`Sent. DM channel ${result.channel}, message ${result.ts}.`);
} else {
  console.error(
    `Not sent: ${result.error}${result.retryable ? " (worth retrying)" : ""}`,
  );
  process.exit(1);
}
