import type { RawMessage } from "./safeguards";
import { teamKey } from "./sources";

/**
 * Made-up Slack messages for the prototype, until the real Slack app is
 * connected. Every name, number and link here is invented.
 *
 * Each team's set includes traps on purpose, so the safeguards can be seen
 * working on the preview:
 *   - a private channel and a DM            -> never collected
 *   - a phone number, an email, a Docs link -> removed before the AI sees it
 *   - someone outside the club by name      -> becomes "someone"
 *   - a message about one person's GPA      -> left out entirely
 *   - plans that are only talk              -> the line is flagged for the lead
 */
const SAMPLE: Record<string, Omit<RawMessage, "id">[]> = {
  WEBSITE: [
    {
      channel: "#website",
      channelType: "public",
      author: "Website lead",
      text: "The new loading screen is live and it feels way faster on the library wifi.",
    },
    {
      channel: "#website",
      channelType: "public",
      author: "Website member",
      text: "If the deploy breaks tonight text me at 617-555-0142 and I'll hop on.",
    },
    {
      channel: "#website",
      channelType: "public",
      author: "Website lead",
      text: "<@Pat Rivera> from the university IT office says our domain renewal is due next month.",
    },
    {
      channel: "#website",
      channelType: "public",
      author: "Website member",
      text: "Starting to sketch a members-only events page, maybe for next semester.",
    },
    {
      channel: "#officers-private",
      channelType: "private",
      author: "Officer",
      text: "Thinking about cutting the website budget. Don't share yet.",
    },
    {
      channel: "DM",
      channelType: "dm",
      author: "Website member",
      text: "Honestly I'm burned out this week, can you cover my PR reviews?",
    },
  ],
  CSCURRICULA: [
    {
      channel: "#cs-curricula",
      channelType: "public",
      author: "CS Curricula lead",
      text: "Lesson 3 of the intro Python unit is finished and tested with two volunteers.",
    },
    {
      channel: "#cs-curricula",
      channelType: "public",
      author: "CS Curricula member",
      text: "Lesson 4 slides draft: https://docs.google.com/document/d/1AbCdEf/edit",
    },
    {
      channel: "#cs-curricula",
      channelType: "public",
      author: "CS Curricula member",
      text: "Heads up, Sam's GPA dropped so they're stepping back from teaching for a bit.",
    },
    {
      channel: "#cs-curricula",
      channelType: "public",
      author: "CS Curricula lead",
      text: "If anyone needs the answer key email me at cs.lead.sample@gmail.com",
    },
  ],
  STEMCURRICULA: [
    {
      channel: "#stem-curricula",
      channelType: "public",
      author: "STEM Curricula lead",
      text: "Ran the circuits activity with a pilot group of 8 fifth graders. The LED part was the favorite.",
    },
    {
      channel: "#stem-curricula",
      channelType: "public",
      author: "STEM Curricula member",
      text: "We need about 10 more breadboards before the next session.",
    },
    {
      channel: "DM",
      channelType: "dm",
      author: "STEM Curricula member",
      text: "Can't make Thursday, family stuff.",
    },
  ],
  EVENTS: [
    {
      channel: "#events",
      channelType: "public",
      author: "Events lead",
      text: "Room is booked for FirstBites on Friday. Pizza order is placed.",
    },
    {
      channel: "#events",
      channelType: "public",
      author: "Events member",
      text: "Talking with another club about a joint workshop in November, nothing confirmed.",
    },
    {
      channel: "#eboard-private",
      channelType: "private",
      author: "Officer",
      text: "Budget for spring events is tight, keep this between us.",
    },
  ],
  BRANDANDMARKETING: [
    {
      channel: "#brand-marketing",
      channelType: "public",
      author: "Brand and Marketing lead",
      text: "Posted the recap photos from the last general meeting on Instagram.",
    },
    {
      channel: "#brand-marketing",
      channelType: "public",
      author: "Brand and Marketing member",
      text: "Working on new sticker designs, would love feedback at the next meeting.",
    },
  ],
};

/** This week's sample messages for a team, with stable ids. */
export function sampleMessagesForTeam(teamName: string): RawMessage[] {
  const key = teamKey(teamName);
  return (SAMPLE[key] ?? []).map((m, i) => ({
    ...m,
    id: `slack-${key.toLowerCase()}-${i + 1}`,
  }));
}
