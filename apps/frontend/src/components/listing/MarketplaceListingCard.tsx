import { Link } from "react-router-dom";
import { Package, Briefcase, Tag, Star } from "lucide-react";
import type { Listing } from "../../types/listing";
import { Badge } from "../ui/Badge";
import { Avatar } from "../ui/Avatar";
import { formatUsdFromCents } from "../../lib/currency";

function formatCategory(category: Listing["category"]) {
  return category.toLowerCase().replaceAll("_", " ");
}

export function MarketplaceListingCard({ listing }: { listing: Listing }) {
  const effectivePrice = listing.effectivePrice ?? listing.price;
  const initials = listing.seller.displayName.slice(0, 2).toUpperCase();

  return (
    <Link
      to={`/listings/${listing.id}`}
      className="group block overflow-hidden rounded-xl border border-border bg-card transition-all duration-200 hover:border-primary/30 hover:shadow-md"
    >
      <div className="relative aspect-[16/10] border-b border-border bg-gradient-to-br from-muted to-muted/50">
        {listing.imageUrl ? (
          <img
            src={listing.imageUrl}
            alt={listing.title}
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/50">
            {listing.type === "GOOD" ? <Package className="h-12 w-12" /> : <Briefcase className="h-12 w-12" />}
          </div>
        )}
        {listing.isOnSale && listing.salePercent ? (
          <div className="absolute left-3 top-3">
            <Badge className="bg-sale text-sale-foreground">Sale {listing.salePercent}%</Badge>
          </div>
        ) : null}

        <div className="absolute right-3 top-3">
          <Badge variant="muted">{listing.type === "GOOD" ? "Good" : "Service"}</Badge>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{formatCategory(listing.category)}</Badge>
          {listing.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Tag className="h-3 w-3" />#{tag}
            </span>
          ))}
        </div>

        <h3 className="line-clamp-2 text-sm font-semibold text-foreground transition group-hover:text-primary">
          {listing.title}
        </h3>

        <div className="flex items-center gap-2">
          <Avatar
            src={listing.seller.avatarUrl}
            alt={listing.seller.displayName}
            fallback={initials}
            className="h-5 w-5"
            fallbackClassName="text-[10px] font-semibold"
          />
          <span className="truncate text-xs text-muted-foreground">{listing.seller.displayName}</span>
          <div className="ml-auto flex items-center gap-1">
            <Star className="h-3 w-3 fill-warning text-warning" />
            <span className="text-xs font-medium text-foreground">{listing.seller.ratingAvg.toFixed(1)}</span>
          </div>
        </div>

        {listing.seller.achievements && listing.seller.achievements.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {listing.seller.achievements.slice(0, 2).map((achievement) => (
              <Badge key={achievement.definition.code} variant="outline" className="text-[10px]">
                {achievement.definition.title}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex items-end justify-between gap-4 border-t border-border pt-3">
          <div className="min-w-0 space-y-0.5">
            {listing.isOnSale ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-primary">{formatUsdFromCents(effectivePrice)}</span>
                  <span className="text-sm text-muted-foreground line-through">{formatUsdFromCents(listing.price)}</span>
                </div>
                {listing.referencePrice30d !== undefined && listing.referencePrice30d !== null && (
                  <p className="text-[10px] text-muted-foreground">
                    Lowest 30d: {formatUsdFromCents(listing.referencePrice30d)}
                  </p>
                )}
              </>
            ) : (
              <span className="text-lg font-bold text-foreground">{formatUsdFromCents(effectivePrice)}</span>
            )}
          </div>

          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Package className="h-3 w-3" />
            <span>{listing.type === "GOOD" ? "Stock item" : "Service"}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
