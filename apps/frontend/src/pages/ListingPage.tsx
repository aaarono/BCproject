import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { http } from "../api/http";
import type { Listing } from "../types/listing";
import { ListingDetails } from "../components/listing/ListingDetails";
import { ChatPanel } from "../components/chat/ChatPanel";
import { useAuth } from "../auth/AuthContext";

export function ListingPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { user } = useAuth();

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [buyLoading, setBuyLoading] = useState(false);
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

      await http.post(`/deals/${dealId}/fund`);

      nav(`/deals/${dealId}`);
    } catch (e: any) {
      console.log("BUY ERROR:", e?.response?.status, e?.response?.data);
      alert(e?.response?.data?.message ?? "Buy failed");
    } finally {
      setBuyLoading(false);
    }
  }

  if (loading) return <div className="p-6">Loading…</div>;
  if (err || !listing)
    return <div className="p-6 text-red-600">{err ?? "Not found"}</div>;

  return (
    <div className="max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <ListingDetails listing={listing} />
      </div>

      <div className="lg:col-span-1 space-y-6">
        <ChatPanel listingId={listing.id} />

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
