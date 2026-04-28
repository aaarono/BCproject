import { Link } from "react-router-dom";
import { Briefcase, Gamepad2, Star, Tag } from "lucide-react";
import type { Listing } from "../../types/listing";
import { Card, CardContent } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Avatar } from "../ui/Avatar";
import { formatUsdFromCents } from "../../lib/currency";

export function ListingDetails({ listing }: { listing: Listing }) {
  const effectivePrice = listing.effectivePrice ?? listing.price;
  const initials = listing.seller.displayName.slice(0, 2).toUpperCase();

  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-video border-b border-border bg-gradient-to-br from-muted to-muted/50">
        {listing.imageUrl ? (
          <img
            src={listing.imageUrl}
            alt={listing.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/30">
            {listing.type === "GOOD" ? <Gamepad2 className="h-20 w-20" /> : <Briefcase className="h-20 w-20" />}
          </div>
        )}

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
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{listing.description}</p>
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

        <div className="flex items-center justify-between gap-4 border-t border-border pt-4 text-sm text-muted-foreground">
          <div className="flex min-w-0 items-center gap-3 py-1.5">
            <Avatar
              src={listing.seller.avatarUrl}
              alt={listing.seller.displayName}
              fallback={initials}
              className="h-12 w-12"
              fallbackClassName="text-base font-semibold"
            />
            <div className="min-w-0">
              <Link className="text-lg font-semibold text-foreground underline" to={`/users/${listing.seller.id}`}>
                {listing.seller.displayName}
              </Link>
              <div className="flex items-center gap-1 text-sm font-medium">
                <Star className="h-3 w-3 fill-warning text-warning" />
                <span>{listing.seller.ratingAvg.toFixed(1)}</span>
                <span>({listing.seller.ratingCount} reviews)</span>
              </div>
            </div>
          </div>

          <div className="shrink-0 text-right">
            {listing.isOnSale ? (
              <div className="flex items-center justify-end gap-2">
                <span className="text-sm text-muted-foreground line-through">{formatUsdFromCents(listing.price)}</span>
                <span className="text-2xl font-bold text-primary">{formatUsdFromCents(effectivePrice)}</span>
              </div>
            ) : (
              <span className="text-2xl font-bold text-foreground">{formatUsdFromCents(effectivePrice)}</span>
            )}
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{listing.type}</div>
            {listing.isOnSale && listing.saleEndsAt && (
              <div className="mt-1 text-xs text-success">
                Sale ends: {new Date(listing.saleEndsAt).toLocaleString()}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
