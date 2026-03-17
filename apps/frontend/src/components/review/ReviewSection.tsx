import { useCallback, useEffect, useState } from "react";
import { http } from "../../api/http";
import { ReviewForm } from "./ReviewForm";
import { RatingStars } from "./RatingStars";
import { extractHttpErrorMessage } from "../../utils/httpError";

type Review = {
  id: string;
  rating: number;
  comment?: string;
  createdAt: string;
  buyer: {
    id: string;
    displayName: string;
  };
};

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
      <div className="border rounded p-4">
        <div className="text-sm text-gray-500">Loading review…</div>
      </div>
    );
  }

  if (review) {
    return (
      <div className="border rounded p-4 space-y-3">
        <div className="font-semibold">Your review</div>

        <div className="text-sm">
          Author: <b>{review.buyer.displayName}</b>
        </div>

        <div className="flex items-center gap-2">
          <RatingStars value={review.rating} />
          <span className="text-sm text-gray-600">{review.rating}/5</span>
        </div>

        <div className="text-sm text-gray-600">
          {new Date(review.createdAt).toLocaleString()}
        </div>

        {review.comment && (
          <div className="border rounded p-3 bg-gray-50 text-sm whitespace-pre-wrap text-black">
            {review.comment}
          </div>
        )}
      </div>
    );
  }

  return <ReviewForm dealId={dealId} onSubmitted={loadReview} />;
}