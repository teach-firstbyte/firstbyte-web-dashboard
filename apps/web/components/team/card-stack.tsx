"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronRight,
  Clock,
  Linkedin,
  Twitter,
  Github,
  Globe,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AnimatedTooltip } from "@/components/ui/animated-tooltip";
import { BlurTooltip, TooltipPosition } from "@/components/ui/blur-tooltip";
import {
  useIsMobile,
  type PastBoard,
  type TeamMember,
} from "@/components/team/shared";

// ---------------------------------------------------------------------------
// Tooltips (only used by CardStack)
// ---------------------------------------------------------------------------

// Portal component for tooltips
function TooltipPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  // Only render portal content after component is mounted
  // This avoids hydration issues with SSR
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return typeof window !== "undefined"
    ? createPortal(children, document.body)
    : null;
}

interface ClassicTooltipProps {
  position: TooltipPosition;
  title: string;
  subtitle?: string;
  visible: boolean;
  id?: string;
}

// Reusable original style tooltip
function ClassicTooltip({
  position,
  title,
  subtitle,
  visible,
  id = "tooltip",
}: ClassicTooltipProps) {
  return (
    <TooltipPortal>
      <div
        className="pointer-events-none fixed left-0 top-0 z-9999"
        id={`STALKER-${id}`}
        style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
      >
        <div
          className="bg-popover rounded-md shadow-lg px-4 py-2 min-w-[140px] text-center transform -translate-x-1/2"
          style={{
            filter: visible ? "blur(0px)" : "blur(16px)",
            opacity: visible ? 1 : 0,
            transitionDuration: "1.2s",
            transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
          }}
        >
          <div className="absolute inset-x-10 w-[20%] -bottom-px bg-linear-to-r from-transparent via-primary to-transparent h-px" />
          <div className="absolute left-10 w-[40%] z-30 -bottom-px bg-linear-to-r from-transparent via-primary/70 to-transparent h-px" />
          <div className="font-bold text-base text-popover-foreground">
            {title}
          </div>
          {subtitle && (
            <div className="text-xs text-muted-foreground">{subtitle}</div>
          )}
        </div>
      </div>
    </TooltipPortal>
  );
}

// ---------------------------------------------------------------------------
// Social links (shared between focused detail + member grid)
// ---------------------------------------------------------------------------

type SocialKey = "linkedin" | "github" | "website" | "twitter";

const SOCIAL_LINKS: { key: SocialKey; Icon: typeof Linkedin }[] = [
  { key: "linkedin", Icon: Linkedin },
  { key: "github", Icon: Github },
  { key: "website", Icon: Globe },
  { key: "twitter", Icon: Twitter },
];

