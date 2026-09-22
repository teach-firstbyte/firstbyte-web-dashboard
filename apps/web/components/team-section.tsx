"use client";

import React, { useState, forwardRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowRight, Linkedin, Twitter, Github, X, Globe } from "lucide-react";
import { AnimatedGlowButton } from "@/components/ui/animated-glow-button";
import { BlurTooltip, TooltipPosition } from "@/components/ui/blur-tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Image from "next/image";
import {
  allTeamMembers,
  getRoleForYear,
  useIsMobile,
  type PastBoard,
  type TeamMember,
} from "@/components/team/shared";
import { CardStack } from "@/components/team/card-stack";

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
    })) as TeamMember[];

  return {
    year: `${year}-${Number(year) + 1}`, // Format as academic year
    title: title,
    members: members,
  };
};

// Create past board entries directly from ordered arrays
const pastBoards: PastBoard[] = [
  createPastBoardFromNames("2022", "Revival Team", revivalTeamOrder),
  createPastBoardFromNames("2024", "2024 Leadership", eboTwentyFour),
  createPastBoardFromNames("2025", "2025 Leadership", eboTwentyFive),
  // Add more past boards as needed
];

interface TeamMemberCardProps {
  member: TeamMember;
  index: number;
  noStaggerDelay?: boolean;
}

