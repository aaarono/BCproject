import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { http } from "../api/http";
import { RatingStars } from "../components/review/RatingStars";

type Profile = {
  id: string;
  email: string;
  displayName: string;
  role: "BUYER" | "SELLER" | "ADMIN";
  ratingAvg: number;
  ratingCount: number;
};

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

export function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function loadProfile() {
    const res = await http.get<Profile>("/auth/users/me/profile");
    setProfile(res.data);
    return res.data;
  }

  async function loadReviews(userId: string) {
    const res = await http.get<Review[]>(`/reviews/seller/${userId}`);
    setReviews(res.data);
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const p = await loadProfile();
        await loadReviews(p.id);
      } catch (e: any) {
        setErr(e?.response?.data?.message ?? "Failed to load profile");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="p-6">Loading…</div>;
  if (err || !profile) return <div className="p-6 text-red-600">{err ?? "Profile not found"}</div>;

  return (
    <div className="max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 space-y-4">
        <div className="border rounded p-4 space-y-3">
          <div className="text-2xl font-bold">{profile.displayName}</div>

          <div className="text-sm text-gray-600">{profile.email}</div>
          <div className="text-sm text-gray-600">Role: {profile.role}</div>

          <div className="pt-2 border-t">
            <div className="text-sm mb-1">Seller rating</div>
            <div className="flex items-center gap-2">
              <RatingStars value={Math.round(profile.ratingAvg)} />
              <span className="text-sm text-gray-600">
                {profile.ratingAvg.toFixed(2)} ({profile.ratingCount})
              </span>
            </div>
          </div>
        </div>

        <div className="border rounded p-4 space-y-2">
          <div className="font-semibold">Quick actions</div>
          <div className="flex flex-col gap-2 text-sm">
            <Link className="underline" to="/deals">My deals</Link>
            <Link className="underline" to="/wallet">Wallet</Link>
            <Link className="underline" to="/my-listings">My listings</Link>
            <Link className="underline" to="/settings">Settings</Link>
          </div>
        </div>
      </div>

      <div className="lg:col-span-2">
        <div className="border rounded p-4 space-y-4">
          <div className="text-xl font-semibold">Reviews</div>

          {reviews.length === 0 && (
            <div className="text-sm text-gray-500">No reviews yet.</div>
          )}

          {reviews.map((review) => (
            <div key={review.id} className="border rounded p-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium">{review.buyer.displayName}</div>
                <div className="flex items-center gap-2">
                  <RatingStars value={review.rating} />
                  <span className="text-sm text-gray-600">{review.rating}/5</span>
                </div>
              </div>

              <div className="text-xs text-gray-500">
                {new Date(review.createdAt).toLocaleString()}
              </div>

              {review.comment && (
                <div className="text-sm whitespace-pre-wrap">{review.comment}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}