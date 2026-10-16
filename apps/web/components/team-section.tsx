import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedGlowButton } from "@/components/ui/animated-glow-button";
import { Reveal } from "@/components/ui/reveal";
import {
  allTeamMembers,
  getRoleForYear,
  getTeamPhotoForYear,
  type PastBoard,
  type TeamMember,
} from "@/components/team/team-data";
import { CardStack } from "@/components/team/card-stack";
import { TeamMemberCard } from "@/components/team/team-member-card";

interface TeamSectionProps {
  className?: string;
}

const currentEboardNames = [
  "Nicholas Chen",
  "Gina Hong",
  "Shreyashi Kalakuntla",
  "Inesh Parikh",
  "Amy Tran",
  "Jason Chao",
  "Ananya Pochinapeddi",
  "Himasri Cheerla",
  "Chayil Mauristhene",
  "Koena Gupta",
  "Hector Batista",
  "Meera Patel",
];

const currentExecutiveBoard = currentEboardNames
  .map((name) => allTeamMembers.find((member) => member.name === name))
  .filter(Boolean) as TeamMember[];

// Define specific order for founding team
const revivalTeamOrder = [
  "Andy Ge",
  "Win Tongtawee",
  "Caleb Lee",
  "Landyn Sparacino",
  "Jennifer Esfahany",
  "Srikar Ananthoju",
];
const eboTwentyFour = [
  "Landyn Sparacino",
  "Caleb Lee",
  "Jaden Zhou",
  "Inesh Parikh",
  "Shreyashi Kalakuntla",
  "Anna Higgins",
  "Ireh Hong",
  "Andy Ge",
  "Jennifer Esfahany",
  "Win Tongtawee",
];
const eboTwentyFive = [
  "Nicholas Chen",
  "Alex Wright",
  "Jaden Zhou",
  "Amoli Patel",
  "Gavin Normand",
  "Shreyashi Kalakuntla",
  "Inesh Parikh",
  "Ameeka Patel",
  "Alastaire Balin",
  "Gina Hong",
  "Shreesh Dassarkar",
];

// Helper function to create a past board from an ordered array of names
const createPastBoardFromNames = (
  year: string,
  title: string,
  orderedNames: string[],
): PastBoard => {
  const members = orderedNames
    .map((name) => allTeamMembers.find((member) => member.name === name))
    .filter(Boolean)
    .map((member) => ({
      ...member!,
      role: getRoleForYear(member!, year),
      currentRole: member!.role,
    })) as TeamMember[];

  return {
    year: `${year}-${Number(year) + 1}`, // Format as academic year
    title: title,
    members: members,
    teamPhoto: getTeamPhotoForYear(year),
  };
};

// Create past board entries directly from ordered arrays
const pastBoards: PastBoard[] = [
  createPastBoardFromNames("2022", "Revival Team", revivalTeamOrder),
  createPastBoardFromNames("2024", "2024 Leadership", eboTwentyFour),
  createPastBoardFromNames("2025", "2025 Leadership", eboTwentyFive),
  // Add more past boards as needed
];

// A server component: the team data is read here and passed to the client
// cards as props, so team.json does not ship to the browser.
export function TeamSection({ className }: TeamSectionProps) {
  // const currentVisible = currentExecutiveBoard.slice(0, visibleCount)

  return (
    <section
      id="team"
      className={cn(
        "bg-[hsl(var(--gray-50))] text-foreground pt-32 pb-10 overflow-hidden bg-dots-light",
        className,
      )}
    >
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-4 md:gap-8 mb-12">
          <Reveal duration={0.6}>
            <h2 className="text-3xl font-semibold leading-tight sm:text-5xl sm:leading-tight">
              Our Team
            </h2>
          </Reveal>
          <Reveal duration={0.6} delay={0.2}>
            <p className="text-md font-medium text-muted-foreground sm:text-xl">
              Meet the talented individuals behind FirstByte who make our
              mission of coding education possible.
            </p>
          </Reveal>
        </div>

        {/* Current Executive Board */}
        <div className="mb-20">
          <Reveal
            duration={0.5}
            className="flex justify-between items-end mb-8"
          >
            <h3 className="text-2xl font-semibold">Current Executive Board</h3>
            <div className="text-sm text-muted-foreground">2026-2027</div>
          </Reveal>

          <div className="flex overflow-x-auto snap-x snap-mandatory -mx-4 px-4 sm:grid sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 sm:auto-rows-fr sm:overflow-visible sm:mx-0 sm:px-0 gap-6 md:gap-8">
            {currentExecutiveBoard.map((member, index) => (
              <div
                key={member.name}
                className="snap-center shrink-0 w-[80%] sm:w-auto sm:shrink sm:h-full"
              >
                <TeamMemberCard
                  member={member}
                  index={index}
                  noStaggerDelay={false}
                />
              </div>
            ))}
          </div>

          {/* {currentExecutiveBoard.length > visibleCount ? (
            <div className="flex justify-center mt-8">
              <AnimatedGlowButton
                color="green"
                onClick={handleShowMore}
                className="flex items-center gap-2 text-sm font-medium"
              >
                <span>Show All</span>
                <ChevronDown className="h-4 w-4" />
              </AnimatedGlowButton>
            </div>
          )
          : currentExecutiveBoard.length > 8 && visibleCount > 8 ? (
            <div className="flex justify-center mt-8">
              <AnimatedGlowButton
                color="green"
                onClick={handleShowLess}
                className="flex items-center gap-2 text-sm font-medium"
              >
                <span>Show Less</span>
                <ChevronDown className="h-4 w-4 rotate-180" />
              </AnimatedGlowButton>
            </div>
          )
          :
           null} */}
        </div>

        {/* Past Boards */}
        <div>
          <Reveal duration={0.5} className="flex items-center mb-8">
            <div className="h-px grow bg-border"></div>
            <h3 className="text-xl font-semibold px-4">Previous Leadership</h3>
            <div className="h-px grow bg-border"></div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {pastBoards.map((board, index) => (
              <CardStack key={board.year} board={board} index={index} />
            ))}
          </div>
        </div>

        {/* Call to action */}
        <Reveal duration={0.6} className="flex justify-center mt-20">
          <Link href="/team">
            <AnimatedGlowButton
              color="green"
              className="flex items-center gap-2 text-sm font-medium"
            >
              See Full Team Directory
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </AnimatedGlowButton>
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
