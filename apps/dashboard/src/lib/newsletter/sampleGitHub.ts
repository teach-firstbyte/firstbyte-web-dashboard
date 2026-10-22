import type { CollectedItem } from "./safeguards";
import { teamKey } from "./sources";

/**
 * Made-up merged pull requests for the prototype, so the whole draft is built
 * from sample data until the real GitHub connection is switched on. Every
 * title, number and address here is invented.
 *
 * One description includes an email address on purpose, to show it being
 * removed before the AI sees it.
 */
const SAMPLE: Record<
  string,
  { number: number; title: string; body: string }[]
> = {
  WEBSITE: [
    {
      number: 201,
      title: "Show the loading screen as soon as someone clicks Get Involved",
      body: "The dashboard felt slow on library wifi. The terminal intro now starts right away and fades into the dashboard.",
    },
    {
      number: 202,
      title: "Let members see their own attendance history",
      body: "Adds a My attendance page with every meeting and whether they came. Reported by jordan.sample@gmail.com.",
    },
    {
      number: 203,
      title: "Fix the check-in code on small phones",
      body: "The code box ran off the screen on narrow phones.",
    },
  ],
  CSCURRICULA: [
    {
      number: 41,
      title: "Add lesson 3 of the intro Python unit: loops",
      body: "Slides, a worksheet and two practice problems for loops.",
    },
    {
      number: 42,
      title: "Fix typos in the lesson 2 worksheet",
      body: "",
    },
  ],
};

/**
 * This week's sample pull requests for a team, as collected items. No url:
 * there is no real pull request to open.
 */
export function samplePullRequestsForTeam(teamName: string): CollectedItem[] {
  return (SAMPLE[teamKey(teamName)] ?? []).map((pr) => ({
    id: `gh-${pr.number}`,
    kind: "github",
    label: `PR #${pr.number} (sample)`,
    text: pr.body ? `${pr.title}. ${pr.body}` : pr.title,
    finished: true,
  }));
}
