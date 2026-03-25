import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Avatar } from "../ui/Avatar";
import { RatingStars } from "./RatingStars";

export type SellerReviewItem = {
  id: string;
  rating: number;
  comment?: string;
  createdAt: string;
  buyer: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
  };
  deal: {
    id: string;
    listing: {
      id: string;
      title: string;
    };
  };
};

type SellerReviewsListProps = {
  reviews: SellerReviewItem[];
  loading?: boolean;
  emptyText?: string;
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

export function SellerReviewsList({
  reviews,
  loading = false,
  emptyText = "No reviews yet.",
}: SellerReviewsListProps) {
  const [ratingFilter, setRatingFilter] = useState<number | "all">("all");

  const { averageRating, ratingCounts, filteredReviews } = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let total = 0;

    for (const review of reviews) {
      const star = Math.min(5, Math.max(1, Math.round(review.rating))) as 1 | 2 | 3 | 4 | 5;
      counts[star] += 1;
      total += review.rating;
    }

    const average = reviews.length > 0 ? total / reviews.length : 0;
    const filtered = ratingFilter === "all"
      ? reviews
      : reviews.filter((review) => Math.round(review.rating) === ratingFilter);

    return {
      averageRating: average,
      ratingCounts: counts,
      filteredReviews: filtered,
    };
  }, [ratingFilter, reviews]);

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading reviews…</div>;
  }

  if (reviews.length === 0) {
    return <div className="text-sm text-muted-foreground">{emptyText}</div>;
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-muted/20 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs text-muted-foreground">Average rating</div>
            <div className="flex items-end gap-2">
              <div className="text-xl font-semibold text-foreground">{averageRating.toFixed(1)}</div>
              <RatingStars value={Math.round(averageRating)} size={16} />
              <div className="pb-0.5 text-[11px] text-muted-foreground">
                ({reviews.length} reviews)
              </div>
            </div>
          </div>

          <div className="inline-flex rounded-lg border border-border bg-muted p-1">
            <button
              type="button"
              onClick={() => setRatingFilter("all")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                ratingFilter === "all"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>All</span>
              <span className="ml-1 text-[11px] opacity-70">({reviews.length})</span>
            </button>
            {[5, 4, 3, 2, 1].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRatingFilter(star)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  ratingFilter === star
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>{star}★</span>
                <span className="ml-1 text-[11px] opacity-70">({ratingCounts[star as 1 | 2 | 3 | 4 | 5]})</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {filteredReviews.length === 0 && (
        <div className="text-sm text-muted-foreground">No reviews for selected stars.</div>
      )}

      {filteredReviews.map((review) => (
        <div
          key={review.id}
          className="space-y-3 rounded-xl border border-border bg-muted/30 p-3"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <Avatar
                src={review.buyer.avatarUrl}
                alt={review.buyer.displayName}
                fallback={review.buyer.displayName}
                className="h-10 w-10"
                fallbackClassName="text-sm font-semibold"
              />
              <div className="min-w-0">
                <Link
                  to={`/users/${review.buyer.id}`}
                  className="block truncate text-sm font-medium text-foreground hover:underline"
                >
                  {review.buyer.displayName}
                </Link>
                <Link
                  to={`/listings/${review.deal.listing.id}`}
                  className="mt-0.5 block truncate text-xs text-muted-foreground hover:text-foreground hover:underline"
                >
                  {review.deal.listing.title}
                </Link>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <RatingStars value={review.rating} />
              <span className="text-xs text-muted-foreground">
                {review.rating}/5
              </span>
            </div>
          </div>

          {review.comment && (
            <div className="text-sm whitespace-pre-wrap text-foreground">{review.comment}</div>
          )}

          <div className="pt-1 text-[11px] text-muted-foreground/75">
            {formatReviewDate(review.createdAt)}
          </div>
        </div>
      ))}
    </div>
  );
}
