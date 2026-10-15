"use client";

import { Badge } from "@/components/ui/badge";
import { DetailSheet } from "@/components/ui/detail-sheet";
import { DetailField, DetailGrid, DetailSection } from "@/components/ui/detail";
import { formatDateTime } from "@/lib/format";
import type { Feedback } from "@/types/dashboard";

interface FeedbackDetailSheetProps {
  feedback: Feedback | null;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: (event: Event) => void;
}

export function FeedbackDetailSheet({
  feedback,
  onOpenChange,
  onCloseAutoFocus,
}: FeedbackDetailSheetProps) {
  return (
    <DetailSheet
      record={feedback}
      onOpenChange={onOpenChange}
      onCloseAutoFocus={onCloseAutoFocus}
      title={(f) => `Feedback on ${f.meeting.title}`}
      description={(f) => formatDateTime(f.createdAt) ?? "Feedback details"}
    >
      {(f) => (
        <>
          <DetailSection title="Author">
            {/* Anonymous rows arrive here with author already stripped by
                listFeedbackForViewer, server-side. Branching on isAnonymous
                rather than on the (now null) author keeps the panel honest even
                if the redaction ever changes shape. */}
            {f.isAnonymous ? (
              <p className="text-sm text-muted-foreground">
                Submitted anonymously. The author is not recorded in this view.
              </p>
            ) : (
              <DetailGrid>
                <DetailField label="Name" value={f.author.name} />
                {/* Passing null children lets DetailField apply its own empty
                    state rather than restating the placeholder here. */}
                <DetailField label="Email">
                  {f.author.email ? (
                    <a
                      href={`mailto:${f.author.email}`}
                      className="text-primary hover:underline"
                    >
                      {f.author.email}
                    </a>
                  ) : null}
                </DetailField>
              </DetailGrid>
            )}
          </DetailSection>

          <DetailSection title="Response">
            <DetailGrid>
              <DetailField label="Rating">
                {f.rating === null ? null : (
                  <span>
                    <span className="text-warning">
                      {"★".repeat(f.rating)}
                      {"☆".repeat(5 - f.rating)}
                    </span>{" "}
                    <span className="text-muted-foreground">
                      ({f.rating} of 5)
                    </span>
                  </span>
                )}
              </DetailField>
              <DetailField label="Category">
                {f.category ? (
                  <Badge variant="outline">{f.category}</Badge>
                ) : null}
              </DetailField>
              <DetailField
                label="Comment"
                value={f.comment}
                className="sm:col-span-2"
              />
              <DetailField label="Feedback ID" value={f.id} />
              <DetailField
                label="Submitted"
                value={formatDateTime(f.createdAt)}
              />
            </DetailGrid>
          </DetailSection>

          <DetailSection title="Meeting">
            <DetailGrid>
              <DetailField label="Title" value={f.meeting.title} />
              <DetailField
                label="Scheduled"
                value={formatDateTime(f.meeting.scheduledAt)}
              />
              <DetailField label="Meeting ID" value={f.meetingId} />
            </DetailGrid>
          </DetailSection>
        </>
      )}
    </DetailSheet>
  );
}
