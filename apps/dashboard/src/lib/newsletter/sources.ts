/**
 * What the draft job may read for each team. This list is the whole of the AI's
 * access: the "What the AI can see" page renders it as-is.
 *
 * Prototype: GitHub is real (this repo is public, so it is read without a key),
 * Slack is sample messages from lib/newsletter/sampleSlack.ts. When the real
 * Slack app is connected, the channels move to the database so leads can switch
 * them on and off; the shape stays the same.
 *
 * Keyed by team name with case and punctuation ignored, the same loose match
 * the team_join_policy migration uses for the e-board.
 */
export type TeamSources = {
  /** "owner/repo". Merged pull requests from the past 7 days. */
  github: string[];
  /** Slack channel names, including the "#". */
  slack: string[];
};

const BY_TEAM: Record<string, TeamSources> = {
  WEBSITE: {
    github: ["teach-firstbyte/firstbyte-web-dashboard"],
    slack: ["#website"],
  },
  CSCURRICULA: { github: [], slack: ["#cs-curricula"] },
  STEMCURRICULA: { github: [], slack: ["#stem-curricula"] },
  EVENTS: { github: [], slack: ["#events"] },
  BRANDANDMARKETING: { github: [], slack: ["#brand-marketing"] },
};

const NONE: TeamSources = { github: [], slack: [] };

export function teamKey(name: string): string {
  return name.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export function sourcesForTeam(name: string): TeamSources {
  return BY_TEAM[teamKey(name)] ?? NONE;
}

/** Slack is sample data in the prototype. The page says so. */
export const SLACK_IS_SAMPLE = true;
