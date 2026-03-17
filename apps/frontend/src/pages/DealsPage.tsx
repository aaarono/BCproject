import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { http } from "../api/http";
import { useAuth } from "../auth/AuthContext";
import { extractHttpErrorMessage } from "../utils/httpError";

type Deal = {
  id: string;
  status: "INITIATED" | "FUNDED" | "DELIVERED" | "COMPLETED" | "CANCELED";
  createdAt: string;
  listing: { id: string; title: string; price: number; type: string; status: string };
  buyer: { id: string; displayName: string };
  seller: { id: string; displayName: string };
};

function StatusBadge({ status }: { status: string }) {
  const base = "text-xs px-2 py-1 rounded border";
  const map: Record<string, string> = {
    INITIATED: "bg-gray-50",
    FUNDED: "bg-gray-50",
    DELIVERED: "bg-gray-50",
    COMPLETED: "bg-gray-50",
    CANCELED: "bg-gray-50",
  };
  return <span className={`${base} ${map[status] ?? "bg-gray-50"}`}>{status}</span>;
}

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

  if (loading) return <div className="p-6">Loading…</div>;
  if (err) return <div className="p-6 text-red-600">{err}</div>;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <div className="flex items-end justify-between">
        <h1 className="text-2xl font-bold">{title}</h1>
        {user && <div className="text-xs text-gray-500">Logged in as: {user.email}</div>}
      </div>

      {deals.length === 0 && <div className="text-gray-600">No deals yet.</div>}

      <div className="space-y-3">
        {deals.map((d) => {
          const iam = user?.id === d.seller.id ? "Seller" : user?.id === d.buyer.id ? "Buyer" : null;

          return (
            <Link
              key={d.id}
              to={`/deals/${d.id}`}
              className="block border rounded p-4 hover:bg-gray-50"
            >
              <div className="flex justify-between gap-4">
                <div>
                  <div className="font-semibold">{d.listing.title}</div>
                  <div className="text-sm text-gray-600">
                    {d.listing.type} · {(d.listing.price / 100).toFixed(2)} Kč
                  </div>
                  <div className="text-sm text-gray-600">
                    Buyer: {d.buyer.displayName} · Seller: {d.seller.displayName}
                    {iam && <span className="text-xs text-gray-500"> · You are: {iam}</span>}
                  </div>
                </div>

                <div className="text-right space-y-2">
                  <StatusBadge status={d.status} />
                  <div className="text-xs text-gray-500">
                    {new Date(d.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
