import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { http } from "../api/http";
import { useAuth } from "../auth/AuthContext";
import { ChatPanel } from "../components/chat/ChatPanel";

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
    type: string;
    status: string;
  };
  buyer: { id: string; displayName: string };
  seller: { id: string; displayName: string };
};

export function DealRoomPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [sellerConversationId, setSellerConversationId] = useState<string | null>(null);
  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadSellerConversation(dealData: Deal) {
  const res = await http.get(
    `/conversations/by-listing/${dealData.listingId}/by-buyer/${dealData.buyerId}`
  );
    setSellerConversationId(res.data.id);
  }

  async function load() {
  setErr(null);
  setLoading(true);
  try {
    const res = await http.get<Deal>(`/deals/${id}`);
    setDeal(res.data);

    // seller side: получаем conversation по listing + buyer
    if (user?.id === res.data.sellerId) {
      try {
        await loadSellerConversation(res.data);
      } catch {
        setSellerConversationId(null);
      }
    } else {
      setSellerConversationId(null);
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

  async function act(fn: () => Promise<any>) {
    setActionErr(null);
    setBusy(true);
    try {
      const res = await fn();
      setDeal(res.data);
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

  return (
    <div className="max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <div className="border rounded p-4 space-y-2">
          <div className="text-2xl font-bold">{deal.listing.title}</div>

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
            {/* buyer fund only when initiated */}
            {isBuyer && deal.status === "INITIATED" && (
              <button
                disabled={busy}
                className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
                onClick={() => act(() => http.post(`/deals/${deal.id}/fund`))}
              >
                {busy ? "Processing..." : "Fund"}
              </button>
            )}

            {/* seller delivered only when funded */}
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

            {/* buyer complete only when delivered */}
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

            {/* seller cancel (по твоей логике) */}
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
      </div>

      <div className="lg:col-span-1 space-y-6">
        <ChatPanel
          listingId={deal.listingId}
          conversationId={isSeller ? sellerConversationId : undefined}
        />
      </div>
    </div>
  );
}
