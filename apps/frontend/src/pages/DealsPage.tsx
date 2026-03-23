import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Briefcase, Gamepad2, Handshake } from "lucide-react";
import { Link } from "react-router-dom";
import { http } from "../api/http";
import { useAuth } from "../auth/AuthContext";
import { extractHttpErrorMessage } from "../utils/httpError";
import { Badge } from "../components/ui/Badge";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { DealStatusBadge } from "../components/profile/DealStatusBadge";
import { ErrorState, LoadingState } from "../components/ui/PageStates";
import { EmptyState } from "../components/ui/EmptyState";

type Deal = {
  id: string;
  status: "INITIATED" | "FUNDED" | "DELIVERED" | "COMPLETED" | "CANCELED";
  canceledByActor?: "BUYER" | "SELLER" | "SYSTEM" | null;
  createdAt: string;
  expiresAt?: string | null;
  quantity: number;
  unitPriceSnapshot: number;
  totalAmountSnapshot: number;
  listing: { id: string; title: string; price: number; type: string; status: string };
  buyer: { id: string; displayName: string };
  seller: { id: string; displayName: string };
};

export function DealsPage() {
  const { user } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  function formatExpiration(expiresAt?: string | null) {
    if (!expiresAt) return null;
    return `Auto-cancel at ${new Date(expiresAt).toLocaleString()}`;
  }

  const title = useMemo(() => {
    if (!user) return "My deals";
    return user.role === "SELLER" ? "My sales (deals)" : "My purchases (deals)";
  }, [user]);

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

  if (loading) return <LoadingState width="max-w-5xl" />;
  if (err) return <ErrorState width="max-w-5xl" message={err} />;

  const formatAmount = (value: number) => `${(value / 100).toFixed(2)} Kč`;

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6 sm:px-6">
      <Card>
        <CardHeader className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          <div className="text-sm text-muted-foreground">Track escrow status and take required actions in each deal room.</div>
          {user && <div className="text-xs text-muted-foreground">Logged in as: {user.email}</div>}
        </CardHeader>
      </Card>

      {deals.length === 0 && (
        <EmptyState
          title="No deals yet"
          description="Your escrow-protected purchases and sales will appear here once a listing starts a deal."
          icon={<Handshake className="h-5 w-5" />}
        />
      )}

      <div className="space-y-3">
        {deals.map((d) => {
          const iam = user?.id === d.seller.id ? "Seller" : user?.id === d.buyer.id ? "Buyer" : null;
          const counterparty = iam === "Seller" ? d.buyer.displayName : d.seller.displayName;

          return (
            <Link key={d.id} to={`/deals/${d.id}`} className="block">
              <Card className="group transition hover:bg-accent">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      {d.listing.type === "GOOD" ? <Gamepad2 className="h-5 w-5" /> : <Briefcase className="h-5 w-5" />}
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
                          <Badge variant="outline" className="text-[10px]">
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
