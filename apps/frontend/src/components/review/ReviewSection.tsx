import { useCallback, useEffect, useState } from "react";
import { http } from "../../api/http";
import { ReviewForm } from "./ReviewForm";
import { RatingStars } from "./RatingStars";
import { extractHttpErrorMessage } from "../../utils/httpError";
import { Avatar } from "../ui/Avatar";
import { Card, CardContent, CardHeader } from "../ui/Card";

type Review = {
  id: string;
  rating: number;
  comment?: string;
  createdAt: string;
  buyer: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
  };
};

function formatReviewDate(dateValue: string) {
  const date = new Date(dateValue);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}.${month}.${year}, ${hours}.${minutes}`;
}

export function ReviewSection({ dealId }: { dealId: string }) {
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);

  const loadReview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await http.get<Review>(`/reviews/deal/${dealId}`);
      setReview(res.data);
    } catch (error: unknown) {
      if (
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        (error as { response?: { status?: number } }).response?.status === 404
      ) {
        setReview(null);
      } else {
        throw new Error(extractHttpErrorMessage(error, "Failed to load review"));
      }
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => {
    loadReview();
  }, [dealId, loadReview]);

  if (loading) {
    return (
      <Card>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading review…</div>
        </CardContent>
      </Card>
    );
  }

  if (review) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="text-sm font-semibold text-foreground">Your review</div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <Avatar
                src={review.buyer.avatarUrl}
                alt={review.buyer.displayName}
                fallback={review.buyer.displayName}
                className="h-10 w-10"
                fallbackClassName="text-sm font-semibold"
              />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-foreground">{review.buyer.displayName}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">{formatReviewDate(review.createdAt)}</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <RatingStars value={review.rating} />
              <span className="text-xs text-muted-foreground">{review.rating}/5</span>
            </div>
          </div>

          {review.comment && (
            <div className="whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-3 text-sm text-foreground">
              {review.comment}
            </div>
          )}

          {!review.comment && (
            <div className="text-sm text-muted-foreground">No comment provided.</div>
          )}
        </CardContent>
      </Card>
    );
  }

  return <ReviewForm dealId={dealId} onSubmitted={loadReview} />;
}