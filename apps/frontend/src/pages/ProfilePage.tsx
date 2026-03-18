import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { http } from "../api/http";
import { RatingStars } from "../components/review/RatingStars";
import { ProfileHeaderCard } from "../components/profile/ProfileHeaderCard";
import { extractHttpErrorMessage } from "../utils/httpError";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { ErrorState, LoadingState } from "../components/ui/PageStates";
import { PageContainer, PageHeader } from "../components/ui/PageLayout";

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
  const [activeTab, setActiveTab] = useState<"listings" | "reviews" | "achievements">("listings");
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

  if (loading) return <LoadingState width="max-w-6xl" />;
  if (err || !profile)
    return <ErrorState width="max-w-6xl" message={err ?? "Profile not found"} />;

  return (
    <PageContainer width="max-w-7xl" className="space-y-6">
      <PageHeader title="Profile" subtitle="Your seller reputation, listings, and feedback history." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-4">
          <ProfileHeaderCard
            displayName={profile.displayName}
            subtitle={profile.email}
            ratingAvg={profile.ratingAvg}
            ratingCount={profile.ratingCount}
          />
        </div>
        <div className="lg:col-span-2 space-y-6">
          <div className="grid w-full grid-cols-3 gap-2 rounded-xl border border-border bg-card p-2">
            <button
              type="button"
              onClick={() => setActiveTab("listings")}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                activeTab === "listings" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent"
              }`}
            >
              Listings
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("reviews")}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                activeTab === "reviews" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent"
              }`}
            >
              Reviews
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("achievements")}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                activeTab === "achievements" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent"
              }`}
            >
              Achievements
            </button>
          </div>

          {activeTab === "listings" && (
            <Card>
              <CardHeader className="flex items-center justify-between gap-3">
                <div className="text-xl font-semibold text-foreground">My listings</div>
                <Link className="text-sm font-medium text-foreground underline" to="/my-listings">
                  View all
                </Link>
              </CardHeader>

              <CardContent className="space-y-3">
                {myListings.length === 0 && <div className="text-sm text-muted-foreground">No listings yet.</div>}

                {myListings.map((listing) => (
                  <Link
                    key={listing.id}
                    to={`/listings/${listing.id}`}
                    className="block rounded-xl border border-border bg-muted p-3 transition hover:bg-accent"
                  >
                    <div className="flex justify-between gap-4">
                      <div>
                        <div className="font-medium text-foreground">{listing.title}</div>
                        <div className="line-clamp-2 text-sm text-muted-foreground">{listing.description}</div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline">{listing.type}</Badge>
                          <Badge variant="muted">{listing.status}</Badge>
                        </div>
                      </div>

                      <div className="font-semibold text-foreground">{(listing.price / 100).toFixed(2)} Kč</div>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          {activeTab === "reviews" && (
            <Card>
              <CardHeader>
                <div className="text-xl font-semibold text-foreground">Reviews</div>
              </CardHeader>
              <CardContent className="space-y-4">
                {reviews.length === 0 && <div className="text-sm text-muted-foreground">No reviews yet.</div>}

                {reviews.map((review) => (
                  <div key={review.id} className="space-y-2 rounded-xl border border-border bg-muted p-3">
                    <div className="flex items-center justify-between gap-3">
                      <Link className="font-medium text-foreground underline" to={`/users/${review.buyer.id}`}>
                        {review.buyer.displayName}
                      </Link>
                      <div className="flex items-center gap-2">
                        <RatingStars value={review.rating} />
                        <span className="text-sm text-muted-foreground">{review.rating}/5</span>
                      </div>
                    </div>

                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div>{new Date(review.createdAt).toLocaleString()}</div>
                      <div>
                        Listing: <span className="font-medium text-foreground">{review.deal.listing.title}</span>
                      </div>
                    </div>

                    {review.comment && <div className="text-sm whitespace-pre-wrap text-foreground">{review.comment}</div>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {activeTab === "achievements" && (
            <Card>
              <CardHeader>
                <div className="text-xl font-semibold text-foreground">Achievements</div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-xl border border-border bg-muted p-3">
                  <div className="font-medium text-foreground">Trusted Seller</div>
                  <div className="text-sm text-muted-foreground">Maintain a high rating with completed successful deals.</div>
                </div>
                <div className="rounded-xl border border-border bg-muted p-3">
                  <div className="font-medium text-foreground">Fast Responder</div>
                  <div className="text-sm text-muted-foreground">Reply quickly to conversations and keep buyer confidence high.</div>
                </div>
                <div className="rounded-xl border border-border bg-muted p-3">
                  <div className="font-medium text-foreground">Marketplace Builder</div>
                  <div className="text-sm text-muted-foreground">Create active listings and keep inventory fresh.</div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
