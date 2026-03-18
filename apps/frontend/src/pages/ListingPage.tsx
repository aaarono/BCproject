import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
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

    setBuyLoading(true);

    try {
      const created = await http.post(`/deals`, { listingId: listing.id });
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

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <ListingDetails listing={listing} />
        <PriceHistoryChart points={priceHistory} />
      </div>

      <div className="space-y-6 lg:col-span-1">
        {!user ? (
          <Card>
            <CardHeader className="font-semibold text-slate-900">Chat with seller</CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              <div>
                Please{" "}
                <Link className="font-semibold underline" to="/login">
                  login
                </Link>{" "}
                to contact the seller.
              </div>
              <Button fullWidth size="lg" onClick={() => nav("/login")}>Login to continue</Button>
            </CardContent>
          </Card>
        ) : isOwner ? (
          <Card>
            <CardHeader className="font-semibold text-slate-900">Seller mode</CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-600">
              <div>You are the seller of this listing.</div>
              <div>
                Manage conversations in <b>Inbox</b> and deals in <b>My deals</b>.
              </div>
            </CardContent>
          </Card>
        ) : chatLoading ? (
          <Card>
            <CardContent className="text-sm text-slate-500">Loading conversation…</CardContent>
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
            <CardContent className="text-sm text-slate-500">Conversation could not be loaded.</CardContent>
          </Card>
        )}

        {!isOwner && user && (
          <Card>
            <CardContent className="space-y-3">
              <Button
                fullWidth
                size="lg"
                onClick={buyNow}
                disabled={buyLoading}
              >
                {buyLoading
                  ? "Processing…"
                  : listing.type === "SERVICE"
                  ? "Order"
                  : "Buy"}
              </Button>
              <div className="text-center text-xs text-slate-500">Escrow-protected checkout</div>
            </CardContent>
          </Card>
        )}

        {isOwner && (
          <Card>
            <CardContent className="text-sm text-slate-600">
              You are the seller. Manage deals from <b>My deals</b>.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}