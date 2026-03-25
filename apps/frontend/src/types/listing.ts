export type ListingCategory =
  | "GAMES"
  | "ACCOUNTS"
  | "BOOSTING"
  | "MENTORING"
  | "GAME_CURRENCY"
  | "OTHER";

export type Listing = {
  id: string;
  title: string;
  description: string;
  imageUrl?: string | null;
  stockQuantity?: number | null;
  price: number;
  category: ListingCategory;
  tags: string[];
  effectivePrice?: number;
  discountedPrice?: number;
  referencePrice30d?: number;
  isOnSale?: boolean;
  salePercent?: number | null;
  saleStartsAt?: string | null;
  saleEndsAt?: string | null;
  status: "ACTIVE" | "ARCHIVED";
  type: "GOOD" | "SERVICE";
  createdAt: string;
  seller: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
    ratingAvg: number;
    ratingCount: number;
    achievements?: Array<{
      unlockedAt: string;
      definition: {
        code: string;
        title: string;
      };
    }>;
  };
};

export type PriceHistoryPoint = {
  price: number;
  createdAt: string;
  isSale: boolean;
  salePercent?: number | null;
};

export type ListingDiscountPolicy = {
  minBasePrice30d: number;
  allowedMinBasePrice: number;
  allowedMaxBasePrice: number;
  discountPercentMin: number;
  discountPercentMax: number;
  tolerancePercent: number;
};

export type PriceHistoryStats = {
  minPriceOnSales: {
    price: number;
    createdAt: string;
    salePercent?: number | null;
  } | null;
  minPriceNoSales: {
    price: number;
    createdAt: string;
  } | null;
  discountPolicy: ListingDiscountPolicy;
};

export type PriceHistoryResponse = {
  period: "30d" | "all";
  points: PriceHistoryPoint[];
  stats: PriceHistoryStats;
};
