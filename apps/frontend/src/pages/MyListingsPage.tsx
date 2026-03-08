import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { http } from "../api/http";

type Listing = {
  id: string;
  title: string;
  description: string;
  price: number;
  type: "GOOD" | "SERVICE";
  status: "ACTIVE" | "ARCHIVED";
  createdAt?: string;
};

export function MyListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setErr(null);
    setLoading(true);

    http
      .get<Listing[]>("/listings/me")
      .then((r) => setListings(r.data))
      .catch((e) => setErr(e?.response?.data?.message ?? "Failed to load listings"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6">Loading…</div>;
  if (err) return <div className="p-6 text-red-600">{err}</div>;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">My listings</h1>

      {listings.length === 0 && (
        <div className="text-gray-600">You have no listings yet.</div>
      )}

      <div className="space-y-3">
        {listings.map((listing) => (
          <div key={listing.id} className="border rounded p-4">
            <div className="flex justify-between gap-4">
              <div>
                <div className="font-semibold">{listing.title}</div>
                <div className="text-sm text-gray-600">{listing.description}</div>
                <div className="text-sm text-gray-600 mt-1">
                  {listing.type} · {listing.status}
                </div>
              </div>

              <div className="text-right space-y-2">
                <div className="font-semibold">
                  {(listing.price / 100).toFixed(2)} Kč
                </div>
                <Link
                  to={`/listings/${listing.id}`}
                  className="text-sm underline"
                >
                  Open listing
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}