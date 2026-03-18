import { Link } from "react-router-dom";
import { Package, Briefcase, Tag } from "lucide-react";
import type { Listing } from "../../types/listing";
import { Badge } from "../ui/Badge";

function formatCategory(category: Listing["category"]) {
  return category.toLowerCase().replaceAll("_", " ");
}

export function MarketplaceListingCard({ listing }: { listing: Listing }) {
  const effectivePrice = listing.effectivePrice ?? listing.price;

  return (
    <Link
      to={`/listings/${listing.id}`}
      className="group block overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-slate-300 hover:shadow-sm"
    >
      <div className="relative aspect-[16/10] border-b border-slate-200 bg-gradient-to-br from-slate-100 to-slate-50">
        <div className="absolute inset-0 flex items-center justify-center text-slate-300">
          {listing.type === "GOOD" ? <Package className="h-12 w-12" /> : <Briefcase className="h-12 w-12" />}
        </div>
        <div className="absolute left-3 top-3">
          <Badge variant="outline">{listing.type === "GOOD" ? "Good" : "Service"}</Badge>
        </div>

        {listing.isOnSale && listing.salePercent ? (
          <div className="absolute right-3 top-3">
            <Badge variant="default">Sale {listing.salePercent}%</Badge>
          </div>
        ) : null}
      </div>

      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{formatCategory(listing.category)}</Badge>
          {listing.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 text-xs text-slate-500">
              <Tag className="h-3 w-3" />#{tag}
            </span>
          ))}
        </div>

        <h3 className="line-clamp-2 text-base font-semibold text-slate-900 transition group-hover:text-slate-700">
          {listing.title}
        </h3>

        <p className="line-clamp-2 text-sm text-slate-600">{listing.description}</p>

        <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-3">
          <div className="min-w-0">
            <div className="truncate text-xs text-slate-500">{listing.seller.displayName}</div>
            <div className="text-xs text-slate-500">
              ★ {listing.seller.ratingAvg.toFixed(2)} ({listing.seller.ratingCount})
            </div>
          </div>

          <div className="text-right">
            {listing.isOnSale ? (
              <>
                <div className="text-xs text-slate-500 line-through">
                  {(listing.price / 100).toFixed(2)} Kč
                </div>
                <div className="text-lg font-bold text-slate-900">{(effectivePrice / 100).toFixed(2)} Kč</div>
              </>
            ) : (
              <div className="text-lg font-bold text-slate-900">{(effectivePrice / 100).toFixed(2)} Kč</div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
