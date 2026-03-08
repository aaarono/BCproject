import { Link } from "react-router-dom";
import type { Listing } from "../../types/listing";

export function ListingDetails({ listing }: { listing: Listing }) {
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
        <div className="text-xl font-semibold">
          {(listing.price / 100).toFixed(2)} Kč
        </div>
        <div className="text-xs text-gray-600">{listing.type}</div>
      </div>
    </div>
  );
}