function TeamMemberCard({
  member,
  index,
  noStaggerDelay = false,
}: TeamMemberCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [memberTooltipPosition, setMemberTooltipPosition] =
    useState<TooltipPosition | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hoveredSocialUrl, setHoveredSocialUrl] = useState<string | null>(null);
  const isMobile = useIsMobile();

  // Handle mouse movement for tooltip - only on desktop
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isHovered && !isMobile) {
      setMemberTooltipPosition({
        x: e.clientX,
        y: e.clientY + 15, // Position below cursor
      });
    }
  };

  // Show tooltip on hover - only on desktop
  const handleMouseEnter = () => {
    if (!isMobile) {
      setIsHovered(true);
      setTooltipVisible(true);
    }
  };

  // Handle mouse enter with position update - only on desktop
  const handleDivMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isMobile) {
      handleMouseEnter();
      setMemberTooltipPosition({
        x: e.clientX,
        y: e.clientY + 15,
      });
    }
  };

  // Hide tooltip when not hovering
  const handleMouseLeave = () => {
    setIsHovered(false);
    setTooltipVisible(false);
    setHoveredSocialUrl(null);
  };

  // Handle social icon hover - only on desktop
  const handleSocialHover = (
    type: "linkedin" | "github" | "twitter" | "website",
    url: string,
    event: React.MouseEvent<HTMLElement>,
  ) => {
    if (isMobile) return;

    // Set the social URL to show
    setHoveredSocialUrl(url);

    // Update position
    setMemberTooltipPosition({
      x: event.clientX,
      y: event.clientY + 15,
    });

    // Make sure tooltip is visible
    setTooltipVisible(true);

    // Prevent parent tooltip from showing
    event.stopPropagation();
  };

  // Handle mouse leave from social icon
  const handleSocialLeave = () => {
    setHoveredSocialUrl(null);
  };

  // Open modal when card is clicked
  const handleCardClick = () => {
    setIsModalOpen(true);
  };

  // Determine if the member has role history
  const hasRoleHistory =
    member.previousRoles && member.previousRoles.length > 0;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.5,
          delay: noStaggerDelay ? 0 : index * 0.1,
          ease: [0.19, 1, 0.22, 1],
        }}
        whileHover={{
          y: isMobile ? 0 : -8,
          transition: { duration: 0.3, ease: "easeOut" },
        }}
        onHoverStart={() => handleMouseEnter()}
        onHoverEnd={() => handleMouseLeave()}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleDivMouseEnter}
        onClick={handleCardClick}
        className="relative group h-full"
      >
        {/* Set a fixed min-height for non-mobile cards to ensure equal height, accounting for year badges */}
        <Card
          className={cn(
            "overflow-hidden transition-all duration-300 group-hover:shadow-lg border-2 border-transparent group-hover:border-primary/20 cursor-pointer",
            !isMobile && "min-h-[320px] sm:h-full",
          )}
        >
          <div className="aspect-square overflow-hidden relative">
            <div
              className={cn(
                "absolute inset-0 bg-linear-to-t from-black/70 to-transparent z-10 opacity-0 transition-opacity duration-300",
                isHovered ? "opacity-100" : "",
              )}
            />
            <Avatar className="h-full w-full rounded-none">
              {member.image ? (
                <AvatarImage
                  src={member.image}
                  alt={member.name}
                  loading={index === 0 ? "eager" : "lazy"}
                  className="object-cover transition-transform duration-500 group-hover:scale-110 h-full w-full"
                />
              ) : (
                <AvatarFallback className="h-full w-full rounded-none text-5xl">
                  {member.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              )}
            </Avatar>

            <div
              className={cn(
                "absolute bottom-0 left-0 right-0 p-4 z-20 transform transition-transform duration-300",
                isHovered ? "translate-y-0" : "translate-y-full opacity-0",
              )}
            >
              <div className="flex gap-2 justify-center">
                {member.linkedin && (
                  <Link
                    href={member.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <motion.div
                      whileHover={{ scale: 1.2 }}
                      whileTap={{ scale: 0.9 }}
                      className="bg-white/90 text-primary p-2 rounded-full"
                      onMouseEnter={(e) =>
                        handleSocialHover("linkedin", member.linkedin!, e)
                      }
                      onMouseLeave={handleSocialLeave}
                    >
                      <Linkedin className="h-4 w-4" />
                    </motion.div>
                  </Link>
                )}
                {member.github && (
                  <Link
                    href={member.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <motion.div
                      whileHover={{ scale: 1.2 }}
                      whileTap={{ scale: 0.9 }}
                      className="bg-white/90 text-primary p-2 rounded-full"
                      onMouseEnter={(e) =>
                        handleSocialHover("github", member.github!, e)
                      }
                      onMouseLeave={handleSocialLeave}
                    >
                      <Github className="h-4 w-4" />
                    </motion.div>
                  </Link>
                )}
                {member.website && (
                  <Link
                    href={member.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <motion.div
                      whileHover={{ scale: 1.2 }}
                      whileTap={{ scale: 0.9 }}
                      className="bg-white/90 text-primary p-2 rounded-full"
                      onMouseEnter={(e) =>
                        handleSocialHover("website", member.website!, e)
                      }
                      onMouseLeave={handleSocialLeave}
                    >
                      <Globe className="h-4 w-4" />
                    </motion.div>
                  </Link>
                )}
                {member.twitter && (
                  <Link
                    href={member.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <motion.div
                      whileHover={{ scale: 1.2 }}
                      whileTap={{ scale: 0.9 }}
                      className="bg-white/90 text-primary p-2 rounded-full"
                      onMouseEnter={(e) =>
                        handleSocialHover("twitter", member.twitter!, e)
                      }
                      onMouseLeave={handleSocialLeave}
                    >
                      <Twitter className="h-4 w-4" />
                    </motion.div>
                  </Link>
                )}
              </div>
            </div>
          </div>
          <CardHeader className="p-4 pb-0">
            <h3 className="text-lg font-semibold whitespace-pre-line">
              {member.name.replace(" ", "\n")}
            </h3>
          </CardHeader>
          <CardContent className="p-4 pt-1 pb-4">
            <div className="flex items-start justify-between">
              <div className="min-h-[40px] flex-1">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {member.role}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Blur Tooltip - only show on desktop */}
      {!isMobile && memberTooltipPosition && (
        <BlurTooltip
          position={memberTooltipPosition}
          content={hoveredSocialUrl || `Learn more about ${member.name}`}
          visible={tooltipVisible}
          id={`member-tooltip-${index}`}
        />
      )}

      {/* Modal with member details */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[600px] p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>{member.name} - Team Member Details</DialogTitle>
          </DialogHeader>

          <button
            onClick={() => setIsModalOpen(false)}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>

          <div className="p-6">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="w-full md:w-1/3 max-w-[200px] mx-auto md:mx-0">
                <div className="aspect-square w-full overflow-hidden rounded-md border border-border/20">
                  {member.image ? (
                    <Image
                      src={member.circularImage || member.image}
                      alt={member.name}
                      width={200}
                      height={200}
                      className="h-full w-full object-cover object-center"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted text-4xl font-semibold">
                      {member.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1">
                <h2 className="text-2xl font-semibold mb-1">{member.name}</h2>
                <p className="text-muted-foreground mb-4">{member.role}</p>

                {member.bio && (
                  <div className="mb-4">
                    <h3 className="text-sm font-medium mb-2">About</h3>
                    <p className="text-sm">{member.bio}</p>
                  </div>
                )}

                {hasRoleHistory && (
                  <div className="mb-4">
                    <h3 className="text-sm font-medium mb-2">
                      Experience at FirstByte
                    </h3>
                    <div className="relative pl-6">
                      <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-linear-to-b from-muted-foreground/30 to-primary" />
                      {member.previousRoles?.map((role, idx) => (
                        <div key={idx} className="mb-3 relative">
                          <div className="absolute left-[-18px] top-0.5 h-3 w-3 rounded-full bg-primary ring-2 ring-background" />
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">
                              {role.role}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {role.year}
                            </span>
                          </div>
                        </div>
                      ))}
                      <div className="mb-0 relative">
                        <div className="absolute left-[-18px] top-0.5 h-3 w-3 rounded-full bg-primary ring-2 ring-background" />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {member.role}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Current
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  {member.linkedin && (
                    <Link
                      href={member.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onMouseEnter={(e) =>
                          handleSocialHover("linkedin", member.linkedin!, e)
                        }
                        onMouseLeave={handleSocialLeave}
                      >
                        <Linkedin className="h-4 w-4" />
                        LinkedIn
                      </Button>
                    </Link>
                  )}
                  {member.github && (
                    <Link
                      href={member.github}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onMouseEnter={(e) =>
                          handleSocialHover("github", member.github!, e)
                        }
                        onMouseLeave={handleSocialLeave}
                      >
                        <Github className="h-4 w-4" />
                        Github
                      </Button>
                    </Link>
                  )}
                  {member.website && (
                    <Link
                      href={member.website}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onMouseEnter={(e) =>
                          handleSocialHover("website", member.website!, e)
                        }
                        onMouseLeave={handleSocialLeave}
                      >
                        <Globe className="h-4 w-4" />
                        Website
                      </Button>
                    </Link>
                  )}
                  {member.twitter && (
                    <Link
                      href={member.twitter}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onMouseEnter={(e) =>
                          handleSocialHover("twitter", member.twitter!, e)
                        }
                        onMouseLeave={handleSocialLeave}
                      >
                        <Twitter className="h-4 w-4" />
                        Twitter
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export const TeamSection = forwardRef<HTMLElement, TeamSectionProps>(
  ({ className }, ref) => {
    const [showingMore] = useState(false);

    // const currentVisible = currentExecutiveBoard.slice(0, visibleCount)

    return (
      <section
        ref={ref}
        id="team"
        className={cn(
          "bg-[hsl(var(--gray-50))] text-foreground pt-32 pb-10 overflow-hidden bg-dots-light",
          className,
        )}
      >
        <div className="container mx-auto px-4 md:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-4 md:gap-8 mb-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl font-semibold leading-tight sm:text-5xl sm:leading-tight">
                Our Team
              </h2>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <p className="text-md font-medium text-muted-foreground sm:text-xl">
                Meet the talented individuals behind FirstByte who make our
                mission of coding education possible.
              </p>
            </motion.div>
          </div>

          {/* Current Executive Board */}
          <div className="mb-20">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="flex justify-between items-end mb-8"
            >
              <h3 className="text-2xl font-semibold">
                Current Executive Board
              </h3>
              <div className="text-sm text-muted-foreground">2026-2027</div>
            </motion.div>

            <div className="flex overflow-x-auto snap-x snap-mandatory -mx-4 px-4 sm:grid sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 sm:auto-rows-fr sm:overflow-visible sm:mx-0 sm:px-0 gap-6 md:gap-8">
              {currentExecutiveBoard.map((member, index) => (
                <div
                  key={member.name}
                  className="snap-center shrink-0 w-[80%] sm:w-auto sm:shrink sm:h-full"
                >
                  <TeamMemberCard
                    member={member}
                    index={index}
                    noStaggerDelay={showingMore}
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
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="flex items-center mb-8"
            >
              <div className="h-px grow bg-border"></div>
              <h3 className="text-xl font-semibold px-4">
                Previous Leadership
              </h3>
              <div className="h-px grow bg-border"></div>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {pastBoards.map((board, index) => (
                <CardStack key={board.year} board={board} index={index} />
              ))}
            </div>
          </div>

          {/* Call to action */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="flex justify-center mt-20"
          >
            <Link href="/team">
              <AnimatedGlowButton
                color="green"
                className="flex items-center gap-2 text-sm font-medium"
              >
                See Full Team Directory
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </AnimatedGlowButton>
            </Link>
          </motion.div>
        </div>
      </section>
    );
  },
);

TeamSection.displayName = "TeamSection";
