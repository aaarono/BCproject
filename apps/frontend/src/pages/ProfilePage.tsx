import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { http } from "../api/http";
import { RatingStars } from "../components/review/RatingStars";
import { ProfileHeaderCard } from "../components/profile/ProfileHeaderCard";
import { extractHttpErrorMessage } from "../utils/httpError";

type Profile = {
  id: string;
  email: string;
  displayName: string;
  role: "BUYER" | "SELLER" | "ADMIN";
  ratingAvg: number;
  ratingCount: number;
};

type MyListing = {
  id: string;
  title: string;
  description: string;
  price: number;
  type: "GOOD" | "SERVICE";
  status: "ACTIVE" | "ARCHIVED";
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
  deal: {
    id: string;
    listing: {
      id: string;
      title: string;
    };
  };
};

export function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [myListings, setMyListings] = useState<MyListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function loadProfile() {
    const res = await http.get<Profile>("/users/me/profile");
    setProfile(res.data);
    return res.data;
  }

  async function loadReviews(userId: string) {
    const res = await http.get<Review[]>(`/reviews/seller/${userId}`);
    setReviews(res.data);
  }

  async function loadMyListings() {
    const res = await http.get<MyListing[]>("/listings/me");
    setMyListings(res.data.slice(0, 3));
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const p = await loadProfile();
        await Promise.all([loadReviews(p.id), loadMyListings()]);
      } catch (error: unknown) {
        setErr(extractHttpErrorMessage(error, "Failed to load profile"));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="p-6">Loading…</div>;
  if (err || !profile)
    return <div className="p-6 text-red-600">{err ?? "Profile not found"}</div>;

  return (
    <div className="max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 space-y-4">
        <ProfileHeaderCard
          displayName={profile.displayName}
          subtitle={profile.email}
          ratingAvg={profile.ratingAvg}
          ratingCount={profile.ratingCount}
        />
      </div>
      <div className="lg:col-span-2 space-y-6">
        <div className="border rounded p-4 space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="text-xl font-semibold">My listings</div>
            <Link className="underline text-sm" to="/my-listings">
              View all
            </Link>
          </div>

          {myListings.length === 0 && (
            <div className="text-sm text-gray-500">No listings yet.</div>
          )}

          <div className="space-y-3">
            {myListings.map((listing) => (
              <Link
                key={listing.id}
                to={`/listings/${listing.id}`}
                className="block border rounded p-3 hover:bg-gray-50"
              >
                <div className="flex justify-between gap-4">
                  <div>
                    <div className="font-medium">{listing.title}</div>
                    <div className="text-sm text-gray-600 line-clamp-2">
                      {listing.description}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {listing.type} · {listing.status}
                    </div>
                  </div>

                  <div className="font-semibold">
                    {(listing.price / 100).toFixed(2)} Kč
                  </div>
                </div>
              </Link>
            ))}
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
                  <Link
                    className="font-medium underline"
                    to={`/users/${review.buyer.id}`}
                  >
                    {review.buyer.displayName}
                  </Link>
                  <div className="flex items-center gap-2">
                    <RatingStars value={review.rating} />
                    <span className="text-sm text-gray-600">
                      {review.rating}/5
                    </span>
                  </div>
                </div>

                <div className="text-xs text-gray-500 space-y-1">
                  <div>{new Date(review.createdAt).toLocaleString()}</div>
                  <div>
                    Listing:{" "}
                    <span className="font-medium">
                      {review.deal.listing.title}
                    </span>
                  </div>
                </div>

                {review.comment && (
                  <div className="text-sm whitespace-pre-wrap">
                    {review.comment}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
