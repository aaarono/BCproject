import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Briefcase, Gamepad2, Handshake } from "lucide-react";
import { Link } from "react-router-dom";
import { http } from "../api/http";
import { useAuth } from "../auth/AuthContext";
import { extractHttpErrorMessage } from "../utils/httpError";
import { Badge } from "../components/ui/Badge";
import { Card, CardContent } from "../components/ui/Card";
import { DealStatusBadge } from "../components/profile/DealStatusBadge";
import { ErrorState, LoadingState } from "../components/ui/PageStates";
import { EmptyState } from "../components/ui/EmptyState";
import { formatUsdFromCents } from "../lib/currency";

type Deal = {
  id: string;
  status: "INITIATED" | "FUNDED" | "DELIVERED" | "COMPLETED" | "CANCELED";
  canceledByActor?: "BUYER" | "SELLER" | "SYSTEM" | null;
  createdAt: string;
  expiresAt?: string | null;
  quantity: number;
  unitPriceSnapshot: number;
  totalAmountSnapshot: number;
  listing: { id: string; title: string; price: number; type: string; status: string; imageUrl?: string | null };
  buyer: { id: string; displayName: string };
  seller: { id: string; displayName: string };
};

type DealView = "all" | "buy" | "sell";
type DealSort = "newest" | "oldest" | "price_desc" | "price_asc";

export function DealsPage() {
  const { user } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [dealView, setDealView] = useState<DealView>("all");
  const [sortBy, setSortBy] = useState<DealSort>("newest");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  function formatExpiration(expiresAt?: string | null) {
    if (!expiresAt) return null;
    return `Auto-cancel at ${new Date(expiresAt).toLocaleString()}`;
  }

  useEffect(() => {
    let cancelled = false;

    http
      .get<Deal[]>("/deals/me")
      .then((r) => {
        if (!cancelled) {
          setDeals(r.data);
          setErr(null);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setErr(extractHttpErrorMessage(error, "Failed to load deals"));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const visibleDeals = useMemo(() => {
    const filtered = deals.filter((deal) => {
      if (!user?.id) return true;
      if (dealView === "all") {
        return deal.buyer.id === user.id || deal.seller.id === user.id;
      }
      if (dealView === "buy") {
        return deal.buyer.id === user.id;
      }
      return deal.seller.id === user.id;
    });

    const sorted = [...filtered];
    sorted.sort((left, right) => {
      if (sortBy === "newest") {
        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      }

      if (sortBy === "oldest") {
        return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
      }

      if (sortBy === "price_desc") {
        return right.totalAmountSnapshot - left.totalAmountSnapshot;
      }

      return left.totalAmountSnapshot - right.totalAmountSnapshot;
    });

    return sorted;
  }, [deals, dealView, sortBy, user?.id]);

  if (loading) return <LoadingState width="max-w-5xl" />;
  if (err) return <ErrorState width="max-w-5xl" message={err} />;

  const formatAmount = (value: number) => formatUsdFromCents(value);

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid w-full grid-cols-3 gap-2 sm:max-w-[420px]">
          <button
            type="button"
            onClick={() => setDealView("all")}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              dealView === "all" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setDealView("buy")}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              dealView === "buy" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent"
            }`}
          >
            Purchases
          </button>
          <button
            type="button"
            onClick={() => setDealView("sell")}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              dealView === "sell" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent"
            }`}
          >
            Sales
          </button>
        </div>

        <select
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value as DealSort)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground sm:w-[220px]"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="price_desc">Most expensive</option>
          <option value="price_asc">Cheapest first</option>
        </select>
      </div>

      {visibleDeals.length === 0 && (
        <EmptyState
          title="No deals yet"
          description={
            dealView === "all"
              ? "Your purchases and sales will appear here once deals are created."
              : dealView === "buy"
                ? "Your purchases will appear here once you start a deal."
                : "Your sales will appear here once buyers start deals with your listings."
          }
          icon={<Handshake className="h-5 w-5" />}
        />
      )}

      <div className="space-y-3">
        {visibleDeals.map((d) => {
          const iam = user?.id === d.seller.id ? "Seller" : user?.id === d.buyer.id ? "Buyer" : null;
          const counterparty = iam === "Seller" ? d.buyer.displayName : d.seller.displayName;

          return (
            <Link key={d.id} to={`/deals/${d.id}`} className="block">
              <Card className="group transition hover:bg-accent">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted text-muted-foreground">
                      {d.listing.imageUrl ? (
                        <img src={d.listing.imageUrl} alt={d.listing.title} className="h-full w-full object-cover" />
                      ) : d.listing.type === "GOOD" ? (
                        <Gamepad2 className="h-5 w-5" />
                      ) : (
                        <Briefcase className="h-5 w-5" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="line-clamp-1 font-semibold text-foreground">{d.listing.title}</div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {d.listing.type} · {formatAmount(d.unitPriceSnapshot)} × {d.quantity}
                          </div>
                        </div>
                        <div className="shrink-0">
                          <DealStatusBadge status={d.status} />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {iam && (
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-semibold ${
                              iam === "Buyer"
                                ? "border-success/40 bg-success/15 text-success"
                                : "border-warning/40 bg-warning/15 text-warning"
                            }`}
                          >
                            You are {iam}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[10px]">
                          With {counterparty}
                        </Badge>
                        {d.status === "CANCELED" && d.canceledByActor && (
                          <Badge variant="muted" className="text-[10px]">
                            Canceled by {d.canceledByActor === "SYSTEM" ? "timeout" : d.canceledByActor.toLowerCase()}
                          </Badge>
                        )}
                        {(d.status === "INITIATED" || d.status === "FUNDED") && (
                          <Badge variant="muted" className="text-[10px]">
                            {formatExpiration(d.expiresAt)}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Updated {new Date(d.createdAt).toLocaleString()}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{formatAmount(d.totalAmountSnapshot)}</span>
                          <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:text-foreground" />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
