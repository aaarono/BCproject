import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { http } from "../api/http";
import { extractHttpErrorMessage } from "../utils/httpError";

type TopSeller = {
  id: string;
  displayName: string;
  ratingAvg: number;
  ratingCount: number;
  completedDeals: number;
  activeListings: number;
  score: number;
};

export function TopSellersPage() {
  const [overallItems, setOverallItems] = useState<TopSeller[]>([]);
  const [weeklyItems, setWeeklyItems] = useState<TopSeller[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise
      .all([
        http.get<TopSeller[]>("/users/top-sellers"),
        http.get<TopSeller[]>("/users/top-sellers/weekly"),
      ])
      .then(([overall, weekly]) => {
        if (!cancelled) {
          setOverallItems(overall.data);
          setWeeklyItems(weekly.data);
          setErr(null);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setErr(extractHttpErrorMessage(error, "Failed to load top sellers"));
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

  if (loading) return <div className="max-w-4xl mx-auto p-6">Loading…</div>;
  if (err) return <div className="max-w-4xl mx-auto p-6 text-red-600">{err}</div>;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Top Sellers</h1>
      <p className="text-sm text-gray-600">
        Ranking based on rating quality and completed deal activity.
      </p>

      {overallItems.length === 0 && weeklyItems.length === 0 && (
        <div className="border rounded p-4 text-sm text-gray-600">
          Not enough seller activity yet.
        </div>
      )}

      <div className="space-y-6">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Overall</h2>
          {overallItems.map((seller, index) => (
            <Link
              key={seller.id}
              to={`/users/${seller.id}`}
              className="block border rounded p-4 hover:bg-gray-50"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm text-gray-500">#{index + 1}</div>
                  <div className="font-semibold">{seller.displayName}</div>
                  <div className="text-sm text-gray-600">
                    ⭐ {seller.ratingAvg.toFixed(2)} ({seller.ratingCount} reviews)
                  </div>
                </div>

                <div className="text-right text-sm text-gray-700">
                  <div>Completed deals: {seller.completedDeals}</div>
                  <div>Active listings: {seller.activeListings}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Weekly</h2>
          {weeklyItems.length === 0 && (
            <div className="border rounded p-4 text-sm text-gray-600">
              No weekly seller activity yet.
            </div>
          )}
          {weeklyItems.map((seller, index) => (
            <Link
              key={seller.id}
              to={`/users/${seller.id}`}
              className="block border rounded p-4 hover:bg-gray-50"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm text-gray-500">#{index + 1}</div>
                  <div className="font-semibold">{seller.displayName}</div>
                  <div className="text-sm text-gray-600">
                    ⭐ {seller.ratingAvg.toFixed(2)} ({seller.ratingCount} reviews)
                  </div>
                </div>

                <div className="text-right text-sm text-gray-700">
                  <div>Completed deals (7d): {seller.completedDeals}</div>
                  <div>Active listings: {seller.activeListings}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}