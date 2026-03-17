import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { http } from "../api/http";
import type { Listing, PriceHistoryPoint } from "../types/listing";
import { ListingDetails } from "../components/listing/ListingDetails";
import { ConversationView } from "../components/chat/ConversationView";
import { useAuth } from "../auth/AuthContext";
import { PriceHistoryChart } from "../components/listing/PriceHistoryChart";

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
    } catch (e: any) {
      console.log("BUY ERROR:", e?.response?.status, e?.response?.data);
      alert(e?.response?.data?.message ?? "Buy failed");
    } finally {
      setBuyLoading(false);
    }
  }

  if (loading) return <div className="p-6">Loading…</div>;
  if (err || !listing) {
    return <div className="p-6 text-red-600">{err ?? "Not found"}</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <ListingDetails listing={listing} />
        <div className="mt-6">
          <PriceHistoryChart points={priceHistory} />
        </div>
      </div>

      <div className="lg:col-span-1 space-y-6">
        {!user ? (
          <div className="border rounded p-4 text-sm text-gray-600">
            Please{" "}
            <Link className="underline" to="/login">
              login
            </Link>{" "}
            to contact the seller.
          </div>
        ) : isOwner ? (
          <div className="border rounded p-4 text-sm text-gray-600 space-y-2">
            <div>You are the seller of this listing.</div>
            <div>
              Manage conversations in <b>Inbox</b> and deals in <b>My deals</b>.
            </div>
          </div>
        ) : chatLoading ? (
          <div className="border rounded p-4 text-sm text-gray-500">
            Loading conversation…
          </div>
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
          <div className="border rounded p-4 text-sm text-gray-500">
            Conversation could not be loaded.
          </div>
        )}

        {!isOwner && user && (
          <button
            className="bg-black text-white rounded px-4 py-2 w-full disabled:opacity-60"
            onClick={buyNow}
            disabled={buyLoading}
          >
            {buyLoading
              ? "Processing…"
              : listing.type === "SERVICE"
              ? "Order"
              : "Buy"}
          </button>
        )}

        {isOwner && (
          <div className="text-sm text-gray-600 border rounded p-3">
            You are the seller. Manage deals from <b>My deals</b>.
          </div>
        )}
      </div>
    </div>
  );
}