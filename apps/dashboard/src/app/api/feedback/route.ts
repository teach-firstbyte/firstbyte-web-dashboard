import { NextResponse } from "next/server";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { createFeedback } from "@/server/feedback/mutations";
import { listFeedbackForViewer } from "@/server/feedback/queries";
import { createFeedbackSchema } from "@/server/feedback/schema";
import { parseJsonBody, toErrorResponse } from "@/server/http";

/**
 * Gets the feedback the caller may read, with anonymous authors already
 * redacted.
 */
export async function GET(): Promise<NextResponse> {
  const { user, error } = await requireUserApi();
  if (error) return error;

  try {
    const feedback = await listFeedbackForViewer(user);
    return NextResponse.json(feedback, { status: 200 });
  } catch (e) {
    return toErrorResponse(e, "GET /api/feedback", "Failed to get feedback");
  }
}

/**
 * Submits feedback for a meeting. The author is the caller, never the body.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const { user, error } = await requireUserApi();
  if (error) return error;

  try {
    const input = await parseJsonBody(request, createFeedbackSchema);
    const feedback = await createFeedback(user, input);
    return NextResponse.json(feedback, { status: 201 });
  } catch (e) {
    return toErrorResponse(
      e,
      "POST /api/feedback",
      "Failed to submit feedback",
    );
  }
}
