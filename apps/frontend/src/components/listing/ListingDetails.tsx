import { Link } from "react-router-dom";
import { Briefcase, Gamepad2, Star, Tag } from "lucide-react";
import type { Listing } from "../../types/listing";
import { Card, CardContent } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { formatUsdFromCents } from "../../lib/currency";

export function ListingDetails({ listing }: { listing: Listing }) {
  const effectivePrice = listing.effectivePrice ?? listing.price;
  const initials = listing.seller.displayName.slice(0, 2).toUpperCase();

  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-video border-b border-border bg-gradient-to-br from-muted to-muted/50">
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/30">
          {listing.type === "GOOD" ? <Gamepad2 className="h-20 w-20" /> : <Briefcase className="h-20 w-20" />}
        </div>

        {listing.isOnSale && listing.salePercent ? (
          <div className="absolute left-4 top-4">
            <Badge className="bg-sale text-sale-foreground text-sm font-semibold">Sale {listing.salePercent}%</Badge>
          </div>
        ) : null}

        <div className="absolute right-4 top-4">
          <Badge variant="muted">{listing.type === "GOOD" ? "Good" : "Service"}</Badge>
        </div>
      </div>

      <CardContent className="space-y-4 p-5 sm:p-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{listing.title}</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">{listing.description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{listing.category.replaceAll("_", " ")}</Badge>
          {listing.tags?.slice(0, 3).map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Tag className="h-3 w-3" />
              {tag}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted font-semibold text-foreground">
            {initials}
          </div>
          <div>
            <Link className="font-semibold text-foreground underline" to={`/users/${listing.seller.id}`}>
              {listing.seller.displayName}
            </Link>
            <div className="flex items-center gap-1">
              <Star className="h-3 w-3 fill-warning text-warning" />
              <span>{listing.seller.ratingAvg.toFixed(1)}</span>
              <span>({listing.seller.ratingCount} reviews)</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-4">
          <div className="space-y-1">
            {listing.isOnSale ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground line-through">{formatUsdFromCents(listing.price)}</span>
                <span className="text-2xl font-bold text-primary">{formatUsdFromCents(effectivePrice)}</span>
              </div>
            ) : (
              <span className="text-2xl font-bold text-foreground">{formatUsdFromCents(effectivePrice)}</span>
            )}

            {listing.referencePrice30d !== undefined && (
              <div className="text-xs text-muted-foreground">
                Lowest price in 30 days: {formatUsdFromCents(listing.referencePrice30d)}
              </div>
            )}
          </div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{listing.type}</div>
        </div>

        {listing.isOnSale && listing.saleEndsAt && (
          <div className="text-sm text-success">
            Sale ends: {new Date(listing.saleEndsAt).toLocaleString()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
