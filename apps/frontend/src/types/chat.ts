export type Conversation = {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  createdAt: string;
  listing?: {
    id: string;
    title: string;
    price: number;
    type: "GOOD" | "SERVICE";
  };
  buyer?: { id: string; displayName: string };
  seller?: { id: string; displayName: string };
};

export type Message = {
  id: string;
  text: string;
  senderId: string;
  createdAt: string;
  sender: { id: string; displayName: string };
};
