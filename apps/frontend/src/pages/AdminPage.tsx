import { useEffect, useMemo, useState } from "react";
import { http } from "../api/http";
import { extractHttpErrorMessage } from "../utils/httpError";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { ErrorState, LoadingState } from "../components/ui/PageStates";
import { PageContainer, PageHeader } from "../components/ui/PageLayout";

type Overview = {
  users: number;
  listings: number;
  activeListings: number;
  deals: number;
  activeDeals: number;
  reviews: number;
};

type UserItem = {
  id: string;
  email: string;
  displayName: string;
  role: "BUYER" | "SELLER" | "ADMIN";
  ratingAvg: number;
  ratingCount: number;
  _count: {
    listings: number;
    buyerDeals: number;
    sellerDeals: number;
  };
};

type ListingItem = {
  id: string;
  title: string;
  price: number;
  status: "ACTIVE" | "ARCHIVED";
  type: "GOOD" | "SERVICE";
  category: string;
  seller: {
    id: string;
    displayName: string;
    email: string;
  };
};

type DealItem = {
  id: string;
  status: "INITIATED" | "FUNDED" | "DELIVERED" | "COMPLETED" | "CANCELED";
  canceledByActor?: "BUYER" | "SELLER" | "SYSTEM" | null;
  quantity: number;
  unitPriceSnapshot: number;
  totalAmountSnapshot: number;
  listing: { id: string; title: string };
  buyer: { id: string; displayName: string; email: string };
  seller: { id: string; displayName: string; email: string };
};

type ReviewItem = {
  id: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
  deal: { id: string; listing: { id: string; title: string } };
  buyer: { id: string; displayName: string; email: string };
  seller: { id: string; displayName: string; email: string };
};

