"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Feedback } from "@/types/dashboard";
import { TableEmptyState } from "@/components/ui/TableEmptyState";
import { useDetailRow } from "@/hooks/useDetailRow";
import { FeedbackDetailSheet } from "./FeedbackDetailSheet";

interface FeedbackTableProps {
  feedback: Feedback[];
}

export function FeedbackTable({ feedback }: FeedbackTableProps) {
  // Rows arrive already redacted by OfficerDashboard; the panel below renders
  // straight from this prop so anonymous authors stay stripped.
  const detail = useDetailRow<Feedback>();

  const getRatingStars = (rating: number | null) => {
    if (!rating) return "N/A";
    return "★".repeat(rating) + "☆".repeat(5 - rating);
  };

  const getCategoryBadge = (category: string | null) => {
    if (!category) return <Badge variant="outline">N/A</Badge>;
    return <Badge variant="outline">{category}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Feedback</CardTitle>
        <CardDescription>User feedback for meetings</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Author</TableHead>
              <TableHead>Meeting</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Comment</TableHead>
              <TableHead>Anonymous</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {feedback.length === 0 ? (
              <TableEmptyState colSpan={7} message="No feedback yet." />
            ) : (
              feedback.map((item) => (
                <TableRow key={item.id} {...detail.getRowProps(item)}>
                  <TableCell>
                    {item.isAnonymous ? (
                      <div className="text-muted-foreground">Anonymous</div>
                    ) : (
                      <div>
                        <div className="font-medium">
                          {item.author.name || "N/A"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {item.author.email}
                        </div>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{item.meeting.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(item.meeting.scheduledAt).toLocaleString()}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-warning">
                      {getRatingStars(item.rating)}
                    </div>
                  </TableCell>
                  <TableCell>{getCategoryBadge(item.category)}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    {item.comment || "N/A"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.isAnonymous ? "secondary" : "outline"}>
                      {item.isAnonymous ? "Yes" : "No"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(item.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <FeedbackDetailSheet
          feedback={detail.selected}
          onOpenChange={detail.onOpenChange}
          onCloseAutoFocus={detail.onCloseAutoFocus}
        />
      </CardContent>
    </Card>
  );
}
