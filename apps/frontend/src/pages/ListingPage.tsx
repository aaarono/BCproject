import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import { http } from "../api/http";
import type { Listing, PriceHistoryPoint, PriceHistoryResponse, PriceHistoryStats } from "../types/listing";
import { ListingDetails } from "../components/listing/ListingDetails";
import { ConversationView } from "../components/chat/ConversationView";
import { useAuth } from "../auth/AuthContext";
import { PriceHistoryChart } from "../components/listing/PriceHistoryChart";
import { SellerReviewsList, type SellerReviewItem } from "../components/review/SellerReviewsList";
import { extractHttpErrorMessage } from "../utils/httpError";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { ErrorState, LoadingState } from "../components/ui/PageStates";
import { Input } from "../components/ui/Input";
import { formatUsdFromCents } from "../lib/currency";

type Conversation = {
  id: string;
};

export function ListingPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { user } = useAuth();

  const [listing, setListing] = useState<Listing | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryPoint[]>([]);
  const [priceHistoryStats, setPriceHistoryStats] = useState<PriceHistoryStats | null>(null);
  const [historyPeriod, setHistoryPeriod] = useState<"30d" | "all">("30d");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [sellerReviews, setSellerReviews] = useState<SellerReviewItem[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [buyLoading, setBuyLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [sellerActionLoading, setSellerActionLoading] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const isOwner = user?.id === listing?.seller.id;

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    setErr(null);

    http
      .get<Listing>(`/listings/${id}`)
      .then((r) => setListing(r.data))
      .catch((e) => setErr(e?.response?.data?.message ?? "Listing not found"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;

    setHistoryLoading(true);

    http
      .get<PriceHistoryResponse>(`/listings/${id}/price-history`, {
        params: { period: historyPeriod },
      })
      .then((history) => {
        setPriceHistory(history.data.points);
        setPriceHistoryStats(history.data.stats);
      })
      .catch(() => {
        setPriceHistory([]);
        setPriceHistoryStats(null);
      })
      .finally(() => setHistoryLoading(false));
  }, [id, historyPeriod]);

  useEffect(() => {
    if (!listing || !user) {
      setConversationId(null);
      return;
    }

    if (user.id === listing.seller.id) {
      setConversationId(null);
      return;
    }

    setChatLoading(true);

    http
      .post<Conversation>("/conversations", { listingId: listing.id })
      .then((r) => setConversationId(r.data.id))
      .catch(() => setConversationId(null))
      .finally(() => setChatLoading(false));
  }, [listing, user]);

  useEffect(() => {
    if (!listing?.seller.id) {
      setSellerReviews([]);
      return;
    }

    setReviewsLoading(true);

    http
      .get<SellerReviewItem[]>(`/reviews/seller/${listing.seller.id}`)
      .then((response) => setSellerReviews(response.data))
      .catch(() => setSellerReviews([]))
      .finally(() => setReviewsLoading(false));
  }, [listing?.seller.id]);

  async function buyNow() {
    if (!user) return nav("/login");
    if (!listing) return;

    if (user.id === listing.seller.id) {
      alert("You cannot buy your own listing");
      return;
    }

    if (listing.type === "GOOD") {
      const availableStock = listing.stockQuantity ?? 0;
      if (availableStock <= 0) {
        alert("This item is out of stock");
        return;
      }

      if (quantity > availableStock) {
        alert(`Only ${availableStock} item(s) left in stock`);
        return;
      }
    }

    setBuyLoading(true);

    try {
      const created = await http.post(`/deals`, { listingId: listing.id, quantity });
      const dealId = created.data.id;

      nav(`/deals/${dealId}`);
    } catch (error: unknown) {
      alert(extractHttpErrorMessage(error, "Buy failed"));
    } finally {
      setBuyLoading(false);
    }
  }

  async function handleSellerStatusAction() {
    if (!listing) return;

    const isArchived = listing.status === "ARCHIVED";
    const shouldProceed = window.confirm(
      isArchived ? "Restore this listing?" : "Archive this listing?",
    );
    if (!shouldProceed) return;

    setSellerActionLoading(true);

    try {
      await http.patch(
        isArchived
          ? `/listings/${listing.id}/restore`
          : `/listings/${listing.id}/archive`,
      );

      setListing((prev) =>
        prev
          ? { ...prev, status: isArchived ? "ACTIVE" : "ARCHIVED" }
          : prev,
      );
    } catch (error: unknown) {
      alert(
        extractHttpErrorMessage(
          error,
          isArchived ? "Failed to restore listing" : "Failed to archive listing",
        ),
      );
    } finally {
      setSellerActionLoading(false);
    }
  }

  if (loading) return <LoadingState width="max-w-6xl" />;
  if (err || !listing) {
    return <ErrorState width="max-w-6xl" message={err ?? "Not found"} />;
  }

  const unitPrice = listing.effectivePrice ?? listing.price;
  const availableStock = listing.type === "GOOD" ? (listing.stockQuantity ?? 0) : null;
  const totalPrice = unitPrice * quantity;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <button
        onClick={() => nav(-1)}
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to listings
      </button>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ListingDetails listing={listing} />
          <PriceHistoryChart
            points={priceHistory}
            stats={priceHistoryStats}
            period={historyPeriod}
            onPeriodChange={setHistoryPeriod}
            currentEffectivePrice={listing.effectivePrice ?? listing.price}
            currentIsSale={Boolean(listing.isOnSale)}
            currentSalePercent={listing.salePercent ?? null}
            loading={historyLoading}
          />

          <Card>
            <CardHeader className="font-semibold text-foreground">
              Seller reviews
            </CardHeader>
            <CardContent className="space-y-3">
              <SellerReviewsList reviews={sellerReviews} loading={reviewsLoading} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-1">
          <div className="sticky top-20 space-y-4">
            {!user ? (
              <Card>
                <CardHeader className="font-semibold text-foreground">Chat with seller</CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <div>
                    Please <Link className="font-semibold underline" to="/login">login</Link> to contact the seller.
                  </div>
                  <Button fullWidth size="lg" onClick={() => nav("/login")}>Login to continue</Button>
                </CardContent>
              </Card>
            ) : isOwner ? (
              <Card>
                <CardHeader className="font-semibold text-foreground">Seller mode</CardHeader>
                <CardContent className="space-y-2">
                  <Button asChild variant="outline" fullWidth>
                    <Link to={`/listings/${listing.id}/edit`}>Edit</Link>
                  </Button>
                  <Button
                    variant={listing.status === "ARCHIVED" ? "secondary" : "destructive"}
                    fullWidth
                    disabled={sellerActionLoading}
                    onClick={handleSellerStatusAction}
                  >
                    {sellerActionLoading
                      ? "Processing…"
                      : listing.status === "ARCHIVED"
                        ? "Restore"
                        : "Archive"}
                  </Button>
                  <Button asChild variant="ghost" fullWidth>
                    <Link to="/my-listings">Show All</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : chatLoading ? (
              <Card>
                <CardContent className="text-sm text-muted-foreground">Loading conversation…</CardContent>
              </Card>
            ) : conversationId ? (
              <ConversationView
                heightClassName="h-[calc(100vh-21rem)] min-h-[320px] max-h-[785px]"
                conversation={{
                  id: conversationId,
                  listingId: listing.id,
                  buyerId: user.id,
                  sellerId: listing.seller.id,
                  createdAt: listing.createdAt,
                  listing: {
                    id: listing.id,
                    title: listing.title,
                    price: listing.price,
                    salePercent: listing.salePercent,
                    saleStartsAt: listing.saleStartsAt,
                    saleEndsAt: listing.saleEndsAt,
                    type: listing.type,
                  },
                  buyer: {
                    id: user.id,
                    displayName: user.displayName ?? "You",
                    avatarUrl: user.avatarUrl,
                  },
                  seller: {
                    id: listing.seller.id,
                    displayName: listing.seller.displayName,
                    avatarUrl: listing.seller.avatarUrl,
                  },
                }}
              />
            ) : (
              <Card>
                <CardContent className="text-sm text-muted-foreground">Conversation could not be loaded.</CardContent>
              </Card>
            )}

            {!isOwner && (
              <Card>
                <CardContent className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Total</div>
                      <div className="text-3xl font-bold text-primary">
                        {formatUsdFromCents(totalPrice)}
                      </div>
                    </div>

                    <div className="w-36 space-y-2">
                      <label className="block text-xs uppercase tracking-wide text-muted-foreground">Quantity</label>
                      <Input
                        type="number"
                        min="1"
                        max={listing.type === "GOOD" ? String(Math.max(1, availableStock ?? 1)) : "1000"}
                        value={quantity}
                        onChange={(e) => {
                          const raw = Number(e.target.value);
                          if (!Number.isFinite(raw)) {
                            setQuantity(1);
                            return;
                          }

                          const maxQuantity = listing.type === "GOOD"
                            ? Math.max(1, availableStock ?? 1)
                            : 1000;
                          const clamped = Math.min(maxQuantity, Math.max(1, Math.floor(raw)));
                          setQuantity(clamped);
                        }}
                      />
                      {listing.type === "GOOD" && (
                        <div className="text-xs text-muted-foreground">{availableStock} in stock</div>
                      )}
                    </div>
                  </div>

                  {user && (
                    <Button
                      fullWidth
                      size="lg"
                      onClick={buyNow}
                      disabled={buyLoading || (listing.type === "GOOD" && (availableStock ?? 0) <= 0)}
                    >
                      <ShoppingBag className="h-4 w-4" />
                      {buyLoading
                        ? "Processing…"
                        : listing.type === "GOOD" && (availableStock ?? 0) <= 0
                          ? "Out of stock"
                          : listing.type === "SERVICE"
                            ? "Order now"
                            : "Buy now"}
                    </Button>
                  )}

                  {!user && (
                    <Button fullWidth size="lg" onClick={() => nav("/login")}>Login to buy</Button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}