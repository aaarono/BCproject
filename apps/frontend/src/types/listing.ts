export type Listing = {
  id: string;
  title: string;
  description: string;
  price: number;
  type: "GOOD" | "SERVICE";
  createdAt: string;
  seller: {
    id: string;
    displayName: string;
    ratingAvg: number;
    ratingCount: number;
  };
};
