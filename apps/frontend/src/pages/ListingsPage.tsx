import { useEffect, useState } from "react";
import { http } from "../api/http";
import { Link } from "react-router-dom";
import { Trophy, ChevronDown, X } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { extractHttpErrorMessage } from "../utils/httpError";
import type { Listing } from "../types/listing";
import { MarketplaceListingCard } from "../components/listing/MarketplaceListingCard";
import { PageContainer, PageHeader } from "../components/ui/PageLayout";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";

type Meta = { total: number; page: number; limit: number; totalPages: number };

type TopSeller = {
  id: string;
  displayName: string;
  ratingAvg: number;
  ratingCount: number;
  completedDeals: number;
  activeListings?: number;
};

export function ListingsPage() {
  const [items, setItems] = useState<Listing[]>([]);
  const [weeklyTopSellers, setWeeklyTopSellers] = useState<TopSeller[]>([]);
  const [listingsLoading, setListingsLoading] = useState(true);
  const [listingsErr, setListingsErr] = useState<string | null>(null);
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
  const [reloadNonce, setReloadNonce] = useState(0);
  const { user } = useAuth();
  const minPriceValue = minPrice === "" ? 0 : Number(minPrice);
  const maxPriceValue = maxPrice === "" ? 200000 : Number(maxPrice);
  const rangeMin = Math.max(0, Math.min(minPriceValue, 200000));
  const rangeMax = Math.max(rangeMin, Math.min(maxPriceValue, 200000));
  const rangeLeft = (rangeMin / 200000) * 100;
  const rangeWidth = Math.max(((rangeMax - rangeMin) / 200000) * 100, 0);

  const hasActiveFilters = Boolean(search || type || category || tags || minPrice || maxPrice || minRating);
  const activeFilterCount = [search, type, category, tags, minPrice, maxPrice, minRating].filter(Boolean).length;

  function resetFilters() {
    setSearch("");
    setType("");
    setCategory("");
    setTags("");
    setMinPrice("");
    setMaxPrice("");
    setMinRating("");
    setSort("NEWEST");
    setPage(1);
  }

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

    http
      .get<{ data: Listing[]; meta: Meta }>("/listings", { params })
      .then((r) => {
        setListingsErr(null);
        setItems(r.data.data);
        setMeta(r.data.meta);
      })
      .catch((error: unknown) => {
        setItems([]);
        setListingsErr(extractHttpErrorMessage(error, "Failed to load listings"));
      })
      .finally(() => {
        setListingsLoading(false);
      });
  }, [page, search, type, category, sort, minPrice, maxPrice, minRating, tags, reloadNonce]);

  useEffect(() => {
    http
      .get<TopSeller[]>("/users/top-sellers/weekly", { params: { limit: 5 } })
      .then((r) => setWeeklyTopSellers(r.data))
      .catch(() => setWeeklyTopSellers([]));
  }, []);

  return (
    <PageContainer width="max-w-7xl" className="space-y-6">
      <PageHeader
        title="Listings"
        subtitle="Discover trusted offers with escrow-protected checkout."
        right={user ? `Signed in as ${user.email}` : "Guest mode"}
      />

      {!hasActiveFilters && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-warning" />
            <h2 className="text-lg font-semibold text-foreground">Weekly Top Sellers</h2>
            <Link to="/top-sellers" className="ml-auto text-sm font-medium text-foreground underline">
              View all
            </Link>
          </div>

          {weeklyTopSellers.length === 0 ? (
            <Card>
              <CardContent className="text-sm text-muted-foreground">No weekly activity yet.</CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {weeklyTopSellers.slice(0, 3).map((seller, index) => {
                const rank = index + 1;
                const rankClass = rank === 1 ? "bg-warning" : rank === 2 ? "bg-muted" : "bg-info";
                const rankTextClass = rank === 1 ? "text-warning-foreground" : rank === 2 ? "text-foreground" : "text-info-foreground";
                const initials = seller.displayName
                  .split(" ")
                  .map((part) => part[0]?.toUpperCase() ?? "")
                  .join("")
                  .slice(0, 2);

                return (
                  <Card key={seller.id} className="border-warning/30 bg-card/90 transition hover:shadow-md">
                    <CardContent className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-warning/20 text-sm font-semibold text-warning-foreground">
                              {initials || "TS"}
                            </div>
                            <span className={`absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-semibold ${rankClass} ${rankTextClass}`}>
                              #{rank}
                            </span>
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-foreground">{seller.displayName}</div>
                            <div className="text-xs text-muted-foreground">
                              {seller.completedDeals} deals · {seller.ratingAvg.toFixed(1)}★
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      )}

      <div className="flex gap-6 lg:gap-8">
        <aside className="hidden w-72 shrink-0 lg:block">
          <Card>
            <CardHeader className="space-y-1">
              <div className="flex items-center justify-between text-sm font-semibold text-foreground">
                <span>Filters</span>
                {activeFilterCount > 0 && <Badge className="bg-sale text-sale-foreground">{activeFilterCount}</Badge>}
              </div>
              <div className="text-xs text-muted-foreground">Narrow listings by type, category and price.</div>
            </CardHeader>
            <CardContent className="space-y-3">
              <details open className="group rounded-lg border border-border bg-muted/40 px-3 py-2">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-foreground">
                  Type
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition group-open:rotate-180" />
                </summary>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant={type === "" ? "default" : "outline"} size="sm" onClick={() => { setType(""); setPage(1); }}>
                    All
                  </Button>
                  <Button variant={type === "GOOD" ? "default" : "outline"} size="sm" onClick={() => { setType("GOOD"); setPage(1); }}>
                    Goods
                  </Button>
                  <Button variant={type === "SERVICE" ? "default" : "outline"} size="sm" onClick={() => { setType("SERVICE"); setPage(1); }}>
                    Services
                  </Button>
                </div>
              </details>

              <details open className="group rounded-lg border border-border bg-muted/40 px-3 py-2">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-foreground">
                  Category
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition group-open:rotate-180" />
                </summary>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant={category === "" ? "default" : "outline"} size="sm" onClick={() => { setCategory(""); setPage(1); }}>
                    All
                  </Button>
                  {[
                    "GAMES",
                    "ACCOUNTS",
                    "BOOSTING",
                    "MENTORING",
                    "GAME_CURRENCY",
                    "OTHER",
                  ].map((categoryOption) => (
                    <Button
                      key={categoryOption}
                      variant={category === categoryOption ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setCategory(categoryOption as typeof category);
                        setPage(1);
                      }}
                    >
                      {categoryOption.replaceAll("_", " ")}
                    </Button>
                  ))}
                </div>
              </details>

              <Input
                type="text"
                placeholder="Tags: eu, alliance"
                value={tags}
                onChange={(e) => { setTags(e.target.value); setPage(1); }}
                className="bg-muted"
              />

              <div className="space-y-2 rounded-xl border border-border bg-muted/60 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">Price range</span>
                  <span className="text-muted-foreground">{rangeMin} - {rangeMax} ¢</span>
                </div>

                <div className="relative h-2 rounded-full bg-border">
                  <div
                    className="absolute h-2 rounded-full bg-primary"
                    style={{ left: `${rangeLeft}%`, width: `${rangeWidth}%` }}
                  />
                </div>

                <div className="relative">
                  <input
                    type="range"
                    min={0}
                    max={200000}
                    step={500}
                    value={rangeMin}
                    onChange={(e) => {
                      const nextValue = Number(e.target.value);
                      setMinPrice(String(Math.min(nextValue, rangeMax)));
                      setPage(1);
                    }}
                    className="w-full accent-primary"
                  />
                  <input
                    type="range"
                    min={0}
                    max={200000}
                    step={500}
                    value={rangeMax}
                    onChange={(e) => {
                      const nextValue = Number(e.target.value);
                      setMaxPrice(String(Math.max(nextValue, rangeMin)));
                      setPage(1);
                    }}
                    className="-mt-2 w-full accent-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  placeholder="Min ¢"
                  value={minPrice}
                  onChange={(e) => { setMinPrice(e.target.value); setPage(1); }}
                  className="bg-muted"
                />

                <Input
                  type="number"
                  placeholder="Max ¢"
                  value={maxPrice}
                  onChange={(e) => { setMaxPrice(e.target.value); setPage(1); }}
                  className="bg-muted"
                />
              </div>

              <Input
                type="number"
                min="0"
                max="5"
                step="0.1"
                placeholder="Min rating (0-5)"
                value={minRating}
                onChange={(e) => { setMinRating(e.target.value); setPage(1); }}
                className="bg-muted"
              />

              {hasActiveFilters && (
                <Button variant="ghost" fullWidth className="text-destructive hover:text-destructive" onClick={resetFilters}>
                  <X className="h-4 w-4" />
                  Clear filters
                </Button>
              )}
            </CardContent>
          </Card>
        </aside>

        <section className="flex-1 space-y-4">
          <Card>
            <CardContent className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  type="text"
                  placeholder="Search listings..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="bg-muted"
                />
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
                  className="h-10 rounded-lg border border-input bg-muted px-3 text-sm text-foreground"
                >
                  <option value="NEWEST">Newest</option>
                  <option value="PRICE_ASC">Price: low to high</option>
                  <option value="PRICE_DESC">Price: high to low</option>
                  <option value="RATING">Top rated sellers</option>
                  <option value="SALE">Best sale first</option>
                </select>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
                <select
                  value={type}
                  onChange={(e) => { setType(e.target.value as "" | "GOOD" | "SERVICE"); setPage(1); }}
                  className="h-10 rounded-lg border border-input bg-muted px-3 text-sm text-foreground"
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
                  className="h-10 rounded-lg border border-input bg-muted px-3 text-sm text-foreground"
                >
                  <option value="">All categories</option>
                  <option value="GAMES">Games</option>
                  <option value="ACCOUNTS">Accounts</option>
                  <option value="BOOSTING">Boosting</option>
                  <option value="MENTORING">Mentoring</option>
                  <option value="GAME_CURRENCY">Game currency</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Showing {meta.total} results</span>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={resetFilters}>
                    Clear filters
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {listingsErr ? (
            <Card>
              <CardContent className="space-y-3 text-center">
                <div className="text-sm text-destructive">{listingsErr}</div>
                <Button variant="outline" onClick={() => setReloadNonce((prev) => prev + 1)}>
                  Retry
                </Button>
              </CardContent>
            </Card>
          ) : listingsLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Card key={index} className="overflow-hidden">
                  <div className="aspect-[16/10] animate-pulse bg-muted" />
                  <CardContent className="space-y-3">
                    <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-full animate-pulse rounded bg-muted" />
                    <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : items.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((x) => (
                <MarketplaceListingCard key={x.id} listing={x} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="space-y-3 py-10 text-center">
                <div className="text-muted-foreground">No listings found.</div>
                <Button variant="outline" onClick={resetFilters}>Clear filters</Button>
              </CardContent>
            </Card>
          )}

          {!listingsLoading && !listingsErr && meta.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
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
        </section>
      </div>
    </PageContainer>
  );
}
