import { useState } from "react";
import { http } from "../../api/http";
import { extractHttpErrorMessage } from "../../utils/httpError";
import { Button } from "../ui/Button";

type Props = {
  dealId: string;
  onSubmitted?: () => void;
};

export function ReviewForm({ dealId, onSubmitted }: Props) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submitReview() {
    setErr(null);
    setLoading(true);

    try {
      await http.post("/reviews", {
        dealId,
        rating,
        comment: comment.trim() || undefined,
      });

      setDone(true);
      onSubmitted?.();
    } catch (error: unknown) {
      setErr(extractHttpErrorMessage(error, "Failed to submit review"));
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="font-semibold">Review</div>
        <div className="mt-2 text-sm text-success">Review submitted successfully.</div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="font-semibold">Leave a review</div>

      <div>
        <label className="mb-2 block text-sm text-foreground">Rating</label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              className="leading-none text-2xl"
            >
              <span className={star <= rating ? "text-warning" : "text-muted-foreground/40"}>
                ★
              </span>
            </button>
          ))}
        </div>
        <div className="mt-1 text-sm text-muted-foreground">{rating}/5</div>
      </div>

      <div>
        <label className="mb-1 block text-sm text-foreground">Comment</label>
        <textarea
          className="min-h-[100px] w-full rounded-lg border border-input bg-background p-2 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Write your feedback..."
        />
      </div>

      {err && <div className="text-sm text-destructive">{err}</div>}

      <Button disabled={loading} onClick={submitReview}>
        {loading ? "Submitting..." : "Submit review"}
      </Button>
    </div>
  );
}