import { useEffect, useState } from "react";
import { http } from "../api/http";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import type { Listing } from "../types/listing";

type Meta = { total: number; page: number; limit: number; totalPages: number };

type TopSeller = {
  id: string;
  displayName: string;
  ratingAvg: number;
  ratingCount: number;
  completedDeals: number;
};

export function ListingsPage() {
  const [items, setItems] = useState<Listing[]>([]);
  const [weeklyTopSellers, setWeeklyTopSellers] = useState<TopSeller[]>([]);
  const [meta, setMeta] = useState<Meta>({ total: 0, page: 1, limit: 12, totalPages: 1 });
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"" | "GOOD" | "SERVICE">("");
  const [category, setCategory] = useState<
    "" | "GAMES" | "ACCOUNTS" | "BOOSTING" | "MENTORING" | "GAME_CURRENCY" | "OTHER"
  >("");
  const [tags, setTags] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minRating, setMinRating] = useState("");
  const [sort, setSort] = useState<"NEWEST" | "PRICE_ASC" | "PRICE_DESC" | "RATING" | "SALE">("NEWEST");
  const [page, setPage] = useState(1);
  const { user } = useAuth();

  useEffect(() => {
    const params: Record<string, string | number> = { page, limit: 12 };
    if (search) params.search = search;
    if (type) params.type = type;
    if (category) params.category = category;
    if (sort) params.sort = sort;
    if (minPrice) params.minPrice = Number(minPrice);
    if (maxPrice) params.maxPrice = Number(maxPrice);
    if (minRating) params.minRating = Number(minRating);

    const normalizedTags = tags
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean);
    if (normalizedTags.length) params.tags = normalizedTags.join(",");

    http.get<{ data: Listing[]; meta: Meta }>("/listings", { params }).then((r) => {
      setItems(r.data.data);
      setMeta(r.data.meta);
    });
  }, [page, search, type, category, sort, minPrice, maxPrice, minRating, tags]);

  useEffect(() => {
    http
      .get<TopSeller[]>("/users/top-sellers/weekly", { params: { limit: 5 } })
      .then((r) => setWeeklyTopSellers(r.data))
      .catch(() => setWeeklyTopSellers([]));
  }, []);

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Listings</h1>
        <div className="text-sm flex gap-3 items-center">
          {user ? (
            <span>{user.email} ({user.role})</span>
          ) : (
            <span>Not logged in</span>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        <input
          type="text"
          placeholder="Search listings..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="border rounded px-3 py-2 text-sm"
        />
        <select
          value={type}
          onChange={(e) => { setType(e.target.value as "" | "GOOD" | "SERVICE"); setPage(1); }}
          className="border rounded px-3 py-2 text-sm"
        >
          <option value="">All types</option>
          <option value="GOOD">Goods</option>
          <option value="SERVICE">Services</option>
        </select>

        <select
          value={category}
          onChange={(e) => {
            setCategory(
              e.target.value as
                | ""
                | "GAMES"
                | "ACCOUNTS"
                | "BOOSTING"
                | "MENTORING"
                | "GAME_CURRENCY"
                | "OTHER",
            );
            setPage(1);
          }}
          className="border rounded px-3 py-2 text-sm"
        >
          <option value="">All categories</option>
          <option value="GAMES">Games</option>
          <option value="ACCOUNTS">Accounts</option>
          <option value="BOOSTING">Boosting</option>
          <option value="MENTORING">Mentoring</option>
          <option value="GAME_CURRENCY">Game currency</option>
          <option value="OTHER">Other</option>
        </select>

        <select
          value={sort}
          onChange={(e) => {
            setSort(
              e.target.value as
                | "NEWEST"
                | "PRICE_ASC"
                | "PRICE_DESC"
                | "RATING"
                | "SALE",
            );
            setPage(1);
          }}
          className="border rounded px-3 py-2 text-sm"
        >
          <option value="NEWEST">Newest</option>
          <option value="PRICE_ASC">Price: low to high</option>
          <option value="PRICE_DESC">Price: high to low</option>
          <option value="RATING">Top rated sellers</option>
          <option value="SALE">Best sale first</option>
        </select>

        <input
          type="text"
          placeholder="Tags: eu, alliance"
          value={tags}
          onChange={(e) => { setTags(e.target.value); setPage(1); }}
          className="border rounded px-3 py-2 text-sm"
        />

        <input
          type="number"
          placeholder="Min price (cents)"
          value={minPrice}
          onChange={(e) => { setMinPrice(e.target.value); setPage(1); }}
          className="border rounded px-3 py-2 text-sm"
        />

        <input
          type="number"
          placeholder="Max price (cents)"
          value={maxPrice}
          onChange={(e) => { setMaxPrice(e.target.value); setPage(1); }}
          className="border rounded px-3 py-2 text-sm"
        />

        <input
          type="number"
          min="0"
          max="5"
          step="0.1"
          placeholder="Min rating (0-5)"
          value={minRating}
          onChange={(e) => { setMinRating(e.target.value); setPage(1); }}
          className="border rounded px-3 py-2 text-sm"
        />
      </div>

      <div className="border rounded p-4 mb-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Weekly Top Sellers</h2>
          <Link to="/top-sellers" className="text-sm underline">
            View all
          </Link>
        </div>

        {weeklyTopSellers.length === 0 ? (
          <div className="text-sm text-gray-500">No weekly activity yet.</div>
        ) : (
          <div className="space-y-2">
            {weeklyTopSellers.map((seller, index) => (
              <Link
                key={seller.id}
                to={`/users/${seller.id}`}
                className="block border rounded px-3 py-2 hover:bg-gray-50"
              >
                <div className="flex items-center justify-between gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 mr-2">#{index + 1}</span>
                    <span className="font-medium">{seller.displayName}</span>
                  </div>
                  <div className="text-gray-600">
                    ⭐ {seller.ratingAvg.toFixed(2)} · deals 7d: {seller.completedDeals}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Listing cards */}
      <div className="space-y-3">
        {items.length === 0 && (
          <p className="text-gray-500 text-center py-8">No listings found</p>
        )}
        {items.map((x) => (
          <Link key={x.id} to={`/listings/${x.id}`} className="block border rounded p-4 hover:bg-gray-50">
            <div className="flex justify-between">
              <div>
                <div className="font-semibold">{x.title}</div>
                <div className="text-sm text-gray-600">{x.description}</div>
                <div className="text-xs text-gray-600 mt-1">
                  {x.category}
                  {x.tags?.length ? ` · ${x.tags.join(", ")}` : ""}
                </div>
                <div className="text-sm mt-2">
                  Seller: <b>{x.seller.displayName}</b> — ⭐ {x.seller.ratingAvg.toFixed(2)} ({x.seller.ratingCount})
                </div>
              </div>
              <div className="text-right">
                {x.isOnSale ? (
                  <div className="space-y-1">
                    <div className="text-xs line-through text-gray-500">
                      {(x.price / 100).toFixed(2)} Kč
                    </div>
                    <div className="font-semibold">
                      {((x.effectivePrice ?? x.price) / 100).toFixed(2)} Kč
                    </div>
                    <div className="text-[10px] px-2 py-0.5 rounded bg-black text-white inline-block">
                      SALE {x.salePercent}%
                    </div>
                  </div>
                ) : (
                  <div className="font-semibold">{(x.price / 100).toFixed(2)} Kč</div>
                )}
                <div className="text-xs text-gray-600">{x.type}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 border rounded text-sm disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {meta.page} of {meta.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
            disabled={page === meta.totalPages}
            className="px-3 py-1 border rounded text-sm disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
