import { useEffect, useReducer, useState } from "react";
import { http } from "../api/http";
import { Link } from "react-router-dom";
import { Search, SlidersHorizontal, Trophy, Star, X } from "lucide-react";
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

type ListingTypeFilter = "" | "GOOD" | "SERVICE";
type ListingCategoryFilter = "" | "GAMES" | "ACCOUNTS" | "BOOSTING" | "MENTORING" | "GAME_CURRENCY" | "OTHER";
type ListingSortFilter = "NEWEST" | "PRICE_ASC" | "PRICE_DESC" | "RATING" | "SALE";

type ListingsFiltersState = {
  search: string;
  type: ListingTypeFilter;
  category: ListingCategoryFilter;
  selectedTags: string[];
  tagInput: string;
  minPrice: string;
  maxPrice: string;
  draftPriceRange: [number, number];
  minRating: string;
  sort: ListingSortFilter;
  page: number;
};

type ListingsFiltersAction =
  | { type: "setSearch"; value: string }
  | { type: "setType"; value: ListingTypeFilter }
  | { type: "setCategory"; value: ListingCategoryFilter }
  | { type: "setSelectedTags"; value: string[] }
  | { type: "setTagInput"; value: string }
  | { type: "setMinPrice"; value: string }
  | { type: "setMaxPrice"; value: string }
  | { type: "setDraftPriceRange"; value: [number, number] }
  | { type: "setMinRating"; value: string }
  | { type: "setSort"; value: ListingSortFilter }
  | { type: "setPage"; value: number }
  | { type: "resetFilters" };

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

const SUGGESTED_TAGS = ["dota", "cs2", "wow", "gta5", "poe"];
const PRICE_MIN = 0;
const PRICE_MAX = 2000;
const PRICE_STEP = 5;
const RATING_OPTIONS = ["", "4.5", "4.0", "3.5", "3.0"] as const;

const initialFiltersState: ListingsFiltersState = {
  search: "",
  type: "",
  category: "",
  selectedTags: [],
  tagInput: "",
  minPrice: "",
  maxPrice: "",
  draftPriceRange: [PRICE_MIN, PRICE_MAX],
  minRating: "",
  sort: "NEWEST",
  page: 1,
};

function listingsFiltersReducer(
  state: ListingsFiltersState,
  action: ListingsFiltersAction,
): ListingsFiltersState {
  switch (action.type) {
    case "setSearch":
      return { ...state, search: action.value, page: 1 };
    case "setType":
      return { ...state, type: action.value, page: 1 };
    case "setCategory":
      return { ...state, category: action.value, page: 1 };
    case "setSelectedTags":
      return { ...state, selectedTags: action.value, page: 1 };
    case "setTagInput":
      return { ...state, tagInput: action.value };
    case "setMinPrice":
      return { ...state, minPrice: action.value, page: 1 };
    case "setMaxPrice":
      return { ...state, maxPrice: action.value, page: 1 };
    case "setDraftPriceRange":
      return { ...state, draftPriceRange: action.value };
    case "setMinRating":
      return { ...state, minRating: action.value, page: 1 };
    case "setSort":
      return { ...state, sort: action.value, page: 1 };
    case "setPage":
      return { ...state, page: action.value };
    case "resetFilters":
      return {
        ...initialFiltersState,
        page: 1,
      };
    default:
      return state;
  }
}

