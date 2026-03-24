import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Clock3, Trophy } from "lucide-react";
import { http } from "../api/http";
import { extractHttpErrorMessage } from "../utils/httpError";
import { SellerRankCard } from "../components/profile/SellerRankCard";
import { ErrorState, LoadingState } from "../components/ui/PageStates";
import { PageContainer } from "../components/ui/PageLayout";
import { Avatar } from "../components/ui/Avatar";
import { formatUsdFromCents } from "../lib/currency";

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

type LeaderboardMode = "weekly" | "overall";

const PODIUM_REWARDS_BY_RANK: Record<number, number> = {
  1: 2500,
  2: 1500,
  3: 500,
};

const PODIUM_ORDER: Array<1 | 2 | 3> = [2, 1, 3];

function getNextWeekResetDate(now: Date) {
  const reset = new Date(now);
  const currentDay = reset.getDay();
  const daysUntilMonday = (8 - currentDay) % 7 || 7;
  reset.setDate(reset.getDate() + daysUntilMonday);
  reset.setHours(0, 0, 0, 0);
  return reset;
}

function formatCountdown(msUntilReset: number) {
  const totalSeconds = Math.max(0, Math.floor(msUntilReset / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
}

function PodiumSellerCard({
  seller,
  rank,
  showReward,
}: {
  seller: TopSeller;
  rank: 1 | 2 | 3;
  showReward: boolean;
}) {
  const reward = PODIUM_REWARDS_BY_RANK[rank] ?? 0;
  const placeLabel = rank === 1 ? "Gold" : rank === 2 ? "Silver" : "Bronze";
  const heightClass = rank === 1 ? "sm:h-[280px]" : rank === 2 ? "sm:h-[240px]" : "sm:h-[228px]";
  const avatarSizeClass = rank === 1 ? "h-16 w-16" : "h-14 w-14";
  const fallbackSizeClass = rank === 1 ? "text-lg font-semibold" : "text-base font-semibold";
  const pedestalHeightClass = rank === 1 ? "h-16" : rank === 2 ? "h-12" : "h-10";
  const placeBadgeClass =
    rank === 1
      ? "bg-warning/15 text-warning"
      : rank === 2
        ? "bg-muted text-foreground"
        : "bg-accent text-accent-foreground";
  const pedestalLabelClass =
    rank === 1
      ? "text-warning"
      : rank === 2
        ? "text-foreground"
        : "text-accent-foreground";
  const cardAccentClass =
    rank === 1
      ? "border-warning/50 bg-accent"
      : rank === 2
        ? "border-border bg-card"
        : "border-border bg-card";

  return (
    <div className="flex h-full flex-col">
      <Link
        to={`/users/${seller.id}`}
        className={`group flex h-full min-h-[190px] flex-col justify-between rounded-t-2xl border border-b-0 p-4 text-center transition hover:bg-accent ${heightClass} ${cardAccentClass}`}
      >
        <div className="space-y-3">
          <div
            className={`mx-auto inline-flex items-center rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${placeBadgeClass}`}
          >
            #{rank} · {placeLabel}
          </div>

          <div className="flex flex-col items-center gap-3">
            <Avatar
              src={seller.avatarUrl ?? undefined}
              alt={seller.displayName}
              fallback={seller.displayName.slice(0, 2).toUpperCase()}
              className={avatarSizeClass}
              fallbackClassName={fallbackSizeClass}
            />
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-foreground group-hover:text-accent-foreground">
                {seller.displayName}
              </div>
              <div className="text-sm text-warning">★ {seller.ratingAvg.toFixed(2)}</div>
            </div>
          </div>
        </div>

        <div className="space-y-1 text-xs text-muted-foreground">
          <div className="flex items-center justify-center gap-2">
            <span>{seller.completedDeals} deals</span>
            <span>•</span>
            <span>{seller.activeListings} listings</span>
          </div>
          {showReward && (
            <div className="pt-2 text-sm font-semibold text-foreground">
              Reward: {formatUsdFromCents(reward)}
            </div>
          )}
        </div>
      </Link>

      <div
        className={`flex items-center justify-center rounded-b-2xl border border-border bg-muted text-sm font-semibold text-foreground ${pedestalHeightClass}`}
      >
        <span className={pedestalLabelClass}>{placeLabel}</span>
      </div>
    </div>
  );
}

export function TopSellersPage() {
  const [overallItems, setOverallItems] = useState<TopSeller[]>([]);
  const [weeklyItems, setWeeklyItems] = useState<TopSeller[]>([]);
  const [activeMode, setActiveMode] = useState<LeaderboardMode>("weekly");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      http.get<TopSeller[]>("/users/top-sellers", { params: { limit: 20 } }),
      http.get<TopSeller[]>("/users/top-sellers/weekly", { params: { limit: 20 } }),
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

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const activeItems = activeMode === "weekly" ? weeklyItems : overallItems;
  const podiumItems = useMemo(
    () => PODIUM_ORDER.map((rank) => activeItems[rank - 1]).filter((item): item is TopSeller => Boolean(item)),
    [activeItems],
  );
  const otherItems = activeItems.slice(3, 20);
  const msUntilReset = getNextWeekResetDate(new Date(nowMs)).getTime() - nowMs;
  const countdownLabel = formatCountdown(msUntilReset);

  if (loading) return <LoadingState width="max-w-6xl" />;
  if (err) return <ErrorState width="max-w-6xl" message={err} />;

  return (
    <PageContainer width="max-w-6xl" className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-2 sm:w-[360px]">
        <div className="grid w-full grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveMode("weekly")}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              activeMode === "weekly" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent"
            }`}
          >
            Weekly sellers
          </button>
          <button
            type="button"
            onClick={() => setActiveMode("overall")}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              activeMode === "overall" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent"
            }`}
          >
            Overall sellers
          </button>
        </div>
      </div>

      {activeMode === "weekly" && (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          <Clock3 className="h-4 w-4" />
          Weekly leaderboard reset in <span className="font-semibold text-foreground">{countdownLabel}</span>
        </div>
      )}

      {overallItems.length === 0 && weeklyItems.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Not enough seller activity yet.
        </div>
      )}

      {activeItems.length > 0 && (
        <>
          <div className="space-y-3 rounded-2xl border border-border bg-muted/50 p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-foreground">
              <Trophy className="h-4 w-4 text-warning" />
              Podium
            </h2>

            <div className="grid gap-3 sm:grid-cols-3 sm:items-end">
              {podiumItems.map((seller) => {
                const rank = (activeItems.findIndex((item) => item.id === seller.id) + 1) as 1 | 2 | 3;
                return (
                  <PodiumSellerCard
                    key={seller.id}
                    seller={seller}
                    rank={rank}
                    showReward={activeMode === "weekly"}
                  />
                );
              })}
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">Other sellers</h2>

            {otherItems.length === 0 ? (
              <div className="rounded-xl border border-border bg-muted p-4 text-sm text-muted-foreground">
                No other sellers in this leaderboard yet.
              </div>
            ) : (
              otherItems.map((seller, index) => (
                <SellerRankCard
                  key={seller.id}
                  seller={seller}
                  rank={index + 4}
                  periodLabel={activeMode === "weekly" ? "7d" : "all time"}
                />
              ))
            )}
          </div>
        </>
      )}

      {activeItems.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          No seller activity yet for this leaderboard.
        </div>
      )}
    </PageContainer>
  );
}