type ListResponse<T> = {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

function formatAmount(cents: number) {
  return `${(cents / 100).toFixed(2)} Kč`;
}

export function AdminPage() {
  const [activeTab, setActiveTab] = useState<"users" | "listings" | "deals" | "reviews">("users");
  const [dealCancellationFilter, setDealCancellationFilter] = useState<"ALL" | "BUYER" | "SELLER" | "SYSTEM">("ALL");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [deals, setDeals] = useState<DealItem[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const tabClass = useMemo(
    () =>
      (tab: "users" | "listings" | "deals" | "reviews") =>
        `rounded-lg px-3 py-2 text-sm font-medium transition ${
          activeTab === tab ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent"
        }`,
    [activeTab],
  );

  async function loadAll() {
    setLoading(true);
    setErr(null);

    try {
      const normalizedQuery = query.trim();
      const queryParams = normalizedQuery ? { search: normalizedQuery, limit: 20 } : { limit: 20 };
      const dealsParams = {
        limit: 20,
        ...(dealCancellationFilter !== "ALL"
          ? { canceledByActor: dealCancellationFilter }
          : {}),
      };

      const [overviewRes, usersRes, listingsRes, dealsRes, reviewsRes] = await Promise.all([
        http.get<Overview>("/admin/overview"),
        http.get<ListResponse<UserItem>>("/admin/users", { params: queryParams }),
        http.get<ListResponse<ListingItem>>("/admin/listings", { params: queryParams }),
        http.get<ListResponse<DealItem>>("/admin/deals", { params: dealsParams }),
        http.get<ListResponse<ReviewItem>>("/admin/reviews", { params: { limit: 20 } }),
      ]);

      setOverview(overviewRes.data);
      setUsers(usersRes.data.data);
      setListings(listingsRes.data.data);
      setDeals(dealsRes.data.data);
      setReviews(reviewsRes.data.data);
    } catch (error: unknown) {
      setErr(extractHttpErrorMessage(error, "Failed to load admin data"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealCancellationFilter]);

  async function refreshByTab() {
    setBusy(true);
    setErr(null);
    setSuccess(null);

    try {
      await loadAll();
    } finally {
      setBusy(false);
    }
  }

  async function setRole(userId: string, role: UserItem["role"]) {
    setBusy(true);
    setErr(null);
    setSuccess(null);

    try {
      await http.patch(`/admin/users/${userId}/role`, { role });
      await loadAll();
      setSuccess("User role updated.");
    } catch (error: unknown) {
      setErr(extractHttpErrorMessage(error, "Failed to update role"));
    } finally {
      setBusy(false);
    }
  }

  async function moderateListing(listingId: string, action: "archive" | "restore") {
    setBusy(true);
    setErr(null);
    setSuccess(null);

    try {
      await http.patch(`/admin/listings/${listingId}/${action}`);
      await loadAll();
      setSuccess(`Listing ${action}d successfully.`);
    } catch (error: unknown) {
      setErr(extractHttpErrorMessage(error, `Failed to ${action} listing`));
    } finally {
      setBusy(false);
    }
  }

  async function removeReview(reviewId: string) {
    setBusy(true);
    setErr(null);
    setSuccess(null);

    try {
      await http.delete(`/admin/reviews/${reviewId}`);
      await loadAll();
      setSuccess("Review deleted.");
    } catch (error: unknown) {
      setErr(extractHttpErrorMessage(error, "Failed to delete review"));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingState width="max-w-7xl" />;
  if (err && !overview) return <ErrorState width="max-w-7xl" message={err} />;

  return (
    <PageContainer width="max-w-7xl" className="space-y-6">
      <PageHeader
        title="Admin"
        subtitle="Users, listings, deals and review moderation in one place."
      />

      {overview && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <Card><CardContent className="space-y-1"><div className="text-xs text-muted-foreground">Users</div><div className="text-lg font-semibold text-foreground">{overview.users}</div></CardContent></Card>
          <Card><CardContent className="space-y-1"><div className="text-xs text-muted-foreground">Listings</div><div className="text-lg font-semibold text-foreground">{overview.listings}</div></CardContent></Card>
          <Card><CardContent className="space-y-1"><div className="text-xs text-muted-foreground">Active Listings</div><div className="text-lg font-semibold text-foreground">{overview.activeListings}</div></CardContent></Card>
          <Card><CardContent className="space-y-1"><div className="text-xs text-muted-foreground">Deals</div><div className="text-lg font-semibold text-foreground">{overview.deals}</div></CardContent></Card>
          <Card><CardContent className="space-y-1"><div className="text-xs text-muted-foreground">Active Deals</div><div className="text-lg font-semibold text-foreground">{overview.activeDeals}</div></CardContent></Card>
          <Card><CardContent className="space-y-1"><div className="text-xs text-muted-foreground">Reviews</div><div className="text-lg font-semibold text-foreground">{overview.reviews}</div></CardContent></Card>
        </div>
      )}

      <Card>
        <CardHeader className="space-y-3">
          <div className="grid w-full grid-cols-2 gap-2 rounded-xl border border-border bg-card p-2 sm:w-[460px] sm:grid-cols-4">
            <button type="button" className={tabClass("users")} onClick={() => setActiveTab("users")}>Users</button>
            <button type="button" className={tabClass("listings")} onClick={() => setActiveTab("listings")}>Listings</button>
            <button type="button" className={tabClass("deals")} onClick={() => setActiveTab("deals")}>Deals</button>
            <button type="button" className={tabClass("reviews")} onClick={() => setActiveTab("reviews")}>Reviews</button>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="Search users/listings..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {activeTab === "deals" && (
              <select
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
                value={dealCancellationFilter}
                onChange={(e) =>
                  setDealCancellationFilter(
                    e.target.value as "ALL" | "BUYER" | "SELLER" | "SYSTEM",
                  )
                }
              >
                <option value="ALL">All cancellation sources</option>
                <option value="BUYER">Canceled by buyer</option>
                <option value="SELLER">Canceled by seller</option>
                <option value="SYSTEM">Canceled by timeout</option>
              </select>
            )}
            <Button type="button" variant="outline" onClick={() => loadAll().catch(() => {})} disabled={busy}>
              Reload
            </Button>
            <Button type="button" onClick={() => refreshByTab().catch(() => {})} disabled={busy}>
              {busy ? "Working..." : "Refresh"}
            </Button>
          </div>

          {err && <div className="text-sm text-destructive">{err}</div>}
          {success && <div className="text-sm text-success">{success}</div>}
        </CardHeader>

        <CardContent>
          {activeTab === "users" && (
            <div className="space-y-3">
              {users.map((user) => (
                <div key={user.id} className="rounded-xl border border-border bg-muted p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-foreground">{user.displayName}</div>
                      <div className="text-xs text-muted-foreground">{user.email}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Listings: {user._count.listings} · Buyer deals: {user._count.buyerDeals} · Seller deals: {user._count.sellerDeals}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{user.role}</Badge>
                      {(["BUYER", "SELLER", "ADMIN"] as const).map((role) => (
                        <Button
                          key={role}
                          type="button"
                          size="sm"
                          variant={user.role === role ? "default" : "outline"}
                          disabled={busy}
                          onClick={() => setRole(user.id, role)}
                        >
                          {role}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "listings" && (
            <div className="space-y-3">
              {listings.map((listing) => (
                <div key={listing.id} className="rounded-xl border border-border bg-muted p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-foreground">{listing.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {listing.seller.displayName} ({listing.seller.email})
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {listing.type} · {listing.category} · {formatAmount(listing.price)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant={listing.status === "ACTIVE" ? "default" : "muted"}>{listing.status}</Badge>
                      {listing.status === "ACTIVE" ? (
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => moderateListing(listing.id, "archive")}>
                          Archive
                        </Button>
                      ) : (
                        <Button size="sm" disabled={busy} onClick={() => moderateListing(listing.id, "restore")}>
                          Restore
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "deals" && (
            <div className="space-y-3">
              {deals.map((deal) => (
                <div key={deal.id} className="rounded-xl border border-border bg-muted p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-foreground">{deal.listing.title}</div>
                      <div className="text-xs text-muted-foreground">
                        Buyer: {deal.buyer.displayName} · Seller: {deal.seller.displayName}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {formatAmount(deal.unitPriceSnapshot)} × {deal.quantity} = {formatAmount(deal.totalAmountSnapshot)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{deal.status}</Badge>
                      {deal.status === "CANCELED" && deal.canceledByActor && (
                        <Badge variant="muted">
                          By {deal.canceledByActor === "SYSTEM" ? "timeout" : deal.canceledByActor.toLowerCase()}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "reviews" && (
            <div className="space-y-3">
              {reviews.map((review) => (
                <div key={review.id} className="rounded-xl border border-border bg-muted p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-foreground">
                        {review.deal.listing.title} · {review.rating}/5
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Buyer: {review.buyer.displayName} · Seller: {review.seller.displayName}
                      </div>
                      {review.comment && (
                        <div className="mt-1 text-sm text-foreground">{review.comment}</div>
                      )}
                    </div>
                    <Button size="sm" variant="destructive" disabled={busy} onClick={() => removeReview(review.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