export function ListingsPage() {
  const [items, setItems] = useState<Listing[]>([]);
  const [weeklyTopSellers, setWeeklyTopSellers] = useState<TopSeller[]>([]);
  const [listingsLoading, setListingsLoading] = useState(true);
  const [listingsErr, setListingsErr] = useState<string | null>(null);
  const [meta, setMeta] = useState<Meta>({ total: 0, page: 1, limit: 12, totalPages: 1 });
  const [filtersState, dispatchFilters] = useReducer(
    listingsFiltersReducer,
    initialFiltersState,
  );
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

  const {
    search,
    type,
    category,
    selectedTags,
    tagInput,
    minPrice,
    maxPrice,
    draftPriceRange,
    minRating,
    sort,
    page,
  } = filtersState;

  function setSearch(value: string) {
    dispatchFilters({ type: "setSearch", value });
  }

  function setType(value: ListingTypeFilter) {
    dispatchFilters({ type: "setType", value });
  }

  function setCategory(value: ListingCategoryFilter) {
    dispatchFilters({ type: "setCategory", value });
  }

  function setTagInput(value: string) {
    dispatchFilters({ type: "setTagInput", value });
  }

  function setMinPrice(value: string) {
    dispatchFilters({ type: "setMinPrice", value });
  }

  function setMaxPrice(value: string) {
    dispatchFilters({ type: "setMaxPrice", value });
  }

  function setDraftPriceRange(
    value: [number, number] | ((prev: [number, number]) => [number, number]),
  ) {
    const nextValue =
      typeof value === "function" ? value(filtersState.draftPriceRange) : value;
    dispatchFilters({ type: "setDraftPriceRange", value: nextValue });
  }

  function setMinRating(value: string) {
    dispatchFilters({ type: "setMinRating", value });
  }

  function setSort(value: ListingSortFilter) {
    dispatchFilters({ type: "setSort", value });
  }

  function setPage(value: number | ((currentPage: number) => number)) {
    const nextValue =
      typeof value === "function" ? value(filtersState.page) : value;
    dispatchFilters({ type: "setPage", value: nextValue });
  }
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
    dispatchFilters({
      type: "setSelectedTags",
      value: [...selectedTags, normalized].slice(0, 8),
    });
  }

  function removeTag(tag: string) {
    dispatchFilters({
      type: "setSelectedTags",
      value: selectedTags.filter((item) => item !== tag),
    });
  }

  function resetFilters() {
    dispatchFilters({ type: "resetFilters" });
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
                const rankCircleClass =
                  rank === 1
                    ? "bg-gradient-to-br from-gold to-gold-deep"
                    : rank === 2
                      ? "bg-gradient-to-br from-silver to-silver-deep"
                      : "bg-gradient-to-br from-bronze to-bronze-deep";
                const rankTextClass =
                  rank === 1
                    ? "text-gold-foreground"
                    : rank === 2
                      ? "text-silver-foreground"
                      : "text-bronze-foreground";
                const initials = seller.displayName
                  .split(" ")
                  .map((part) => part[0]?.toUpperCase() ?? "")
                  .join("")
                  .slice(0, 2);

                return (
                  <Link key={seller.id} to={`/users/${seller.id}`} className="block">
                    <Card className="border-warning/40 bg-card/95 transition hover:shadow-md">
                      <CardContent className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <span
                              className={`relative inline-flex h-8 min-w-8 items-center justify-center rounded-full px-1 text-sm font-bold ${rankTextClass}`}
                            >
                              <span className={`absolute inset-0 rounded-full ${rankCircleClass} opacity-70`} aria-hidden="true" />
                              <span className="relative">#{rank}</span>
                            </span>
                            <Avatar
                              src={seller.avatarUrl ?? undefined}
                              alt={seller.displayName}
                              fallback={initials || "TS"}
                              className="h-[52px] w-[52px]"
                              fallbackClassName="text-sm font-semibold"
                            />
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
                  {["GAMES", "ACCOUNTS", "BOOSTING", "GAME_CURRENCY", "OTHER"].map((categoryOption) => (
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

              <div className="space-y-3">
                <div className="text-sm font-medium text-foreground">Minimum Rating</div>
                <div className="flex flex-wrap gap-2">
                  {RATING_OPTIONS.map((ratingOption) => {
                    const isActive = minRating === ratingOption;

                    return (
                      <Button
                        key={ratingOption || "any"}
                        variant={isActive ? "default" : "outline"}
                        size="sm"
                        className="gap-1.5"
                        onClick={() => {
                          setMinRating(ratingOption);
                          setPage(1);
                        }}
                      >
                        <Star className={`h-3.5 w-3.5 ${isActive ? "fill-warning text-warning" : "text-muted-foreground"}`} />
                        {ratingOption ? `${ratingOption}+` : "Any"}
                      </Button>
                    );
                  })}
                </div>
              </div>

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
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search listings..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    className="bg-muted pl-9"
                  />
                </div>
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

                <div className="space-y-2 sm:col-span-2">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Minimum rating</div>
                  <div className="flex flex-wrap gap-2">
                    {RATING_OPTIONS.map((ratingOption) => {
                      const isActive = minRating === ratingOption;

                      return (
                        <Button
                          key={`mobile-${ratingOption || "any"}`}
                          variant={isActive ? "default" : "outline"}
                          size="sm"
                          className="gap-1.5"
                          onClick={() => {
                            setMinRating(ratingOption);
                            setPage(1);
                          }}
                        >
                          <Star className={`h-3.5 w-3.5 ${isActive ? "fill-warning text-warning" : "text-muted-foreground"}`} />
                          {ratingOption ? `${ratingOption}+` : "Any"}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {hasActiveFilters && (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    Active filters:
                  </div>
                  {type && (
                    <Badge variant="muted" className="gap-1">
                      {type === "GOOD" ? "Goods" : "Services"}
                      <button type="button" onClick={() => setType("")}> 
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  {category && (
                    <Badge variant="muted" className="gap-1">
                      {category.replaceAll("_", " ")}
                      <button type="button" onClick={() => setCategory("")}> 
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  {(minPrice || maxPrice) && (
                    <Badge variant="muted" className="gap-1">
                      {`${formatUsdValue(minPrice ? Number(minPrice) : PRICE_MIN)} - ${formatUsdValue(maxPrice ? Number(maxPrice) : PRICE_MAX)}`}
                      <button
                        type="button"
                        onClick={() => {
                          setMinPrice("");
                          setMaxPrice("");
                          setDraftPriceRange([PRICE_MIN, PRICE_MAX]);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  {minRating && (
                    <Badge variant="muted" className="gap-1">
                      {`${minRating}+ rating`}
                      <button type="button" onClick={() => setMinRating("")}> 
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                </div>
              )}

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
