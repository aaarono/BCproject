import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { http } from "../api/http";
import { extractHttpErrorMessage } from "../utils/httpError";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { ErrorState, LoadingState } from "../components/ui/PageStates";

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
    let cancelled = false;

    http
      .get<Listing[]>("/listings/me")
      .then((r) => {
        if (!cancelled) {
          setListings(r.data);
          setErr(null);
        }
      })
      .catch((error: unknown) =>
        !cancelled &&
          setErr(extractHttpErrorMessage(error, "Failed to load listings")),
      )
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function archiveListing(id: string) {
    try {
      await http.patch(`/listings/${id}/archive`);
      setListings((prev) =>
        prev.map((listing) =>
          listing.id === id ? { ...listing, status: "ARCHIVED" } : listing
        )
      );
    } catch (error: unknown) {
      alert(extractHttpErrorMessage(error, "Failed to archive listing"));
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
    } catch (error: unknown) {
      alert(extractHttpErrorMessage(error, "Failed to restore listing"));
    }
  }

  const filteredListings = listings.filter((listing) => listing.status === filter);

  if (loading) return <LoadingState width="max-w-5xl" />;
  if (err) return <ErrorState width="max-w-5xl" message={err} />;

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6 sm:px-6">
      <Card>
        <CardHeader className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">My listings</h1>

          <div className="flex gap-2">
            <Button
              variant={filter === "ACTIVE" ? "default" : "outline"}
              onClick={() => setFilter("ACTIVE")}
            >
              Active
            </Button>

            <Button
              variant={filter === "ARCHIVED" ? "default" : "outline"}
              onClick={() => setFilter("ARCHIVED")}
            >
              Archived
            </Button>
          </div>
        </CardHeader>
      </Card>

      {filteredListings.length === 0 && (
        <Card>
          <CardContent className="text-slate-600">
            {filter === "ACTIVE"
              ? "You have no active listings."
              : "You have no archived listings."}
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {filteredListings.map((listing) => (
          <Card key={listing.id}>
            <CardContent className="flex justify-between gap-4 p-4">
              <div>
                <div className="font-semibold text-slate-900">{listing.title}</div>
                <div className="text-sm text-slate-600">{listing.description}</div>
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant="outline">{listing.type}</Badge>
                  <Badge variant="muted">{listing.status}</Badge>
                </div>
              </div>

              <div className="space-y-2 text-right">
                <div className="font-semibold text-slate-900">
                  {(listing.price / 100).toFixed(2)} Kč
                </div>

                <div className="flex flex-col items-end gap-1 text-sm text-slate-600">
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
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}