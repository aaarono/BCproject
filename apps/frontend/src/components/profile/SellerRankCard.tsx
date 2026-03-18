import { Link } from "react-router-dom";

type SellerRank = {
  id: string;
  displayName: string;
  ratingAvg: number;
  ratingCount: number;
  completedDeals: number;
  activeListings: number;
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
      className="group block rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-1 inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
            #{rank} · {periodLabel}
          </div>
          <div className="truncate text-base font-semibold text-slate-900 group-hover:text-slate-700">
            {seller.displayName}
          </div>
          <div className="text-sm text-slate-600">
            ★ {seller.ratingAvg.toFixed(2)} ({seller.ratingCount} reviews)
          </div>
        </div>

        <div className="text-right text-xs text-slate-500">
          <div>{seller.completedDeals} deals</div>
          <div>{seller.activeListings} listings</div>
        </div>
      </div>
    </Link>
  );
}
