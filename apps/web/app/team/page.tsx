import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import teamData from "@/data/team.json";
import { TeamDirectory } from "./team-directory";
import { RevivalTeamBadge } from "./revival-team-badge";

// A server component: the header and every member card are rendered to HTML
// here, and only TeamDirectory (search and filters) and the Revival Team
// badge tooltip run in the browser.

interface TeamMember {
  name: string;
  role: string;
  image?: string;
  circularImage?: string;
  bio?: string;
  linkedin?: string;
  twitter?: string;
  github?: string;
  website?: string;
  years?: string[];
  previousRoles?: { role: string; year: string }[];
}

// Transform team data for display in the directory page
const formatTeamMembersForDisplay = () => {
  return (teamData.allTeamMembers as TeamMember[]).map((member) => {
    const latestYear =
      member.years?.sort((a, b) => b.localeCompare(a))[0] || "";
    const isFounder = member.years?.includes("2022") || false;

    let board = "";
    if (isFounder) board = "Revival Team";

    return {
      ...member,
      year: latestYear,
      board: board,
    };
  });
};

const allTeamMembers = formatTeamMembersForDisplay();

type DisplayMember = (typeof allTeamMembers)[number];

// Unique years and boards for the filter options
const years = [
  "all",
  ...new Set(
    allTeamMembers
      .flatMap((member) => member.years || [])
      .sort((a, b) => b.localeCompare(a)),
  ),
];
const boards = [
  "all",
  ...new Set(allTeamMembers.map((member) => member.board).filter(Boolean)),
];

function TeamMemberCard({ member }: { member: DisplayMember }) {
  return (
    <Card className="overflow-hidden h-full">
      <div className="flex flex-col h-full">
        <div className="flex p-6 gap-5">
          <Avatar className="h-16 w-16 rounded-full border-2 border-primary/10 shrink-0">
            {member.image ? (
              <AvatarImage
                src={member.circularImage || member.image}
                alt={member.name}
                className="object-cover object-center"
              />
            ) : (
              <AvatarFallback className="text-lg">
                {member.name
                  .split(" ")
                  .reduce(
                    (initials: string, namePart: string) =>
                      initials + (namePart.length > 0 ? namePart[0] : ""),
                    "",
                  )}
              </AvatarFallback>
            )}
          </Avatar>

          <div className="min-w-0">
            <h3 className="font-semibold text-lg leading-tight mb-1">
              {member.name}
            </h3>
            <p className="text-muted-foreground mb-3">{member.role}</p>

            <div className="flex flex-wrap items-center gap-2 mb-2">
              {member.years && (
                <div className="flex flex-wrap gap-1">
                  {[...member.years]
                    .sort((a, b) => b.localeCompare(a))
                    .map((year) => (
                      <span
                        key={year}
                        className="inline-flex items-center rounded-full bg-muted px-2 py-1 text-xs font-medium"
                      >
                        {year}
                      </span>
                    ))}
                </div>
              )}
              {member.board === "Revival Team" && <RevivalTeamBadge />}
            </div>

            {member.previousRoles && member.previousRoles.length > 0 && (
              <div className="mt-1 text-xs text-muted-foreground mb-2">
                <span className="font-medium">Previous roles:</span>{" "}
                {member.previousRoles
                  .map(
                    (roleObj: { role: string; year: string }) =>
                      `${roleObj.role} (${roleObj.year})`,
                  )
                  .join(", ")}
              </div>
            )}
          </div>
        </div>

        <CardContent className="pt-0 pb-6 px-6">
          {member.bio && (
            <p className="text-sm text-muted-foreground mb-4">{member.bio}</p>
          )}

          <div className="flex mt-auto gap-3">
            {member.linkedin && (
              <a
                href={member.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                <svg
                  className="h-5 w-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                </svg>
              </a>
            )}
            {member.twitter && (
              <a
                href={member.twitter}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                <svg
                  className="h-5 w-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                </svg>
              </a>
            )}
            {member.github && (
              <a
                href={member.github}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                <svg
                  className="h-5 w-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
              </a>
            )}
          </div>
        </CardContent>
      </div>
    </Card>
  );
}

export default function TeamPage() {
  return (
    <div className="py-16 md:py-24">
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12">
          <Link
            href="/#team"
            className="inline-flex items-center text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to homepage
          </Link>

          <h1 className="text-4xl font-bold mb-4">Team Directory</h1>
          <p className="text-xl text-muted-foreground max-w-3xl">
            Meet all the talented individuals who contribute to FirstByte&apos;s
            mission of bringing coding education to young learners everywhere.
          </p>
        </div>

        <TeamDirectory
          members={allTeamMembers.map(({ name, role, bio, years, board }) => ({
            name,
            role,
            bio,
            years,
            board,
          }))}
          years={years}
          boards={boards}
          cards={Object.fromEntries(
            allTeamMembers.map((member) => [
              member.name,
              <TeamMemberCard key={member.name} member={member} />,
            ]),
          )}
        />
      </div>
    </div>
  );
}
