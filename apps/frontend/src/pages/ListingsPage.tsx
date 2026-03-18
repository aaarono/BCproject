import { useEffect, useState } from "react";
import { http } from "../api/http";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import type { Listing } from "../types/listing";
import { MarketplaceListingCard } from "../components/listing/MarketplaceListingCard";
import { PageContainer, PageHeader } from "../components/ui/PageLayout";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";

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
    <PageContainer width="max-w-7xl">
      <PageHeader
        title="Listings"
        subtitle="Discover trusted offers with escrow-protected checkout."
        right={user ? `Signed in as ${user.email}` : "Guest mode"}
      />

      <div className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-2 lg:grid-cols-4">
        <Input
          type="text"
          placeholder="Search listings..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="bg-slate-50"
        />
        <select
          value={type}
          onChange={(e) => { setType(e.target.value as "" | "GOOD" | "SERVICE"); setPage(1); }}
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
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
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
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
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
        >
          <option value="NEWEST">Newest</option>
          <option value="PRICE_ASC">Price: low to high</option>
          <option value="PRICE_DESC">Price: high to low</option>
          <option value="RATING">Top rated sellers</option>
          <option value="SALE">Best sale first</option>
        </select>

        <Input
          type="text"
          placeholder="Tags: eu, alliance"
          value={tags}
          onChange={(e) => { setTags(e.target.value); setPage(1); }}
          className="bg-slate-50"
        />

        <Input
          type="number"
          placeholder="Min price (cents)"
          value={minPrice}
          onChange={(e) => { setMinPrice(e.target.value); setPage(1); }}
          className="bg-slate-50"
        />

        <Input
          type="number"
          placeholder="Max price (cents)"
          value={maxPrice}
          onChange={(e) => { setMaxPrice(e.target.value); setPage(1); }}
          className="bg-slate-50"
        />

        <Input
          type="number"
          min="0"
          max="5"
          step="0.1"
          placeholder="Min rating (0-5)"
          value={minRating}
          onChange={(e) => { setMinRating(e.target.value); setPage(1); }}
          className="bg-slate-50"
        />
      </div>

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Weekly Top Sellers</h2>
          <Link to="/top-sellers" className="text-sm font-medium text-slate-700 underline">
            View all
          </Link>
        </div>

        {weeklyTopSellers.length === 0 ? (
          <div className="mt-3 text-sm text-slate-500">No weekly activity yet.</div>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {weeklyTopSellers.map((seller, index) => (
              <Link
                key={seller.id}
                to={`/users/${seller.id}`}
                className="block rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 transition hover:border-slate-300 hover:bg-white"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-500">#{index + 1}</div>
                    <div className="font-semibold text-slate-900">{seller.displayName}</div>
                  </div>
                  <div className="text-right text-xs text-slate-600">
                    <div>★ {seller.ratingAvg.toFixed(2)}</div>
                    <div>7d deals: {seller.completedDeals}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.length === 0 && (
          <p className="col-span-full rounded-xl border border-slate-200 bg-white py-10 text-center text-slate-500">
            No listings found
          </p>
        )}
        {items.map((x) => (
          <MarketplaceListingCard key={x.id} listing={x} />
        ))}
      </div>

      {meta.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-slate-600">
            Page {meta.page} of {meta.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
            disabled={page === meta.totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </PageContainer>
  );
}
