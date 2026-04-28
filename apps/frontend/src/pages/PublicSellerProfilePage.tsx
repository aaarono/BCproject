import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { http } from "../api/http";
import { Briefcase, Calendar, CheckCircle2, Flag, Gamepad2, ShoppingBag, Star } from "lucide-react";
import { SellerReviewsList, type SellerReviewItem } from "../components/review/SellerReviewsList";
import { extractHttpErrorMessage } from "../utils/httpError";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { ErrorState, LoadingState } from "../components/ui/PageStates";
import { Button } from "../components/ui/Button";
import { Avatar } from "../components/ui/Avatar";
import { formatUsdFromCents } from "../lib/currency";
import { getSocket } from "../api/socket";
import { useAuth } from "../auth/AuthContext";

type Listing = {
  id: string;
  title: string;
  description: string;
  price: number;
  imageUrl?: string | null;
  salePercent?: number | null;
  saleStartsAt?: string | null;
  saleEndsAt?: string | null;
  type: "GOOD" | "SERVICE";
  status: "ACTIVE" | "ARCHIVED";
  createdAt: string;
};

function getSaleState(listing: {
  price: number;
  salePercent?: number | null;
  saleStartsAt?: string | null;
  saleEndsAt?: string | null;
}) {
  if (!listing.salePercent || !listing.saleStartsAt || !listing.saleEndsAt) {
    return { isOnSale: false, effectivePrice: listing.price };
  }

  const now = Date.now();
  const startsAt = new Date(listing.saleStartsAt).getTime();
  const endsAt = new Date(listing.saleEndsAt).getTime();

  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || now < startsAt || now > endsAt) {
    return { isOnSale: false, effectivePrice: listing.price };
  }

  const effectivePrice = Math.round((listing.price * (100 - listing.salePercent)) / 100);
  return { isOnSale: effectivePrice < listing.price, effectivePrice };
}

type SellerProfile = {
  id: string;
  createdAt: string;
  displayName: string;
  avatarUrl?: string | null;
  ratingAvg: number;
  ratingCount: number;
  profileBadges?: Array<{
    code: string;
    title: string;
  }>;
  activeBadge?: {
    code: string;
    title: string;
  } | null;
  listings: Listing[];
  reviewsReceived: SellerReviewItem[];
  achievements: Achievement[];
};

type Achievement = {
  code: string;
  title: string;
  description: string;
  unlockedAt: string;
};

