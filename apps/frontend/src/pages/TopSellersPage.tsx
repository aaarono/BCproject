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
  activeBadge?: {
    code: string;
    title: string;
  } | null;
  achievements?: Array<{
    code: string;
    title: string;
    unlockedAt: string;
  }>;
};

type WeeklyWinner = {
  id: string;
  rank: number;
  score: number;
  rewardAmount: number;
  completedDeals: number;
  ratingAvgSnapshot: number;
  ratingCountSnapshot: number;
  activeListings: number;
  streakAfterWin: number;
  createdAt: string;
  weekStart: string;
  weekEnd: string;
  user: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
  };
};

type LeaderboardMode = "weekly" | "overall";

const PODIUM_REWARDS_BY_RANK: Record<number, number> = {
  1: 5000,
  2: 2500,
  3: 1000,
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
  const heightClass = "sm:h-[260px]";
  const avatarSizeClass = "h-20 w-20";
  const fallbackSizeClass = "text-xl font-semibold";
  const pedestalHeightClass = "h-14";
  const pedestalBackgroundClass =
    rank === 1
      ? "bg-gradient-to-r from-gold via-gold/80 to-gold-deep"
      : rank === 2
        ? "bg-gradient-to-r from-silver via-silver/80 to-silver-deep"
        : "bg-gradient-to-r from-bronze via-bronze/80 to-bronze-deep";
  const pedestalLabelClass =
    rank === 1
      ? "text-gold-foreground"
      : rank === 2
        ? "text-silver-foreground"
        : "text-bronze-foreground";
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
        className={`group flex h-full min-h-[190px] flex-col justify-center rounded-t-2xl border border-b-0 p-4 text-center transition hover:bg-accent ${heightClass} ${cardAccentClass}`}
      >
        <div className="space-y-2">
          <div className="flex flex-col items-center gap-2">
            <Avatar
              src={seller.avatarUrl ?? undefined}
              alt={seller.displayName}
              fallback={seller.displayName.slice(0, 2).toUpperCase()}
              className={avatarSizeClass}
              fallbackClassName={fallbackSizeClass}
            />
            <div className="min-w-0 space-y-1">
              <div className="truncate text-base font-semibold text-foreground group-hover:text-accent-foreground">
                {seller.displayName}
              </div>
              <div className="text-lg font-semibold text-warning">
                ★ {seller.ratingAvg.toFixed(2)}
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <span>{seller.completedDeals} deals</span>
                <span>•</span>
                <span>{seller.activeListings} listings</span>
              </div>
            </div>
          </div>

          {showReward && (
            <div className="pt-1 text-sm font-semibold text-foreground">
              Reward: {formatUsdFromCents(reward)}
            </div>
          )}
        </div>
      </Link>

      <div
        className={`flex items-center justify-center rounded-b-2xl border border-border text-sm font-semibold text-foreground ${pedestalHeightClass} ${pedestalBackgroundClass}`}
      >
        <span className={pedestalLabelClass}>{placeLabel} #{rank}</span>
      </div>
    </div>
  );
}

export function TopSellersPage() {
  const [overallItems, setOverallItems] = useState<TopSeller[]>([]);
  const [weeklyItems, setWeeklyItems] = useState<TopSeller[]>([]);
  const [weeklyWinners, setWeeklyWinners] = useState<WeeklyWinner[]>([]);
  const [activeMode, setActiveMode] = useState<LeaderboardMode>("weekly");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      http.get<TopSeller[]>("/users/top-sellers", { params: { limit: 20 } }),
      http.get<TopSeller[]>("/users/top-sellers/weekly", {
        params: { limit: 20 },
      }),
      http.get<WeeklyWinner[]>("/users/top-sellers/winners", {
        params: { limit: 8 },
      }),
    ])
      .then(([overall, weekly, winners]) => {
        if (!cancelled) {
          setOverallItems(overall.data);
          setWeeklyItems(weekly.data);
          setWeeklyWinners(winners.data);
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
    () =>
      PODIUM_ORDER.map((rank) => activeItems[rank - 1]).filter(
        (item): item is TopSeller => Boolean(item),
      ),
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
              activeMode === "weekly"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent"
            }`}
          >
            Weekly sellers
          </button>
          <button
            type="button"
            onClick={() => setActiveMode("overall")}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              activeMode === "overall"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent"
            }`}
          >
            Overall sellers
          </button>
        </div>
      </div>

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
              Top Sellers
            </h2>

            <div className="grid gap-3 sm:grid-cols-3 sm:items-end">
              {podiumItems.map((seller) => {
                const rank = (activeItems.findIndex(
                  (item) => item.id === seller.id,
                ) + 1) as 1 | 2 | 3;
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
            {activeMode === "weekly" && (
              <div className="flex items-center gap-2 rounded-xl bg-card px-4 py-3 text-sm text-muted-foreground">
                <Clock3 className="h-4 w-4" />
                Weekly leaderboard reset in{" "}
                <span className="font-semibold text-foreground">
                  {countdownLabel}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">
              Other sellers
            </h2>

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

          {activeMode === "weekly" && (
            <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                Weekly winners history
              </h2>
              {weeklyWinners.length === 0 ? (
                <div className="rounded-xl border border-border bg-muted p-4 text-sm text-muted-foreground">
                  No finalized weekly winners yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {weeklyWinners.map((winner) => (
                    <Link
                      key={winner.id}
                      to={`/users/${winner.user.id}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted p-3 transition hover:bg-accent"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar
                          src={winner.user.avatarUrl ?? undefined}
                          alt={winner.user.displayName}
                          fallback={winner.user.displayName
                            .slice(0, 2)
                            .toUpperCase()}
                          className="h-10 w-10"
                          fallbackClassName="text-xs font-semibold"
                        />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-foreground">
                            {winner.user.displayName}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(winner.weekStart).toLocaleDateString()} -{" "}
                            {new Date(winner.weekEnd).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <div className="font-semibold text-foreground">
                          {formatUsdFromCents(winner.rewardAmount)}
                        </div>
                        <div>
                          {winner.completedDeals} deals • streak{" "}
                          {winner.streakAfterWin}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
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
