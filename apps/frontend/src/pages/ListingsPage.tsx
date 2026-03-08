import { useEffect, useState } from "react";
import { http } from "../api/http";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

type Listing = {
  id: string;
  title: string;
  description: string;
  price: number;
  type: "GOOD" | "SERVICE";
  seller: { id: string; displayName: string; ratingAvg: number; ratingCount: number };
};

export function ListingsPage() {
  const [items, setItems] = useState<Listing[]>([]);
  const { user, logout } = useAuth();

  useEffect(() => {
    http.get<Listing[]>("/listings").then((r) => setItems(r.data));
  }, []);

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Listings</h1>
        <div className="text-sm flex gap-3 items-center">
          {user ? (
            <>
              <span>{user.email} ({user.role})</span>
            </>
          ) : (
            <>
              <span>Not logged in</span>
            </>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {items.map((x) => (
          <Link key={x.id} to={`/listings/${x.id}`} className="block border rounded p-4 hover:bg-gray-50">
            <div className="flex justify-between">
              <div>
                <div className="font-semibold">{x.title}</div>
                <div className="text-sm text-gray-600">{x.description}</div>
                <div className="text-sm mt-2">
                  Seller: <b>{x.seller.displayName}</b> — ⭐ {x.seller.ratingAvg.toFixed(2)} ({x.seller.ratingCount})
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold">{(x.price / 100).toFixed(2)} Kč</div>
                <div className="text-xs text-gray-600">{x.type}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
