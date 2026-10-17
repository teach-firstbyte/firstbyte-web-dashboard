import "server-only";

import type { CollectedItem } from "./safeguards";

type PullRequest = {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  merged_at: string | null;
};

/** The first paragraph of a PR description, short. Enough for a summary. */
function firstParagraph(body: string | null): string {
  if (!body) return "";
  const para =
    body
      .split(/\n\s*\n/)[0]
      ?.replace(/\s+/g, " ")
      .trim() ?? "";
  return para.length > 280 ? `${para.slice(0, 277)}...` : para;
}

/**
 * Pull requests merged into a repo since `since`. Read-only, and through the
 * public API, so a public repo needs no key. GITHUB_TOKEN, if set, only raises
 * GitHub's rate limit; it is never needed for the prototype.
 *
 * Returns null when GitHub can't be reached or refuses, so the caller can say
 * so on the draft instead of failing the whole team.
 */
export async function mergedPullRequests(
  repo: string,
  since: Date,
): Promise<CollectedItem[] | null> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "firstbyte-dashboard-newsletter",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const res = await fetch(
    `https://api.github.com/repos/${repo}/pulls?state=closed&sort=updated&direction=desc&per_page=50`,
    { headers, cache: "no-store" },
  ).catch(() => null);
  if (!res?.ok) return null;

  const pulls = (await res.json()) as PullRequest[];
  return pulls
    .filter((p) => p.merged_at && new Date(p.merged_at) >= since)
    .map((p) => {
      const summary = firstParagraph(p.body);
      return {
        id: `gh-${p.number}`,
        kind: "github" as const,
        label: `PR #${p.number}`,
        url: p.html_url,
        text: summary ? `${p.title}. ${summary}` : p.title,
        finished: true,
      };
    });
}
