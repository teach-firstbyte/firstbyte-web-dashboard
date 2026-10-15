import { Badge } from "@/components/ui/badge";

// Mirrors the AccountStatus enum in prisma/schema.prisma. Shared by the approval
// queue and the users table so the two can't drift.
export function AccountStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "APPROVED":
      return <Badge variant="default">Approved</Badge>;
    case "PENDING":
      return <Badge variant="outline">Pending</Badge>;
    case "DENIED":
      return <Badge variant="destructive">Denied</Badge>;
    case "ONBOARDING":
      return <Badge variant="secondary">Onboarding</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

// Mirrors TeamMemberStatus. A request an officer hasn't decided yet is the
// common case, so it reads as "Requested" rather than "Pending" to avoid
// colliding with the account-level wording above.
export function TeamRequestBadge({ status }: { status: string }) {
  switch (status) {
    case "APPROVED":
      return <Badge variant="default">Approved</Badge>;
    case "REJECTED":
      return <Badge variant="destructive">Rejected</Badge>;
    case "PENDING":
      return <Badge variant="outline">Requested</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}
