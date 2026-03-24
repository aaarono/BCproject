import { useEffect, useState } from "react";
import { http } from "../api/http";
import { Link } from "react-router-dom";
import { Trophy, Star, X } from "lucide-react";
import { extractHttpErrorMessage } from "../utils/httpError";
import type { Listing } from "../types/listing";
import { MarketplaceListingCard } from "../components/listing/MarketplaceListingCard";
import { PageContainer } from "../components/ui/PageLayout";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Avatar } from "../components/ui/Avatar";
import { dollarsToCents, formatUsdFromCents } from "../lib/currency";

type Meta = { total: number; page: number; limit: number; totalPages: number };

type DebouncedFilters = {
  search: string;
  type: "" | "GOOD" | "SERVICE";
  category: "" | "GAMES" | "ACCOUNTS" | "BOOSTING" | "MENTORING" | "GAME_CURRENCY" | "OTHER";
  sort: "NEWEST" | "PRICE_ASC" | "PRICE_DESC" | "RATING" | "SALE";
  minPrice: string;
  maxPrice: string;
  minRating: string;
  tagsKey: string;
};

type TopSeller = {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  ratingAvg: number;
  ratingCount: number;
  completedDeals: number;
  activeListings?: number;
  achievements?: Array<{
    code: string;
    title: string;
    unlockedAt: string;
  }>;
};