export function PublicSellerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [activeTab, setActiveTab] = useState<"listings" | "reviews" | "achievements">("listings");
  const [brokenListingImages, setBrokenListingImages] = useState<Set<string>>(new Set());
  const [isOnline, setIsOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    if (user?.id === id) {
      nav("/profile", { replace: true });
      return;
    }

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
  }, [id, nav, user?.id]);

  useEffect(() => {
    if (!profile?.id) return;

    const socket = getSocket();
    const targetUserId = profile.id;

    const handlePresenceUpdate = (payload: { userId: string; isOnline: boolean }) => {
      if (payload.userId === targetUserId) {
        setIsOnline(payload.isOnline);
      }
    };

    socket.emit(
      "presence:check",
      { userId: targetUserId },
      (response: { userId: string; isOnline: boolean }) => {
        if (response?.userId === targetUserId) {
          setIsOnline(response.isOnline);
        }
      },
    );

    socket.on("presence:update", handlePresenceUpdate);

    return () => {
      socket.off("presence:update", handlePresenceUpdate);
    };
  }, [profile?.id]);

  if (loading) return <LoadingState width="max-w-6xl" />;
  if (err || !profile)
    return <ErrorState width="max-w-6xl" message={err ?? "Seller not found"} />;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            <div className="relative">
              <Avatar
                src={profile.avatarUrl ?? undefined}
                alt={profile.displayName}
                fallback={profile.displayName.slice(0, 2).toUpperCase()}
                className="h-24 w-24 sm:h-28 sm:w-28"
                fallbackClassName="text-2xl font-bold"
              />
              <span
                className={`absolute bottom-1 right-1 h-5 w-5 rounded-full border-4 border-card ${
                  isOnline ? "bg-online" : "bg-muted-foreground"
                }`}
              />
            </div>

            <div className="flex-1 text-center sm:text-left">
              <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-foreground">{profile.displayName}</h1>
                  <p className="text-muted-foreground">Seller profile</p>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Flag className="h-4 w-4" />
                    Report
                  </Button>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap justify-center gap-6 text-sm sm:justify-start">
                {(profile.profileBadges ?? []).map((badge) => (
                  <div key={badge.code} className="flex items-center gap-2 text-muted-foreground">
                    <Badge variant="outline">{badge.title}</Badge>
                  </div>
                ))}

                <div className="flex items-center gap-2">
                  <Star className="h-5 w-5 fill-warning text-warning" />
                  <span className="text-lg font-semibold text-foreground">{profile.ratingAvg.toFixed(1)}</span>
                  <span className="text-muted-foreground">({profile.ratingCount} reviews)</span>
                </div>

                <div className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  <span>
                    <strong className="text-foreground">{profile.reviewsReceived.length}</strong> completed deals
                  </span>
                </div>

                <div className="flex items-center gap-2 text-muted-foreground">
                  <ShoppingBag className="h-5 w-5" />
                  <span>
                    <strong className="text-foreground">{profile.listings.length}</strong> active listings
                  </span>
                </div>

                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-5 w-5" />
                  <span>Member since {new Date(profile.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid w-full grid-cols-3 gap-2 rounded-xl border border-border bg-card p-2 sm:w-[480px]">
        <button
          type="button"
          onClick={() => setActiveTab("listings")}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
            activeTab === "listings" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent"
          }`}
        >
          Listings ({profile.listings.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("reviews")}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
            activeTab === "reviews" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent"
          }`}
        >
          Reviews ({profile.reviewsReceived.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("achievements")}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
            activeTab === "achievements" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent"
          }`}
        >
          Achievements ({profile.achievements.length})
        </button>
      </div>

      <div className="space-y-6">
        {activeTab === "listings" && (
          <Card>
            <CardHeader>
              <div className="text-xl font-semibold text-foreground">Active listings</div>
            </CardHeader>
            <CardContent className="space-y-3">
              {profile.listings.length === 0 && (
                <div className="text-sm text-muted-foreground">No active listings.</div>
              )}

              {profile.listings.map((listing) => {
                const { isOnSale, effectivePrice } = getSaleState(listing);

                return (
                <Link
                  key={listing.id}
                  to={`/listings/${listing.id}`}
                  className="block rounded-xl border border-border bg-muted p-3 transition hover:bg-accent"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-card text-muted-foreground/60">
                        {listing.imageUrl && !brokenListingImages.has(listing.id) ? (
                          <img
                            src={listing.imageUrl}
                            alt={listing.title}
                            className="h-full w-full rounded-lg object-cover"
                            loading="lazy"
                            onError={() =>
                              setBrokenListingImages((prev) => {
                                const next = new Set(prev);
                                next.add(listing.id);
                                return next;
                              })
                            }
                          />
                        ) : listing.type === "GOOD" ? (
                          <Gamepad2 className="h-5 w-5" />
                        ) : (
                          <Briefcase className="h-5 w-5" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="font-medium text-foreground">{listing.title}</div>
                        <div className="line-clamp-2 text-sm text-muted-foreground">{listing.description}</div>
                        <div className="mt-1 flex items-center gap-2">
                          <Badge variant="outline">{listing.type}</Badge>
                          {isOnSale && listing.salePercent ? (
                            <Badge className="bg-sale text-sale-foreground">-{listing.salePercent}%</Badge>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      {isOnSale ? (
                        <>
                          <div className="text-xs text-muted-foreground line-through">{formatUsdFromCents(listing.price)}</div>
                          <div className="font-semibold text-primary">{formatUsdFromCents(effectivePrice)}</div>
                        </>
                      ) : (
                        <div className="font-semibold text-foreground">{formatUsdFromCents(listing.price)}</div>
                      )}
                    </div>
                  </div>
                </Link>
                );
              })}
            </CardContent>
          </Card>
        )}

        {activeTab === "reviews" && (
          <Card>
            <CardHeader>
              <div className="text-xl font-semibold text-foreground">Reviews</div>
            </CardHeader>
            <CardContent className="space-y-3">
              <SellerReviewsList reviews={profile.reviewsReceived} />
            </CardContent>
          </Card>
        )}

        {activeTab === "achievements" && (
          <Card>
            <CardHeader>
              <div className="text-xl font-semibold text-foreground">Achievements</div>
            </CardHeader>
            <CardContent className="space-y-3">
              {profile.achievements.length === 0 && (
                <div className="text-sm text-muted-foreground">No achievements unlocked yet.</div>
              )}

              {profile.achievements.map((achievement) => (
                <div key={achievement.code} className="rounded-xl border border-border bg-muted p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-foreground">{achievement.title}</div>
                    <Badge variant="outline">{achievement.code}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">{achievement.description}</div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Unlocked: {new Date(achievement.unlockedAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
