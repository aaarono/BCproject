import { Link } from "react-router-dom";
import { Avatar } from "../ui/Avatar";

type SellerRank = {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  ratingAvg: number;
  ratingCount: number;
  completedDeals: number;
  activeListings: number;
  achievements?: Array<{
    code: string;
    title: string;
    unlockedAt: string;
  }>;
};

export function SellerRankCard({
  seller,
  rank,
  periodLabel,
}: {
  seller: SellerRank;
  rank: number;
  periodLabel: string;
}) {
  return (
    <Link
      to={`/users/${seller.id}`}
      className="group block rounded-xl border border-border bg-card p-4 transition hover:bg-accent"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar
            src={seller.avatarUrl ?? undefined}
            alt={seller.displayName}
            fallback={seller.displayName.slice(0, 2).toUpperCase()}
            className="h-10 w-10"
            fallbackClassName="text-xs font-semibold"
          />

          <div className="min-w-0">
            <div className="mb-1 inline-flex items-center rounded-full bg-muted px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              #{rank} · {periodLabel}
            </div>
            <div className="truncate text-base font-semibold text-foreground group-hover:text-accent-foreground">
              {seller.displayName}
            </div>
            <div className="text-sm text-muted-foreground">
              ★ {seller.ratingAvg.toFixed(2)} ({seller.ratingCount} reviews)
            </div>
          </div>
        </div>

        <div className="text-right text-xs text-muted-foreground">
          <div>{seller.completedDeals} deals</div>
          <div>{seller.activeListings} listings</div>
        </div>
      </div>

      {seller.achievements && seller.achievements.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {seller.achievements.slice(0, 2).map((achievement) => (
            <span
              key={achievement.code}
              className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
            >
              {achievement.title}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
