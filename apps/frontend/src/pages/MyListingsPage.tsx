import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Archive,
  Briefcase,
  Gamepad2,
  Pencil,
  Plus,
  RotateCcw,
  ShoppingBag,
  Star,
  Trash2,
} from "lucide-react";
import { http } from "../api/http";
import { extractHttpErrorMessage } from "../utils/httpError";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { ErrorState, LoadingState } from "../components/ui/PageStates";
import { EmptyState } from "../components/ui/EmptyState";
import { formatUsdFromCents } from "../lib/currency";

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
  const [activeTab, setActiveTab] = useState<"ACTIVE" | "ARCHIVED">("ACTIVE");
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
    if (!window.confirm("Archive this listing?")) return;

    try {
      await http.patch(`/listings/${id}/archive`);
      setListings((prev) =>
        prev.map((listing) =>
          listing.id === id ? { ...listing, status: "ARCHIVED" } : listing,
        ),
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
          listing.id === id ? { ...listing, status: "ACTIVE" } : listing,
        ),
      );
    } catch (error: unknown) {
      alert(extractHttpErrorMessage(error, "Failed to restore listing"));
    }
  }

  async function deleteListing(id: string) {
    if (!window.confirm("Delete this listing permanently?")) return;

    try {
      await http.delete(`/listings/${id}`);
      setListings((prev) => prev.filter((listing) => listing.id !== id));
    } catch (error: unknown) {
      alert(extractHttpErrorMessage(error, "Failed to delete listing"));
    }
  }

  const activeListings = listings.filter((listing) => listing.status === "ACTIVE");
  const archivedListings = listings.filter((listing) => listing.status === "ARCHIVED");
  const displayedListings = activeTab === "ACTIVE" ? activeListings : archivedListings;

  if (loading) return <LoadingState width="max-w-5xl" />;
  if (err) return <ErrorState width="max-w-5xl" message={err} />;

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6 sm:px-6">
      <Card>
        <CardHeader className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">My listings</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage your listings and track their performance.
            </p>
          </div>

          <Button asChild>
            <Link to="/create-listing">
              <Plus className="h-4 w-4" />
              New listing
            </Link>
          </Button>
        </CardHeader>
      </Card>

      <div className="grid w-full grid-cols-2 gap-2 rounded-xl border border-border bg-card p-2 sm:w-[320px]">
        <button
          type="button"
          onClick={() => setActiveTab("ACTIVE")}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
            activeTab === "ACTIVE"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent"
          }`}
        >
          Active ({activeListings.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("ARCHIVED")}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
            activeTab === "ARCHIVED"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent"
          }`}
        >
          Archived ({archivedListings.length})
        </button>
      </div>

      {displayedListings.length === 0 && activeTab === "ACTIVE" && (
        <EmptyState
          title="No active listings"
          description="Create your first listing to start selling in the marketplace."
          icon={<ShoppingBag className="h-5 w-5" />}
          actionLabel="Create listing"
          onAction={() => {
            window.location.href = "/create-listing";
          }}
        />
      )}

      {displayedListings.length === 0 && activeTab === "ARCHIVED" && (
        <Card>
          <CardContent className="py-12 text-center">
            <Archive className="mx-auto h-10 w-10 text-muted-foreground/60" />
            <h3 className="mt-4 font-semibold text-foreground">No archived listings</h3>
            <p className="mt-1 text-sm text-muted-foreground">Archived listings will appear here.</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {displayedListings.map((listing) => (
          <Card key={listing.id} className="py-0">
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground/50">
                  {listing.type === "GOOD" ? <Gamepad2 className="h-6 w-6" /> : <Briefcase className="h-6 w-6" />}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        to={`/listings/${listing.id}`}
                        className="line-clamp-1 font-medium text-foreground transition hover:text-primary"
                      >
                        {listing.title}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="outline" className="text-xs">
                          {listing.type}
                        </Badge>
                        {listing.createdAt && <span>{new Date(listing.createdAt).toLocaleDateString()}</span>}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-semibold text-foreground">{formatUsdFromCents(listing.price)}</div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Star className="h-3 w-3 fill-warning text-warning" />
                      Seller listing
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
                      <Link
                        to={`/listings/${listing.id}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-input px-2.5 py-1.5 text-foreground hover:bg-accent"
                      >
                        Open
                      </Link>

                      {listing.status === "ACTIVE" ? (
                        <>
                          <Link
                            to={`/listings/${listing.id}/edit`}
                            className="inline-flex items-center gap-1 rounded-lg border border-input px-2.5 py-1.5 text-foreground hover:bg-accent"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </Link>
                          <button
                            className="inline-flex items-center gap-1 rounded-lg border border-input px-2.5 py-1.5 text-foreground hover:bg-accent"
                            onClick={() => archiveListing(listing.id)}
                          >
                            <Archive className="h-3.5 w-3.5" />
                            Archive
                          </button>
                        </>
                      ) : (
                        <button
                          className="inline-flex items-center gap-1 rounded-lg border border-input px-2.5 py-1.5 text-foreground hover:bg-accent"
                          onClick={() => restoreListing(listing.id)}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Restore
                        </button>
                      )}

                      <button
                        className="inline-flex items-center gap-1 rounded-lg border border-destructive/30 px-2.5 py-1.5 text-destructive hover:bg-destructive/10"
                        onClick={() => deleteListing(listing.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
