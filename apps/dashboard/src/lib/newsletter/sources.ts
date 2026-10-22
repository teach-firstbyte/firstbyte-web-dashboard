/**
 * What the draft job may read for each team. This list is the whole of the AI's
 * access: the "What the AI can see" page renders it as-is.
 *
 * Prototype: everything is sample data. GitHub is sample pull requests from
 * lib/newsletter/sampleGitHub.ts and Slack is sample messages from
 * lib/newsletter/sampleSlack.ts. When the real GitHub and Slack apps are
 * connected, these lists move to the database so leads can switch them on and
 * off; the shape stays the same.
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
  CSCURRICULA: {
    github: ["teach-firstbyte/cs-curriculum"],
    slack: ["#cs-curricula"],
  },
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

/** GitHub and Slack are sample data in the prototype. The pages say so. */
export const SOURCES_ARE_SAMPLE = true;
