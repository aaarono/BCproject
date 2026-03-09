import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { http } from "../api/http";
import { getSocket } from "../api/socket";
import { useAuth } from "../auth/AuthContext";
import { ConversationView } from "../components/chat/ConversationView";
import { ReviewSection } from "../components/review/ReviewSection";

type Deal = {
  id: string;
  status: "INITIATED" | "FUNDED" | "DELIVERED" | "COMPLETED" | "CANCELED";
  createdAt: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  listing: {
    id: string;
    title: string;
    price: number;
    type: "GOOD" | "SERVICE";
    status: string;
  };
  buyer: { id: string; displayName: string };
  seller: { id: string; displayName: string };
};

export function DealRoomPage() {
  const { id } = useParams<{ id: string }>();
  const { user, token } = useAuth();

  const [sellerConversationId, setSellerConversationId] = useState<
    string | null
  >(null);
  const [buyerConversationId, setBuyerConversationId] = useState<string | null>(
    null,
  );

  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadSellerConversation(dealData: Deal) {
    const res = await http.get(
      `/conversations/by-listing/${dealData.listingId}/by-buyer/${dealData.buyerId}`,
    );
    setSellerConversationId(res.data.id);
  }

  async function loadBuyerConversation(dealData: Deal) {
    const res = await http.post(`/conversations`, {
      listingId: dealData.listingId,
    });
    setBuyerConversationId(res.data.id);
  }

  async function load() {
    setErr(null);
    setLoading(true);

    try {
      const res = await http.get<Deal>(`/deals/${id}`);
      setDeal(res.data);

      if (user?.id === res.data.sellerId) {
        setBuyerConversationId(null);
        try {
          await loadSellerConversation(res.data);
        } catch {
          setSellerConversationId(null);
        }
      } else if (user?.id === res.data.buyerId) {
        setSellerConversationId(null);
        try {
          await loadBuyerConversation(res.data);
        } catch {
          setBuyerConversationId(null);
        }
      } else {
        setSellerConversationId(null);
        setBuyerConversationId(null);
      }
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? "Failed to load deal");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!id || !user) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id]);

  useEffect(() => {
    if (!token || !deal) return;

    const socket = getSocket(token);

    const handleDealUpdate = (updatedDeal: Deal) => {
      if (updatedDeal.id !== deal.id) return;
      setDeal(updatedDeal);
    };

    socket.on("deal:update", handleDealUpdate);

    return () => {
      socket.off("deal:update", handleDealUpdate);
    };
  }, [token, deal?.id]);

  async function act(fn: () => Promise<any>) {
    setActionErr(null);
    setBusy(true);

    try {
      await fn();
      await load();
    } catch (e: any) {
      setActionErr(e?.response?.data?.message ?? "Action failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="p-6">Loading…</div>;
  if (err || !deal)
    return <div className="p-6 text-red-600">{err ?? "Not found"}</div>;

  const isBuyer = user?.id === deal.buyerId;
  const isSeller = user?.id === deal.sellerId;
  const conversationId = isSeller ? sellerConversationId : buyerConversationId;

  return (
    <div className="max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <div className="border rounded p-4 space-y-2">
          <div className="text-2xl font-bold">
            {deal.listing.title ?? "Listing"}
          </div>

          <div className="text-sm text-gray-600">
            {(deal.listing.price / 100).toFixed(2)} Kč · {deal.listing.type}
          </div>

          <div className="text-sm">
            Deal status: <b>{deal.status}</b>
          </div>

          <div className="text-xs text-gray-500">
            Buyer: {deal.buyer.displayName} · Seller: {deal.seller.displayName}
          </div>
        </div>

        <div className="border rounded p-4 space-y-3">
          <div className="font-semibold">Actions</div>

          <div className="flex flex-wrap gap-2">
            {isBuyer && deal.status === "INITIATED" && (
              <button
                disabled={busy}
                className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
                onClick={() => act(() => http.post(`/deals/${deal.id}/fund`))}
              >
                {busy ? "Processing..." : "Fund"}
              </button>
            )}

            {isSeller && deal.status === "FUNDED" && (
              <button
                disabled={busy}
                className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
                onClick={() =>
                  act(() => http.post(`/deals/${deal.id}/delivered`))
                }
              >
                {busy ? "Processing..." : "Mark delivered"}
              </button>
            )}

            {isBuyer && deal.status === "DELIVERED" && (
              <button
                disabled={busy}
                className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
                onClick={() =>
                  act(() => http.post(`/deals/${deal.id}/complete`))
                }
              >
                {busy ? "Processing..." : "Complete"}
              </button>
            )}

            {isSeller &&
              (deal.status === "INITIATED" || deal.status === "FUNDED") && (
                <button
                  disabled={busy}
                  className="border rounded px-4 py-2 disabled:opacity-50"
                  onClick={() =>
                    act(() => http.post(`/deals/${deal.id}/cancel`))
                  }
                >
                  {busy ? "Processing..." : "Cancel (refund)"}
                </button>
              )}
          </div>

          <div className="text-xs text-gray-500 mt-2">
            {deal.status === "INITIATED" && "Waiting for payment"}
            {deal.status === "FUNDED" && "Seller is preparing delivery"}
            {deal.status === "DELIVERED" && "Waiting for buyer confirmation"}
            {deal.status === "COMPLETED" && "Deal completed"}
            {deal.status === "CANCELED" && "Deal canceled"}
          </div>

          {actionErr && <div className="text-sm text-red-600">{actionErr}</div>}
        </div>

        {isBuyer && deal.status === "COMPLETED" && (
          <ReviewSection dealId={deal.id} />
        )}
      </div>

      <div className="lg:col-span-1 space-y-6">
        {conversationId ? (
          <ConversationView
            conversation={{
              id: conversationId,
              listingId: deal.listingId,
              buyerId: deal.buyerId,
              sellerId: deal.sellerId,
              createdAt: deal.createdAt,
              listing: {
                id: deal.listing.id,
                title: deal.listing.title,
                price: deal.listing.price,
                type: deal.listing.type,
              },
              buyer: deal.buyer,
              seller: deal.seller,
            }}
          />
        ) : (
          <div className="border rounded p-4 text-sm text-gray-500">
            Conversation not found yet.
          </div>
        )}
      </div>
    </div>
  );
}
