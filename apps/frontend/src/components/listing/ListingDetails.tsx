import { Link } from "react-router-dom";
import type { Listing } from "../../types/listing";

export function ListingDetails({ listing }: { listing: Listing }) {
  const effectivePrice = listing.effectivePrice ?? listing.price;

  return (
    <div className="border rounded p-4 space-y-3">
      <div>
        <h1 className="text-2xl font-bold">{listing.title}</h1>
        <p className="text-gray-600">{listing.description}</p>
      </div>

      <div className="text-sm">
        Seller:{" "}
        <Link
          className="underline font-semibold"
          to={`/users/${listing.seller.id}`}
        >
          {listing.seller.displayName}
        </Link>{" "}
        — ⭐ {listing.seller.ratingAvg.toFixed(2)} ({listing.seller.ratingCount}
        )
      </div>

      <div className="pt-2 border-t flex justify-between items-center">
        <div className="text-xl font-semibold space-y-1">
          {listing.isOnSale ? (
            <div className="flex items-center gap-3">
              <span className="line-through text-sm text-gray-500">
                {(listing.price / 100).toFixed(2)} Kč
              </span>
              <span>{(effectivePrice / 100).toFixed(2)} Kč</span>
              <span className="text-xs px-2 py-1 rounded bg-black text-white">
                SALE {listing.salePercent}%
              </span>
            </div>
          ) : (
            <span>{(effectivePrice / 100).toFixed(2)} Kč</span>
          )}

          {listing.referencePrice30d !== undefined && (
            <div className="text-xs text-gray-500 font-normal">
              Lowest price in 30 days: {(listing.referencePrice30d / 100).toFixed(2)} Kč
            </div>
          )}
        </div>
        <div className="text-xs text-gray-600">{listing.type}</div>
      </div>

      {listing.isOnSale && listing.saleEndsAt && (
        <div className="text-sm text-green-700">
          Sale ends: {new Date(listing.saleEndsAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}
