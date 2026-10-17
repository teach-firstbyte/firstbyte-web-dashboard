// Links that more than one part of the chrome needs.

export const SUGGESTION_BOX_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLScxQObKPt3h9o1rvlRTabEvoI2ogJnzFIVKqDumV02j5ME67A/viewform?usp=header";

export type NavLink = { href: string; label: string };

/** Officer view: the club at a glance, then the reference pages. */
export const OFFICER_LINKS: NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/meetings", label: "Meetings" },
  { href: "/attendance", label: "Attendance" },
  { href: "/members", label: "Members" },
  { href: "/teams", label: "Teams" },
  { href: "/feedback", label: "Feedback" },
];

/** Member view, and officers previewing it. */
export const MEMBER_LINKS: NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/meetings", label: "Meetings" },
  { href: "/attendance", label: "My attendance" },
];

/**
 * Added to either list while the newsletter prototype is switched on (see
 * lib/newsletter/enabled.ts). Off in production until it launches.
 */
export const NEWSLETTER_LINK: NavLink = {
  href: "/newsletter",
  label: "Newsletter",
};
