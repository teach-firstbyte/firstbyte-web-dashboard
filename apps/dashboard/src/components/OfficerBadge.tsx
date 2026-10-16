import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { isSuperAdminRole } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";

// Marks a user as an officer. "Officer" here means exactly what isOfficer()
// means -- the club-wide Role enum, NORTHEASTERN_ADMIN or SUPER_ADMIN -- so the
// badge tracks who can actually reach the officer dashboard and the admin APIs.
// It is deliberately NOT TeamRole.LEAD, which is a per-team role and a separate
// population; team rosters render that alongside this, in its own badge.

/**
 * The full "star + Officer" badge, for anywhere there is room for the label.
 *
 * Pass `role` where the two officer tiers should look different -- the
 * Members table and panel, where promotions happen -- and a super admin reads
 * "Super admin". Elsewhere both are just officers.
 */
export function OfficerBadge({
  className,
  role,
}: {
  className?: string;
  role?: string;
}) {
  return (
    <Badge className={className}>
      <OfficerStarIcon />
      {role && isSuperAdminRole(role) ? "Super admin" : "Officer"}
    </Badge>
  );
}

/**
 * Just the star, for dense spots where the word doesn't fit -- inside a roster
 * chip that already carries the member's name and team role. Carries its own
 * screen-reader label, since on its own the icon conveys the whole meaning.
 */
export function OfficerStar({ className }: { className?: string }) {
  return (
    <>
      <OfficerStarIcon className={className} />
      <span className="sr-only">Officer</span>
    </>
  );
}

/**
 * Filled rather than lucide's default outline: at the 12px the Badge forces on
 * its svg children, an outlined star reads as noise.
 *
 * The size here is intentionally overridable-by-context. Badge's base styles
 * include `[&>svg]:size-3`, whose compiled `.badge>svg` selector outranks a bare
 * `size-3.5` utility, so this renders at 12px inside a Badge and 14px beside
 * plain text.
 */
function OfficerStarIcon({ className }: { className?: string }) {
  return (
    <Star
      aria-hidden="true"
      className={cn("size-3.5 shrink-0 fill-current", className)}
    />
  );
}
