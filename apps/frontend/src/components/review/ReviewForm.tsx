import { useState } from "react";
import { http } from "../../api/http";
import { extractHttpErrorMessage } from "../../utils/httpError";

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
      <div className="border rounded p-4">
        <div className="font-semibold">Review</div>
        <div className="text-sm text-green-700 mt-2">Review submitted successfully.</div>
      </div>
    );
  }

  return (
    <div className="border rounded p-4 space-y-3">
      <div className="font-semibold">Leave a review</div>

      <div>
        <label className="block text-sm mb-2">Rating</label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              className="text-2xl leading-none"
            >
              <span className={star <= rating ? "text-yellow-500" : "text-gray-300"}>
                ★
              </span>
            </button>
          ))}
        </div>
        <div className="text-sm text-gray-600 mt-1">{rating}/5</div>
      </div>

      <div>
        <label className="block text-sm mb-1">Comment</label>
        <textarea
          className="border rounded p-2 w-full min-h-[100px]"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Write your feedback..."
        />
      </div>

      {err && <div className="text-sm text-red-600">{err}</div>}

      <button
        className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
        disabled={loading}
        onClick={submitReview}
      >
        {loading ? "Submitting..." : "Submit review"}
      </button>
    </div>
  );
}