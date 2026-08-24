import { NextResponse } from "next/server";
import { requireOfficerApi } from "@/lib/auth/requireOfficerApi";
import { deleteFeedback, updateFeedback } from "@/server/feedback/mutations";
import { getFeedbackForViewer } from "@/server/feedback/queries";
import { updateFeedbackSchema } from "@/server/feedback/schema";
import { parseJsonBody, toErrorResponse } from "@/server/http";
import { requireId } from "@/server/validation";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Gets a single feedback record by id, redacted for the caller.
 */
export async function GET(request: Request, { params }: RouteContext) {
  const { user, error } = await requireOfficerApi();
  if (error) return error;

  try {
    const { id } = await params;
    const feedback = await getFeedbackForViewer(
      user,
      requireId(id, "feedback"),
    );
    return NextResponse.json(feedback, { status: 200 });
  } catch (e) {
    return toErrorResponse(
      e,
      "GET /api/feedback/[id]",
      "Failed to get feedback",
    );
  }
}

/**
 * Updates a feedback record's rating, comment, category, and/or anonymity.
 */
export async function PUT(request: Request, { params }: RouteContext) {
  const { error } = await requireOfficerApi();
  if (error) return error;

  try {
    const { id } = await params;
    const input = await parseJsonBody(request, updateFeedbackSchema);
    const updated = await updateFeedback(requireId(id, "feedback"), input);
    return NextResponse.json(updated, { status: 200 });
  } catch (e) {
    return toErrorResponse(
      e,
      "PUT /api/feedback/[id]",
      "Failed to update feedback",
    );
  }
}

/**
 * Deletes a feedback record by id.
 */
export async function DELETE(request: Request, { params }: RouteContext) {
  const { error } = await requireOfficerApi();
  if (error) return error;

  try {
    const { id } = await params;
    const feedback = await deleteFeedback(requireId(id, "feedback"));
    return NextResponse.json(
      { message: "Feedback deleted successfully", feedback },
      { status: 200 },
    );
  } catch (e) {
    return toErrorResponse(
      e,
      "DELETE /api/feedback/[id]",
      "Failed to delete feedback",
    );
  }
}
