import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { http } from "../api/http";
import { extractHttpErrorMessage } from "../utils/httpError";
import { SellerRankCard } from "../components/profile/SellerRankCard";
import { ErrorState, LoadingState } from "../components/ui/PageStates";
import { PageContainer, PageHeader } from "../components/ui/PageLayout";

type TopSeller = {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  ratingAvg: number;
  ratingCount: number;
  completedDeals: number;
  activeListings: number;
  score: number;
  achievements?: Array<{
    code: string;
    title: string;
    unlockedAt: string;
  }>;
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

  if (loading) return <LoadingState width="max-w-5xl" />;
  if (err) return <ErrorState width="max-w-5xl" message={err} />;

  return (
    <PageContainer width="max-w-5xl" className="space-y-6">
      <PageHeader
        title="Top Sellers"
        subtitle="Rankings by rating quality and completed deals."
      />

      {overallItems.length === 0 && weeklyItems.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Not enough seller activity yet.
        </div>
      )}

      <div className="space-y-6">
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-foreground">
            <Trophy className="h-4 w-4 text-warning" />
            Overall
          </h2>
          {overallItems.map((seller, index) => (
            <SellerRankCard key={seller.id} seller={seller} rank={index + 1} periodLabel="all time" />
          ))}
        </div>

        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-foreground">
            <Trophy className="h-4 w-4 text-warning" />
            Weekly
          </h2>
          {weeklyItems.length === 0 && (
            <div className="rounded-xl border border-border bg-muted p-4 text-sm text-muted-foreground">
              No weekly seller activity yet.
            </div>
          )}
          {weeklyItems.map((seller, index) => (
            <SellerRankCard key={seller.id} seller={seller} rank={index + 1} periodLabel="7d" />
          ))}
        </div>
      </div>
    </PageContainer>
  );
}