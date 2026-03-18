import { Link } from "react-router-dom";
import type { Listing } from "../../types/listing";
import { Card, CardContent } from "../ui/Card";
import { Badge } from "../ui/Badge";

export function ListingDetails({ listing }: { listing: Listing }) {
  const effectivePrice = listing.effectivePrice ?? listing.price;

  return (
    <Card className="overflow-hidden">
      <div className="aspect-[16/10] border-b border-slate-200 bg-gradient-to-br from-slate-100 to-slate-50" />
      <CardContent className="space-y-4 p-5 sm:p-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{listing.title}</h1>
          <p className="text-sm leading-relaxed text-slate-600">{listing.description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{listing.category.replaceAll("_", " ")}</Badge>
          <Badge variant="muted">{listing.type === "GOOD" ? "Good" : "Service"}</Badge>
          {listing.tags?.slice(0, 3).map((tag) => (
            <span key={tag} className="text-xs text-slate-500">
              #{tag}
            </span>
          ))}
        </div>

        <div className="text-sm text-slate-600">
          Seller:{" "}
          <Link className="font-semibold text-slate-900 underline" to={`/users/${listing.seller.id}`}>
            {listing.seller.displayName}
          </Link>{" "}
          · ★ {listing.seller.ratingAvg.toFixed(2)} ({listing.seller.ratingCount})
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <div className="space-y-1">
            {listing.isOnSale ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500 line-through">{(listing.price / 100).toFixed(2)} Kč</span>
                <span className="text-2xl font-bold text-slate-900">{(effectivePrice / 100).toFixed(2)} Kč</span>
                <Badge variant="default">Sale {listing.salePercent}%</Badge>
              </div>
            ) : (
              <span className="text-2xl font-bold text-slate-900">{(effectivePrice / 100).toFixed(2)} Kč</span>
            )}

            {listing.referencePrice30d !== undefined && (
              <div className="text-xs text-slate-500">
                Lowest price in 30 days: {(listing.referencePrice30d / 100).toFixed(2)} Kč
              </div>
            )}
          </div>
          <div className="text-xs uppercase tracking-wide text-slate-500">{listing.type}</div>
        </div>

        {listing.isOnSale && listing.saleEndsAt && (
          <div className="text-sm text-emerald-700">
            Sale ends: {new Date(listing.saleEndsAt).toLocaleString()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
