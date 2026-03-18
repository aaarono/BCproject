import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Briefcase, Gamepad2 } from "lucide-react";
import { Link } from "react-router-dom";
import { http } from "../api/http";
import { useAuth } from "../auth/AuthContext";
import { extractHttpErrorMessage } from "../utils/httpError";
import { Badge } from "../components/ui/Badge";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { DealStatusBadge } from "../components/profile/DealStatusBadge";
import { ErrorState, LoadingState } from "../components/ui/PageStates";

type Deal = {
  id: string;
  status: "INITIATED" | "FUNDED" | "DELIVERED" | "COMPLETED" | "CANCELED";
  createdAt: string;
  listing: { id: string; title: string; price: number; type: string; status: string };
  buyer: { id: string; displayName: string };
  seller: { id: string; displayName: string };
};

export function DealsPage() {
  const { user } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          <div className="text-sm text-slate-500">Track escrow status and take required actions in each deal room.</div>
          {user && <div className="text-xs text-slate-400">Logged in as: {user.email}</div>}
        </CardHeader>
      </Card>

      {deals.length === 0 && (
        <Card>
          <CardContent className="text-slate-600">No deals yet.</CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {deals.map((d) => {
          const iam = user?.id === d.seller.id ? "Seller" : user?.id === d.buyer.id ? "Buyer" : null;
          const counterparty = iam === "Seller" ? d.buyer.displayName : d.seller.displayName;

          return (
            <Link key={d.id} to={`/deals/${d.id}`} className="block">
              <Card className="group transition hover:border-slate-300 hover:shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                      {d.listing.type === "GOOD" ? <Gamepad2 className="h-5 w-5" /> : <Briefcase className="h-5 w-5" />}
                    </div>

                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="line-clamp-1 font-semibold text-slate-900">{d.listing.title}</div>
                          <div className="mt-1 text-sm text-slate-600">
                            {d.listing.type} · {formatAmount(d.listing.price)}
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
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Updated {new Date(d.createdAt).toLocaleString()}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">{formatAmount(d.listing.price)}</span>
                          <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:text-slate-700" />
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