function MemberSocialLinks({
  member,
  size = "sm",
  onHover,
  onLeave,
}: {
  member: TeamMember;
  size?: "sm" | "lg";
  onHover: (
    type: SocialKey,
    url: string,
    event: React.MouseEvent<HTMLElement>,
  ) => void;
  onLeave: () => void;
}) {
  return (
    <>
      {SOCIAL_LINKS.map(({ key, Icon }) => {
        const url = member[key];
        if (!url) return null;

        return (
          <Link
            key={key}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            onMouseEnter={(e) => onHover(key, url, e)}
            onMouseLeave={onLeave}
          >
            <div
              className={cn(
                "text-muted-foreground hover:text-primary",
                size === "lg" ? "p-2" : "p-1",
              )}
            >
              <Icon className={cn(size === "lg" ? "h-4 w-4" : "h-3 w-3")} />
            </div>
          </Link>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// Role progression timeline
// ---------------------------------------------------------------------------

interface TimelineRole {
  year: string;
  role: string;
  isCurrent: boolean;
  isHighlighted: boolean;
  isLastRole: boolean;
}

interface ConsolidatedRole {
  startYear: string;
  endYear: string;
  role: string;
  isCurrent: boolean;
  isHighlighted: boolean;
  isLastRole: boolean;
}

// Build a consolidated, chronological role timeline for a member, grouping
// consecutive years that share the same (non-special) role.
function buildConsolidatedRoles(
  member: TeamMember,
  boardYear: string,
): ConsolidatedRole[] {
  // A past board's member has that year's role; use their current role for
  // the current year so the timeline is accurate
  const originalMember = { ...member, role: member.currentRole ?? member.role };

  const activeYears = originalMember.years || [];
  const isActiveCurrently = activeYears.includes("2026");
  const mostRecentYear =
    activeYears.length > 0
      ? [...activeYears].sort((a, b) => b.localeCompare(a))[0]
      : "";

  const timeline: TimelineRole[] = [];

  // Add previous roles from the member's history (chronological order)
  if (originalMember.previousRoles) {
    [...originalMember.previousRoles]
      .sort((a, b) => a.year.localeCompare(b.year))
      .forEach((prevRole) => {
        timeline.push({
          year: prevRole.year,
          role: prevRole.role,
          isCurrent: false, // Never mark past roles as "current"
          isHighlighted: prevRole.year === boardYear,
          // Their final role is the most recent year if not active in 2026
          isLastRole: !isActiveCurrently && prevRole.year === mostRecentYear,
        });
      });
  }

  // Add the current role only if the member is active in 2026
  if (isActiveCurrently && mostRecentYear === "2026") {
    timeline.push({
      year: "2026",
      role: originalMember.role, // Always use the full role for current year
      isCurrent: true,
      isHighlighted: boardYear === "2026",
      isLastRole: false,
    });
  }

  const sortedTimeline = timeline.sort((a, b) => a.year.localeCompare(b.year));

  // Group consecutive years that share the same role for display
  const consolidated: ConsolidatedRole[] = [];
  let group: ConsolidatedRole | null = null;

  sortedTimeline.forEach((item, index) => {
    // Special items always get their own group (so styling stays accurate)
    const isSpecial = item.isHighlighted || item.isCurrent || item.isLastRole;

    if (!group || group.role !== item.role || isSpecial) {
      if (group) consolidated.push(group);
      group = {
        startYear: item.year,
        endYear: item.year,
        role: item.role,
        isCurrent: item.isCurrent,
        isHighlighted: item.isHighlighted,
        isLastRole: item.isLastRole,
      };
    } else {
      group.endYear = item.year;
    }

    if (index === sortedTimeline.length - 1 && group) {
      consolidated.push(group);
    }
  });

  return consolidated;
}

function RoleProgression({
  member,
  boardYear,
}: {
  member: TeamMember;
  boardYear: string;
}) {
  if (!member.previousRoles || member.previousRoles.length === 0) return null;

  const consolidatedRoles = buildConsolidatedRoles(member, boardYear);

  return (
    <div className="mt-4 pt-3 border-t border-border/30">
      <h4 className="text-sm font-medium mb-2 text-foreground flex items-center">
        <Clock className="h-3.5 w-3.5 mr-1.5 text-primary" />
        Role Progression:
      </h4>
      <div className="relative pl-6 pt-1">
        {/* Timeline line */}
        <div className="absolute left-2 top-2 bottom-0 w-0.5 bg-linear-to-b from-muted-foreground/30 to-primary" />

        {consolidatedRoles.map((item, idx) => (
          <div key={idx} className="mb-3 relative">
            <div
              className={cn(
                "absolute left-[-18px] top-0.5 h-3 w-3 rounded-full ring-2 ring-background",
                item.isHighlighted
                  ? "bg-primary" // Highlighted year gets primary/green color
                  : item.isCurrent || item.isLastRole
                    ? "bg-foreground" // Current role or last role gets black dot
                    : "bg-muted-foreground", // Past role gets gray dot
              )}
            />
            <div className="flex flex-col">
              <span
                className={cn(
                  "text-sm",
                  item.isHighlighted
                    ? "font-semibold text-primary"
                    : item.isCurrent || item.isLastRole
                      ? "font-semibold"
                      : "",
                )}
              >
                {item.role}
              </span>
              <span className="text-xs text-muted-foreground">
                {
                  item.startYear === item.endYear
                    ? item.startYear // Single year
                    : `${item.startYear} - ${item.endYear}` /* Year range */
                }
                {item.isHighlighted && " • Currently viewing"}
                {item.isCurrent && " • Current"}
                {item.isLastRole && " • Final role"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Focused member detail view
// ---------------------------------------------------------------------------

function FocusedMemberDetail({
  member,
  boardYear,
  onBack,
  onSocialHover,
  onSocialLeave,
}: {
  member: TeamMember;
  boardYear: string;
  onBack: () => void;
  onSocialHover: (
    type: SocialKey,
    url: string,
    event: React.MouseEvent<HTMLElement>,
  ) => void;
  onSocialLeave: () => void;
}) {
  const bio = member.bio;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="mb-6 border rounded-lg p-4 bg-muted/10"
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onBack();
        }}
        className="flex items-center text-sm text-primary mb-4 hover:underline"
      >
        <ChevronRight className="h-4 w-4 rotate-180 mr-1" />
        Back to all members
      </button>

      <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="w-full md:w-1/3 max-w-[200px]"
        >
          <Avatar className="h-full w-full aspect-square">
            {member.image ? (
              <AvatarImage
                src={member.circularImage || member.image}
                alt={member.name}
                className="object-cover object-center"
              />
            ) : (
              <AvatarFallback className="text-4xl">
                {member.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </AvatarFallback>
            )}
          </Avatar>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: -5 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
          className="flex-1"
        >
          <h4 className="text-xl font-semibold">{member.name}</h4>
          <p className="text-sm text-muted-foreground mb-3">{member.role}</p>

          {bio && <p className="text-sm mb-4">{bio}</p>}

          <RoleProgression member={member} boardYear={boardYear} />

          <div className="flex gap-2 mt-3">
            <MemberSocialLinks
              member={member}
              size="sm"
              onHover={onSocialHover}
              onLeave={onSocialLeave}
            />
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Member card within the expanded grid
// ---------------------------------------------------------------------------

function MemberGridCard({
  member,
  index,
  isMobile,
  isDimmed,
  onFocus,
  onSocialHover,
  onSocialLeave,
  onMouseEnter,
  onMouseLeave,
  onMouseMove,
}: {
  member: TeamMember;
  index: number;
  isMobile: boolean;
  isDimmed: boolean;
  onFocus: () => void;
  onSocialHover: (
    type: SocialKey,
    url: string,
    event: React.MouseEvent<HTMLElement>,
  ) => void;
  onSocialLeave: () => void;
  onMouseEnter: (event: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave: () => void;
  onMouseMove: (event: React.MouseEvent<HTMLDivElement>) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{
        opacity: 1,
        y: 0,
        transition: { delay: index * 0.05, duration: 0.3 },
      }}
      whileHover={{ y: isMobile ? 0 : -4, transition: { duration: 0.2 } }}
      className={cn(
        "transition-opacity duration-200 relative",
        isDimmed ? "opacity-70" : "opacity-100",
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseMove={onMouseMove}
    >
      <Card
        className="overflow-hidden shadow-xs hover:shadow-md hover:border-primary/20 cursor-pointer transition-all duration-200"
        onClick={(e) => {
          e.stopPropagation();
          onFocus();
        }}
      >
        <div className="flex items-center p-3 gap-3 relative group">
          <Avatar
            className={cn(
              "transition-transform duration-200 cursor-pointer",
              isMobile ? "h-14 w-14" : "h-12 w-12 hover:scale-110",
            )}
            onClick={(e) => {
              e.stopPropagation();
              onFocus();
            }}
          >
            {member.image ? (
              <AvatarImage
                src={member.circularImage || member.image}
                alt={member.name}
                className="object-cover object-center"
              />
            ) : (
              <AvatarFallback>
                {member.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </AvatarFallback>
            )}
          </Avatar>
          <div className="flex-1 min-w-0">
            <h4
              className={cn(
                "font-medium truncate",
                isMobile ? "text-base" : "text-sm",
              )}
            >
              {member.name}
            </h4>
            <p
              className={cn(
                "text-muted-foreground truncate",
                isMobile ? "text-sm" : "text-xs",
              )}
            >
              {member.role}
            </p>
          </div>
          <div className={cn("flex", isMobile ? "gap-2" : "gap-1")}>
            <MemberSocialLinks
              member={member}
              size={isMobile ? "lg" : "sm"}
              onHover={onSocialHover}
              onLeave={onSocialLeave}
            />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// CardStack
// ---------------------------------------------------------------------------

export function CardStack({
  board,
  index,
}: {
  board: PastBoard;
  index: number;
}) {
  const isMobile = useIsMobile();
  // Always render closed-first (smaller) on both mobile and web.
  const [isExpanded, setIsExpanded] = useState(false);
  const [focusedMember, setFocusedMember] = useState<number | null>(null);
  const [hoveredMemberIndex, setHoveredMemberIndex] = useState<number | null>(
    null,
  );
  const [cardTooltipRect, setCardTooltipRect] =
    useState<TooltipPosition | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [infoTooltipVisible, setInfoTooltipVisible] = useState(false);
  const [infoTooltipPosition, setInfoTooltipPosition] =
    useState<TooltipPosition | null>(null);
  const [activeTooltipId, setActiveTooltipId] = useState<string | null>(null);

  // Social media hover state - stores just the URL
  const [hoveredSocialUrl, setHoveredSocialUrl] = useState<string | null>(null);

  // Visibility state for member tooltip animation
  const [memberTooltipVisible, setMemberTooltipVisible] = useState(false);

  // Ref to track member tooltip cleanup timer
  const memberTooltipTimer = React.useRef<NodeJS.Timeout | null>(null);

  // Handle info icon hover (desktop)
  const handleInfoMouseEnter = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isMobile) return;
    setInfoTooltipPosition({ x: event.clientX, y: event.clientY + 15 });
    setInfoTooltipVisible(true);
  };

  const handleInfoMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isMobile) return;
    setInfoTooltipPosition({ x: event.clientX, y: event.clientY + 15 });
  };

  const handleInfoMouseLeave = () => {
    if (isMobile) return;
    setInfoTooltipVisible(false);
  };

  // Handle info icon click for mobile
  const handleInfoClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isMobile) return;

    // Position tooltip below the icon
    const rect = event.currentTarget.getBoundingClientRect();
    setInfoTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.bottom + 10,
    });

    // Toggle tooltip visibility
    if (activeTooltipId === "revival-info") {
      setActiveTooltipId(null);
      setInfoTooltipVisible(false);
    } else {
      setActiveTooltipId("revival-info");
      setInfoTooltipVisible(true);
    }

    event.stopPropagation();
  };

  // Close tooltip when clicking elsewhere on mobile
  useEffect(() => {
    if (!isMobile || !activeTooltipId) return;

    const handleClickOutside = () => {
      setActiveTooltipId(null);
      setInfoTooltipVisible(false);
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [isMobile, activeTooltipId]);

  // Handle mouse enter on member card
  const handleMouseEnter = (
    index: number,
    event: React.MouseEvent<HTMLDivElement>,
  ) => {
    if (isTransitioning || isMobile) return;

    // Clear any pending cleanup for member tooltip
    if (memberTooltipTimer.current) {
      clearTimeout(memberTooltipTimer.current);
      memberTooltipTimer.current = null;
    }

    setCardTooltipRect({ x: event.clientX, y: event.clientY });
    setHoveredSocialUrl(null);
    setHoveredMemberIndex(index);
    setMemberTooltipVisible(true);
  };

  // Handle mouse leave from member card
  const handleMouseLeave = () => {
    setHoveredSocialUrl(null);
    setMemberTooltipVisible(false);

    // Schedule cleanup after exit animation completes
    memberTooltipTimer.current = setTimeout(() => {
      if (!memberTooltipVisible) {
        setHoveredMemberIndex(null);
      }
      memberTooltipTimer.current = null;
    }, 1200); // Match exit animation duration
  };

  // Handle social icon hover
  const handleSocialHover = (
    type: SocialKey,
    url: string,
    event: React.MouseEvent<HTMLElement>,
  ) => {
    if (isMobile) return;

    setHoveredSocialUrl(url);
    setCardTooltipRect({ x: event.clientX, y: event.clientY + 15 });
    setMemberTooltipVisible(true);
    event.stopPropagation();
  };

  // Handle mouse leave from social icon
  const handleSocialLeave = () => {
    setHoveredSocialUrl(null);
  };

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (memberTooltipTimer.current) {
        clearTimeout(memberTooltipTimer.current);
      }
    };
  }, []);

  // Format board members for AnimatedTooltip
  const tooltipMembers = board.members.map((member, idx) => ({
    id: idx,
    name: member.name,
    designation: member.role,
    image:
      member.circularImage ||
      member.image ||
      "/teamMemberPhotos/default-pfp.jpg",
  }));

  // Smooth transition from avatar to profile
  const handleAvatarClick = (id: number) => {
    if (isTransitioning) return;

    setIsTransitioning(true);
    setHoveredMemberIndex(id);
    setIsExpanded(true);
    setFocusedMember(id);

    setTimeout(() => {
      setHoveredMemberIndex(null);
      setIsTransitioning(false);
    }, 300);
  };

  // Handle mouse move to update tooltip position
  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (hoveredMemberIndex === null) return;
    setCardTooltipRect({ x: event.clientX, y: event.clientY });
  };

  // Toggle expand/collapse via the chevron button
  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isExpanded) {
      // First hide the focused member, then close the card shortly after
      setFocusedMember(null);
      setTimeout(() => setIsExpanded(false), 200);
    } else {
      setIsExpanded(true);
    }
  };

  // Get team photo if available for this board's year
  const boardYear = board.year.split("-")[0];
  const teamPhoto = board.teamPhoto ?? null;
  const isRevivalTeam = boardYear === "2022";

  return (
    <div
      className="relative motion-safe:animate-fade-up"
      style={{
        animationDuration: "0.5s",
        animationDelay: `${index * 0.2}s`,
      }}
    >
      <div
        className={cn(
          "relative transition-all duration-500 ease-out",
          isExpanded ? "mb-8" : "mb-0",
        )}
      >
        {/* Card Stack */}
        <div className="relative">
          {/* Stacked background cards for the closed (smaller) look */}
          <AnimatePresence>
            {!isExpanded && (
              <>
                <motion.div
                  key="bg-card-1"
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="absolute -bottom-2 -right-2 w-full h-full bg-muted/30 rounded-lg rotate-2 shadow-xs"
                />
                <motion.div
                  key="bg-card-2"
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="absolute -bottom-1 -left-2 w-full h-full bg-muted/50 rounded-lg -rotate-1 shadow-xs"
                />
              </>
            )}
          </AnimatePresence>

          {/* Main stack card */}
          <motion.div
            layout
            transition={{ layout: { duration: 0.5, type: "spring" } }}
          >
            <Card
              className={cn(
                "relative z-10 transition-shadow duration-300 shadow-md border-2 border-transparent hover:border-primary/20",
                isExpanded ? "w-full" : "aspect-square sm:aspect-auto",
                !isExpanded ? "cursor-pointer" : "",
              )}
              onClick={() => !isExpanded && setIsExpanded(true)}
            >
              <motion.div
                layout
                transition={{ layout: { duration: 0.5, type: "spring" } }}
                className="p-6"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-semibold">{board.title}</h3>
                      {isRevivalTeam && (
                        <div
                          className={cn(
                            "text-primary hover:text-primary/80",
                            isMobile ? "cursor-pointer" : "cursor-default",
                          )}
                          onMouseEnter={handleInfoMouseEnter}
                          onMouseMove={handleInfoMouseMove}
                          onMouseLeave={handleInfoMouseLeave}
                          onClick={handleInfoClick}
                        >
                          <Info className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                      <Clock className="h-3 w-3" />
                      <span>{board.year}</span>
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleToggle}
                    className="bg-primary/10 hover:bg-primary/20 rounded-full p-2 transition-colors"
                  >
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform duration-300",
                        isExpanded ? "rotate-180" : "",
                      )}
                    />
                  </motion.button>
                </div>

                <AnimatePresence mode="wait">
                  {!isExpanded ? (
                    <motion.div
                      initial={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="relative mb-4"
                      style={{ zIndex: 40 }}
                    >
                      <AnimatedTooltip
                        items={tooltipMembers}
                        className="mx-auto"
                        onItemClick={handleAvatarClick}
                      />
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{
                        opacity: { duration: 0.2 },
                        layout: { duration: 0.3, type: "spring", bounce: 0.1 },
                      }}
                      className="overflow-hidden"
                    >
                      {/* Focused member detail view */}
                      <AnimatePresence mode="wait">
                        {focusedMember !== null && (
                          <FocusedMemberDetail
                            key={`member-${focusedMember}`}
                            member={board.members[focusedMember]}
                            boardYear={boardYear}
                            onBack={() => setFocusedMember(null)}
                            onSocialHover={handleSocialHover}
                            onSocialLeave={handleSocialLeave}
                          />
                        )}
                      </AnimatePresence>

                      {/* Team photo if available */}
                      {teamPhoto && focusedMember === null && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.3 }}
                          className="mb-6"
                        >
                          <div className="relative aspect-video overflow-hidden rounded-lg border mb-2">
                            <Image
                              src={teamPhoto.image}
                              alt={teamPhoto.description}
                              width={800}
                              height={450}
                              className="object-cover"
                            />
                          </div>
                          <p className="text-sm text-center text-muted-foreground">
                            {teamPhoto.description}
                          </p>
                        </motion.div>
                      )}

                      {/* Show all members */}
                      <div className="mt-4">
                        <h4 className="text-sm font-medium mb-3">
                          {board.members.length} Team Members
                        </h4>
                        <div
                          className={cn(
                            "grid gap-3",
                            isMobile
                              ? "grid-cols-1"
                              : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4",
                          )}
                        >
                          {board.members.map((member, i) => (
                            <MemberGridCard
                              key={i}
                              member={member}
                              index={i}
                              isMobile={isMobile}
                              isDimmed={focusedMember === i}
                              onFocus={() => setFocusedMember(i)}
                              onSocialHover={handleSocialHover}
                              onSocialLeave={handleSocialLeave}
                              onMouseEnter={(e) => handleMouseEnter(i, e)}
                              onMouseLeave={handleMouseLeave}
                              onMouseMove={handleMouseMove}
                            />
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {!isExpanded && (
                  <div className="text-xs text-muted-foreground mt-4">
                    <span className="font-medium">
                      {board.members.length} members
                    </span>{" "}
                    • {isMobile ? "Tap" : "Click"} to expand
                  </div>
                )}
              </motion.div>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Member tooltip using ClassicTooltip - only show on desktop */}
      {!isMobile &&
        hoveredMemberIndex !== null &&
        cardTooltipRect &&
        isExpanded && (
          <ClassicTooltip
            position={cardTooltipRect}
            title={board.members[hoveredMemberIndex]?.name}
            subtitle={
              hoveredSocialUrl || board.members[hoveredMemberIndex]?.role
            }
            visible={memberTooltipVisible}
            id={`member-${hoveredMemberIndex}`}
          />
        )}

      {/* Info tooltip for Revival Team */}
      {isRevivalTeam && infoTooltipPosition && (
        <BlurTooltip
          position={infoTooltipPosition}
          content="As the only active members during this year, this team revitalized the club from the ground up and established the foundation for what FirstByte is today."
          visible={infoTooltipVisible}
          id="revival-team-info"
          className="max-w-[250px]"
          hideIcon={true}
        />
      )}
    </div>
  );
}
