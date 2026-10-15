import { Star } from "lucide-react";

import { PageHeader } from "@/components/common/Section";
import { FeedbackTable } from "@/components/feedback/FeedbackTable";
import { AppShell } from "@/components/layout/AppShell";
import { Banner } from "@/components/ui/banner";
import { requireOfficer } from "@/lib/auth/requireOfficer";
import { listFeedbackForViewer } from "@/server/feedback/queries";
import type { Feedback } from "@/types/dashboard";

/**
 * All feedback, newest first. Rows arrive already redacted by
 * listFeedbackForViewer, so anonymous authors stay hidden here too.
 */
export default async function FeedbackListPage() {
  const user = await requireOfficer();

  let feedback: Feedback[] = [];
  let dbUnavailable = false;
  try {
    feedback = await listFeedbackForViewer(user);
  } catch (error) {
    dbUnavailable = true;
    console.error("Feedback query failed:", error);
  }

  const rated = feedback.filter((f) => f.rating !== null);
  const average = rated.length
    ? rated.reduce((sum, f) => sum + (f.rating ?? 0), 0) / rated.length
    : null;
  const low = feedback.filter((f) => f.rating !== null && f.rating <= 2).length;

  return (
    <AppShell viewer={user} mode="officer">
      {dbUnavailable && (
        <Banner variant="warning">
          Could not load feedback right now. Showing an empty list until the
          connection is restored.
        </Banner>
      )}
      <PageHeader
        title="Feedback"
        description={
          average !== null ? (
            <span className="inline-flex flex-wrap items-center gap-x-1.5">
              <Star
                className="size-4 fill-warning text-warning"
                aria-hidden="true"
              />
              {average.toFixed(1)} average from {rated.length} ratings
              {low > 0 && ` · ${low} rated 2 stars or less`}
            </span>
          ) : (
            "No ratings yet."
          )
        }
      />
      <FeedbackTable feedback={feedback} />
    </AppShell>
  );
}
