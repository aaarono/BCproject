import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { http } from "../api/http";
import { RatingStars } from "../components/review/RatingStars";
import { ProfileHeaderCard } from "../components/profile/ProfileHeaderCard";

type Listing = {
  id: string;
  title: string;
  description: string;
  price: number;
  type: "GOOD" | "SERVICE";
  status: "ACTIVE" | "ARCHIVED";
  createdAt: string;
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

type SellerProfile = {
  id: string;
  displayName: string;
  ratingAvg: number;
  ratingCount: number;
  listings: Listing[];
  reviewsReceived: Review[];
};

export function PublicSellerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    setErr(null);

    http
      .get<SellerProfile>(`/users/${id}`)
      .then((r) => setProfile(r.data))
      .catch((e) =>
        setErr(e?.response?.data?.message ?? "Failed to load seller profile"),
      )
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-6">Loading…</div>;
  if (err || !profile)
    return <div className="p-6 text-red-600">{err ?? "Seller not found"}</div>;

  return (
    <div className="max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 space-y-4">
        <ProfileHeaderCard
          displayName={profile.displayName}
          ratingAvg={profile.ratingAvg}
          ratingCount={profile.ratingCount}
        />
      </div>

      <div className="lg:col-span-2 space-y-6">
        <div className="border rounded p-4 space-y-4">
          <div className="text-xl font-semibold">Active listings</div>

          {profile.listings.length === 0 && (
            <div className="text-sm text-gray-500">No active listings.</div>
          )}

          <div className="space-y-3">
            {profile.listings.map((listing) => (
              <Link
                key={listing.id}
                to={`/listings/${listing.id}`}
                className="block border rounded p-3 hover:bg-gray-50"
              >
                <div className="flex justify-between gap-4">
                  <div>
                    <div className="font-medium">{listing.title}</div>
                    <div className="text-sm text-gray-600">
                      {listing.description}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {listing.type}
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

        <div className="border rounded p-4 space-y-4">
          <div className="text-xl font-semibold">Reviews</div>

          {profile.reviewsReceived.length === 0 && (
            <div className="text-sm text-gray-500">No reviews yet.</div>
          )}

          <div className="space-y-3">
            {profile.reviewsReceived.map((review) => (
              <div key={review.id} className="border rounded p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">{review.buyer.displayName}</div>
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
