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
  const [filter, setFilter] = useState<"ACTIVE" | "ARCHIVED">("ACTIVE");
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

  async function archiveListing(id: string) {
    try {
      await http.patch(`/listings/${id}/archive`);
      setListings((prev) =>
        prev.map((listing) =>
          listing.id === id ? { ...listing, status: "ARCHIVED" } : listing
        )
      );
    } catch (e: any) {
      alert(e?.response?.data?.message ?? "Failed to archive listing");
    }
  }

  async function restoreListing(id: string) {
    try {
      await http.patch(`/listings/${id}/restore`);
      setListings((prev) =>
        prev.map((listing) =>
          listing.id === id ? { ...listing, status: "ACTIVE" } : listing
        )
      );
    } catch (e: any) {
      alert(e?.response?.data?.message ?? "Failed to restore listing");
    }
  }

  const filteredListings = listings.filter((listing) => listing.status === filter);

  if (loading) return <div className="p-6">Loading…</div>;
  if (err) return <div className="p-6 text-red-600">{err}</div>;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">My listings</h1>

        <div className="flex gap-2">
          <button
            className={`px-3 py-2 rounded border ${
              filter === "ACTIVE" ? "bg-black text-white" : ""
            }`}
            onClick={() => setFilter("ACTIVE")}
          >
            Active
          </button>

          <button
            className={`px-3 py-2 rounded border ${
              filter === "ARCHIVED" ? "bg-black text-white" : ""
            }`}
            onClick={() => setFilter("ARCHIVED")}
          >
            Archived
          </button>
        </div>
      </div>

      {filteredListings.length === 0 && (
        <div className="text-gray-600">
          {filter === "ACTIVE"
            ? "You have no active listings."
            : "You have no archived listings."}
        </div>
      )}

      <div className="space-y-3">
        {filteredListings.map((listing) => (
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

                <div className="flex flex-col items-end gap-1 text-sm">
                  <Link to={`/listings/${listing.id}`} className="underline">
                    Open listing
                  </Link>

                  {listing.status === "ACTIVE" ? (
                    <>
                      <Link to={`/listings/${listing.id}/edit`} className="underline">
                        Edit
                      </Link>

                      <button
                        className="underline text-left"
                        onClick={() => archiveListing(listing.id)}
                      >
                        Archive
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="underline text-left"
                        onClick={() => restoreListing(listing.id)}
                      >
                        Restore
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}