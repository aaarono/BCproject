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
};
