import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { http } from "../api/http";
import { RatingStars } from "../components/review/RatingStars";
import { ProfileHeaderCard } from "../components/profile/ProfileHeaderCard";
import { extractHttpErrorMessage } from "../utils/httpError";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { ErrorState, LoadingState } from "../components/ui/PageStates";

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

    let cancelled = false;

    http
      .get<SellerProfile>(`/users/${id}`)
      .then((r) => {
        if (!cancelled) {
          setProfile(r.data);
          setErr(null);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setErr(extractHttpErrorMessage(error, "Failed to load seller profile"));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <LoadingState width="max-w-6xl" />;
  if (err || !profile)
    return <ErrorState width="max-w-6xl" message={err ?? "Seller not found"} />;

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-3">
      <div className="lg:col-span-1 space-y-4">
        <ProfileHeaderCard
          displayName={profile.displayName}
          ratingAvg={profile.ratingAvg}
          ratingCount={profile.ratingCount}
        />
      </div>

      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <div className="text-xl font-semibold text-slate-900">Active listings</div>
          </CardHeader>
          <CardContent className="space-y-3">
            {profile.listings.length === 0 && (
              <div className="text-sm text-slate-500">No active listings.</div>
            )}

            {profile.listings.map((listing) => (
              <Link
                key={listing.id}
                to={`/listings/${listing.id}`}
                className="block rounded-xl border border-slate-200 bg-slate-50 p-3 transition hover:border-slate-300 hover:bg-white"
              >
                <div className="flex justify-between gap-4">
                  <div>
                    <div className="font-medium text-slate-900">{listing.title}</div>
                    <div className="text-sm text-slate-600">
                      {listing.description}
                    </div>
                    <div className="mt-1">
                      <Badge variant="outline">{listing.type}</Badge>
                    </div>
                  </div>

                  <div className="font-semibold text-slate-900">
                    {(listing.price / 100).toFixed(2)} Kč
                  </div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="text-xl font-semibold text-slate-900">Reviews</div>
          </CardHeader>
          <CardContent className="space-y-3">
            {profile.reviewsReceived.length === 0 && (
              <div className="text-sm text-slate-500">No reviews yet.</div>
            )}

            {profile.reviewsReceived.map((review) => (
              <div key={review.id} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-slate-900">{review.buyer.displayName}</div>
                  <div className="flex items-center gap-2">
                    <RatingStars value={review.rating} />
                    <span className="text-sm text-slate-600">
                      {review.rating}/5
                    </span>
                  </div>
                </div>

                <div className="space-y-1 text-xs text-slate-500">
                  <div>{new Date(review.createdAt).toLocaleString()}</div>
                  <div>
                    Listing:{" "}
                    <span className="font-medium text-slate-700">
                      {review.deal.listing.title}
                    </span>
                  </div>
                </div>

                {review.comment && (
                  <div className="text-sm whitespace-pre-wrap text-slate-700">
                    {review.comment}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
