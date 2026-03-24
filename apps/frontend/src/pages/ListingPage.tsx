import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, MessageCircle, ShieldCheck, ShoppingBag, Star } from "lucide-react";
import { http } from "../api/http";
import type { Listing, PriceHistoryPoint } from "../types/listing";
import { ListingDetails } from "../components/listing/ListingDetails";
import { ConversationView } from "../components/chat/ConversationView";
import { useAuth } from "../auth/AuthContext";
import { PriceHistoryChart } from "../components/listing/PriceHistoryChart";
import { extractHttpErrorMessage } from "../utils/httpError";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { ErrorState, LoadingState } from "../components/ui/PageStates";
import { Badge } from "../components/ui/Badge";
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
  const [conversationId, setConversationId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [buyLoading, setBuyLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const isOwner = user?.id === listing?.seller.id;

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    setErr(null);

    http
      .get<Listing>(`/listings/${id}`)
      .then(async (r) => {
        setListing(r.data);

        try {
          const history = await http.get<{ points: PriceHistoryPoint[] }>(
            `/listings/${id}/price-history`,
          );
          setPriceHistory(history.data.points);
        } catch {
          setPriceHistory([]);
        }
      })
      .catch((e) => setErr(e?.response?.data?.message ?? "Listing not found"))
      .finally(() => setLoading(false));
  }, [id]);

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
          <PriceHistoryChart points={priceHistory} />

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
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <div>You are the seller of this listing.</div>
                <div>Manage conversations in <b>Inbox</b> and deals in <b>My deals</b>.</div>
              </CardContent>
            </Card>
          ) : chatLoading ? (
            <Card>
              <CardContent className="text-sm text-muted-foreground">Loading conversation…</CardContent>
            </Card>
          ) : conversationId ? (
            <ConversationView
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
                  type: listing.type,
                },
                buyer: {
                  id: user.id,
                  displayName: user.displayName ?? "You",
                },
                seller: {
                  id: listing.seller.id,
                  displayName: listing.seller.displayName,
                },
              }}
            />
          ) : (
            <Card>
              <CardContent className="text-sm text-muted-foreground">Conversation could not be loaded.</CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4 lg:col-span-1">
          <Card className="sticky top-20">
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Current price</div>
                <div className="text-3xl font-bold text-primary">
                  {formatUsdFromCents(unitPrice)}
                </div>
                <div className="text-xs text-muted-foreground">Per item</div>
              </div>

              {!isOwner && (
                <div className="space-y-2">
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
                  <div className="text-sm font-medium text-foreground">Total: {formatUsdFromCents(totalPrice)}</div>
                </div>
              )}

              {!isOwner && user && (
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

              <Link to="/inbox" className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-input px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent">
                <MessageCircle className="h-4 w-4" />
                Contact seller
              </Link>

              <div className="flex items-center gap-2 rounded-lg bg-success/10 p-3 text-sm text-success">
                <ShieldCheck className="h-5 w-5" />
                Protected by escrow
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="text-sm font-semibold text-foreground">Seller</div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link to={`/users/${listing.seller.id}`} className="group flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground">
                  {listing.seller.displayName.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="font-medium text-foreground transition group-hover:text-primary">{listing.seller.displayName}</div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Star className="h-3 w-3 fill-warning text-warning" />
                    {listing.seller.ratingAvg.toFixed(1)} ({listing.seller.ratingCount} reviews)
                  </div>
                </div>
              </Link>

              <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                <Badge variant="outline" className="justify-center">{listing.type}</Badge>
                <span className="flex items-center justify-center gap-1 rounded-full bg-muted px-2 py-1 text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3 text-success" />
                  Verified
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}