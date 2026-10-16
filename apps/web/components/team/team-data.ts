// Team data and helpers. This module is safe to import on the server; client
// components should get what they need through props, so that team.json does
// not end up in the browser bundle.
import teamData from "@/data/team.json";

export interface TeamMember {
  name: string;
  role: string;
  image?: string | null;
  circularImage?: string | null;
  bio?: string;
  linkedin?: string;
  twitter?: string;
  github?: string;
  website?: string;
  years?: string[]; // List of years with FirstByte (e.g. ["2022", "2023", "2024"])
  previousRoles?: { role: string; year: string }[]; // Previous roles with years
  // On a past board, `role` is the role for that year and this is the
  // member's current role, so client components need not look it up
  currentRole?: string;
}

export interface PastBoard {
  year: string;
  title: string;
  members: TeamMember[];
  teamPhoto?: { image: string; description: string } | null;
}

// Get all team members from the JSON data
export const allTeamMembers: TeamMember[] = teamData.allTeamMembers;
// Get team photos if available
const teamPhotos = teamData.teamPhotos || [];

// Helper function to get the correct role for a specific year
export const getRoleForYear = (member: TeamMember, year: string): string => {
  // If we're looking for the current year (2026) role
  if (year === "Fall 2026") {
    return member.role;
  }

  // If we're looking for a historical role
  const historicalRole = member.previousRoles?.find(
    (role) => role.year === year,
  );
  return historicalRole ? historicalRole.role : member.role;
};

// Get team photo for a specific year if available
export const getTeamPhotoForYear = (
  year: string,
): { image: string; description: string } | null => {
  const photo = teamPhotos.find((p) => p.year === year);
  return photo || null;
};