const SUGGESTED_TAGS = ["boost", "ranked", "eu", "na", "coaching", "mmr", "instant", "verified"];
const PRICE_MIN = 0;
const PRICE_MAX = 2000;
const PRICE_STEP = 5;

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
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [draftPriceRange, setDraftPriceRange] = useState<[number, number]>([
    PRICE_MIN,
    PRICE_MAX,
  ]);
  const [minRating, setMinRating] = useState("");
  const [sort, setSort] = useState<"NEWEST" | "PRICE_ASC" | "PRICE_DESC" | "RATING" | "SALE">("NEWEST");
  const [page, setPage] = useState(1);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [debouncedFilters, setDebouncedFilters] = useState<DebouncedFilters>({
    search: "",
    type: "",
    category: "",
    sort: "NEWEST",
    minPrice: "",
    maxPrice: "",
    minRating: "",
    tagsKey: "",
  });
  const minPriceValue = minPrice === "" ? PRICE_MIN : Number(minPrice);
  const maxPriceValue = maxPrice === "" ? PRICE_MAX : Number(maxPrice);
  const appliedMin = Math.max(PRICE_MIN, Math.min(minPriceValue, PRICE_MAX));
  const appliedMax = Math.max(appliedMin, Math.min(maxPriceValue, PRICE_MAX));
  const rangeMin = draftPriceRange[0];
  const rangeMax = draftPriceRange[1];
  const rangeLeft = (rangeMin / PRICE_MAX) * 100;
  const rangeWidth = Math.max(((rangeMax - rangeMin) / PRICE_MAX) * 100, 0);

  const hasActiveFilters = Boolean(search || type || category || selectedTags.length > 0 || minPrice || maxPrice || minRating);
  const activeFilterCount = [search, type, category, selectedTags.length > 0 ? "tags" : "", minPrice, maxPrice, minRating].filter(Boolean).length;

  function formatUsdValue(value: number) {
    return formatUsdFromCents(dollarsToCents(value));
  }

  function addTag(rawTag: string) {
    const normalized = rawTag.trim().toLowerCase().replace(/\s+/g, "-");
    if (!normalized || selectedTags.includes(normalized)) return;
    setSelectedTags((prev) => [...prev, normalized].slice(0, 8));
    setPage(1);
  }

  function removeTag(tag: string) {
    setSelectedTags((prev) => prev.filter((item) => item !== tag));
    setPage(1);
  }

  function resetFilters() {
    setSearch("");
    setType("");
    setCategory("");
    setSelectedTags([]);
    setTagInput("");
    setMinPrice("");
    setMaxPrice("");
    setDraftPriceRange([PRICE_MIN, PRICE_MAX]);
    setMinRating("");
    setSort("NEWEST");
    setPage(1);
  }

  function commitDraftPriceRange(nextMin: number, nextMax: number) {
    setMinPrice(nextMin <= PRICE_MIN ? "" : String(nextMin));
    setMaxPrice(nextMax >= PRICE_MAX ? "" : String(nextMax));
    setPage(1);
  }

  useEffect(() => {
    setDraftPriceRange([appliedMin, appliedMax]);
  }, [appliedMin, appliedMax]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedFilters({
        search,
        type,
        category,
        sort,
        minPrice,
        maxPrice,
        minRating,
        tagsKey: selectedTags.join(","),
      });
    }, 300);

    return () => clearTimeout(timeout);
  }, [search, type, category, sort, minPrice, maxPrice, minRating, selectedTags]);

  useEffect(() => {
    const params: Record<string, string | number> = { page, limit: 12 };
    if (debouncedFilters.search) params.search = debouncedFilters.search;
    if (debouncedFilters.type) params.type = debouncedFilters.type;
    if (debouncedFilters.category) params.category = debouncedFilters.category;
    if (debouncedFilters.sort) params.sort = debouncedFilters.sort;
    if (debouncedFilters.minPrice) params.minPrice = dollarsToCents(Number(debouncedFilters.minPrice));
    if (debouncedFilters.maxPrice) params.maxPrice = dollarsToCents(Number(debouncedFilters.maxPrice));
    if (debouncedFilters.minRating) params.minRating = Number(debouncedFilters.minRating);
    if (debouncedFilters.tagsKey) params.tags = debouncedFilters.tagsKey;

    setListingsLoading(true);

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
  }, [page, debouncedFilters, reloadNonce]);

  useEffect(() => {
    http
      .get<TopSeller[]>("/users/top-sellers/weekly", { params: { limit: 5 } })
      .then((r) => setWeeklyTopSellers(r.data))
      .catch(() => setWeeklyTopSellers([]));
  }, []);

  return (
    <PageContainer width="max-w-7xl" className="space-y-6">
      {!hasActiveFilters && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-warning" />
            <h2 className="text-lg font-semibold text-foreground">Weekly Top Sellers</h2>
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
                  <Link key={seller.id} to={`/users/${seller.id}`} className="block">
                    <Card className="border-warning/30 bg-card/90 transition hover:shadow-md">
                      <CardContent className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <Avatar
                                src={seller.avatarUrl ?? undefined}
                                alt={seller.displayName}
                                fallback={initials || "TS"}
                                className="h-11 w-11"
                                fallbackClassName="text-sm font-semibold"
                              />
                              <span className={`absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-semibold ${rankClass} ${rankTextClass}`}>
                                #{rank}
                              </span>
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-foreground">{seller.displayName}</div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <span>{seller.completedDeals} deals</span>
                                <span>·</span>
                                <Star className="h-3 w-3 fill-warning text-warning" />
                                <span>{seller.ratingAvg.toFixed(1)}</span>
                              </div>
                              {seller.achievements && seller.achievements.length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {seller.achievements.slice(0, 2).map((achievement) => (
                                    <Badge key={achievement.code} variant="outline" className="text-[10px]">
                                      {achievement.title}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
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
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-3">
                <div className="text-sm font-medium text-foreground">Type</div>
                <div className="flex flex-wrap gap-2">
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
              </div>

              <div className="space-y-3">
                <div className="text-sm font-medium text-foreground">Category</div>
                <div className="flex flex-wrap gap-2">
                  <Button variant={category === "" ? "default" : "outline"} size="sm" onClick={() => { setCategory(""); setPage(1); }}>
                    All
                  </Button>
                  {["GAMES", "ACCOUNTS", "BOOSTING", "MENTORING", "GAME_CURRENCY", "OTHER"].map((categoryOption) => (
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
              </div>

              <div className="space-y-3">
                <div className="text-sm font-medium text-foreground">Tags</div>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Add tag"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag(tagInput);
                        setTagInput("");
                      }
                    }}
                    className="bg-muted"
                  />
                  <Button type="button" variant="outline" onClick={() => { addTag(tagInput); setTagInput(""); }}>
                    Add
                  </Button>
                </div>
                {selectedTags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedTags.map((tag) => (
                      <Badge key={tag} variant="muted" className="gap-1">
                        #{tag}
                        <button type="button" onClick={() => removeTag(tag)}>
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_TAGS.map((tag) => (
                    <Button
                      key={tag}
                      type="button"
                      size="sm"
                      variant={selectedTags.includes(tag) ? "default" : "outline"}
                      onClick={() => {
                        if (selectedTags.includes(tag)) {
                          removeTag(tag);
                        } else {
                          addTag(tag);
                        }
                      }}
                    >
                      #{tag}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 rounded-xl border border-border bg-muted/60 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">Price Range</span>
                  <span className="text-muted-foreground">{formatUsdValue(rangeMin)} - {formatUsdValue(rangeMax)}</span>
                </div>

                <div className="relative h-8">
                  <div className="absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-border" />
                  <div
                    className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-primary"
                    style={{ left: `${rangeLeft}%`, width: `${rangeWidth}%` }}
                  />
                  <input
                    type="range"
                    min={PRICE_MIN}
                    max={PRICE_MAX}
                    step={PRICE_STEP}
                    value={rangeMin}
                    onChange={(e) => {
                      const nextValue = Number(e.target.value);
                      setDraftPriceRange((prev) => [
                        Math.min(nextValue, prev[1]),
                        prev[1],
                      ]);
                    }}
                    onMouseUp={() =>
                      commitDraftPriceRange(draftPriceRange[0], draftPriceRange[1])
                    }
                    onTouchEnd={() =>
                      commitDraftPriceRange(draftPriceRange[0], draftPriceRange[1])
                    }
                    onKeyUp={() =>
                      commitDraftPriceRange(draftPriceRange[0], draftPriceRange[1])
                    }
                    className="range-dual range-dual-min absolute inset-0 z-20"
                  />
                  <input
                    type="range"
                    min={PRICE_MIN}
                    max={PRICE_MAX}
                    step={PRICE_STEP}
                    value={rangeMax}
                    onChange={(e) => {
                      const nextValue = Number(e.target.value);
                      setDraftPriceRange((prev) => [
                        prev[0],
                        Math.max(nextValue, prev[0]),
                      ]);
                    }}
                    onMouseUp={() =>
                      commitDraftPriceRange(draftPriceRange[0], draftPriceRange[1])
                    }
                    onTouchEnd={() =>
                      commitDraftPriceRange(draftPriceRange[0], draftPriceRange[1])
                    }
                    onKeyUp={() =>
                      commitDraftPriceRange(draftPriceRange[0], draftPriceRange[1])
                    }
                    className="range-dual range-dual-max absolute inset-0 z-30"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    value={rangeMin}
                    onChange={(e) => {
                      const value = Number(e.target.value) || 0;
                      const nextMin = Math.max(PRICE_MIN, Math.min(value, rangeMax));
                      setDraftPriceRange((prev) => [nextMin, prev[1]]);
                      commitDraftPriceRange(nextMin, rangeMax);
                    }}
                    className="bg-muted"
                  />
                  <Input
                    type="number"
                    step="0.01"
                    value={rangeMax}
                    onChange={(e) => {
                      const value = Number(e.target.value) || PRICE_MAX;
                      const nextMax = Math.min(PRICE_MAX, Math.max(value, rangeMin));
                      setDraftPriceRange((prev) => [prev[0], nextMax]);
                      commitDraftPriceRange(rangeMin, nextMax);
                    }}
                    className="bg-muted"
                  />
                </div>
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
                    setSort(e.target.value as "NEWEST" | "PRICE_ASC" | "PRICE_DESC" | "RATING" | "SALE");
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
                      e.target.value as "" | "GAMES" | "ACCOUNTS" | "BOOSTING" | "MENTORING" | "GAME_CURRENCY" | "OTHER",
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

                <Input
                  type="text"
                  placeholder="Tag and press Enter"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag(tagInput);
                      setTagInput("");
                    }
                  }}
                  className="bg-muted sm:col-span-2"
                />

                {selectedTags.length > 0 && (
                  <div className="flex flex-wrap gap-2 sm:col-span-2">
                    {selectedTags.map((tag) => (
                      <Badge key={tag} variant="muted" className="gap-1">
                        #{tag}
                        <button type="button" onClick={() => removeTag(tag)}>
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
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
              {items.map((listing) => (
                <MarketplaceListingCard key={listing.id} listing={listing} />
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
              <Button variant="outline" size="sm" onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))} disabled={page === 1}>
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {meta.page} of {meta.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((currentPage) => Math.min(meta.totalPages, currentPage + 1))}
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
