import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Clock, CreditCard, Package, ShieldCheck, XCircle } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { http } from "../api/http";
import { getSocket } from "../api/socket";
import { useAuth } from "../auth/AuthContext";
import { ConversationView } from "../components/chat/ConversationView";
import { ReviewSection } from "../components/review/ReviewSection";
import { Badge } from "../components/ui/Badge";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { DealStatusBadge } from "../components/profile/DealStatusBadge";
import { ErrorState, LoadingState } from "../components/ui/PageStates";

function extractErrorMessage(error: unknown, fallback: string) {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: { data?: { message?: unknown } } }).response
      ?.data?.message === "string"
  ) {
    return (
      (error as { response?: { data?: { message?: string } } }).response?.data
        ?.message ?? fallback
    );
  }

  return fallback;
}

type Deal = {
  id: string;
  status: "INITIATED" | "FUNDED" | "DELIVERED" | "COMPLETED" | "CANCELED";
  createdAt: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  listing: {
    id: string;
    title: string;
    price: number;
    type: "GOOD" | "SERVICE";
    status: string;
  };
  buyer: { id: string; displayName: string };
  seller: { id: string; displayName: string };
  fundedAt?: string;
  deliveredAt?: string;
  completedAt?: string;
  canceledAt?: string;
};

export function DealRoomPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [sellerConversationId, setSellerConversationId] = useState<
    string | null
  >(null);
  const [buyerConversationId, setBuyerConversationId] = useState<string | null>(
    null,
  );

  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadSellerConversation(dealData: Deal) {
    const res = await http.get(
      `/conversations/by-listing/${dealData.listingId}/by-buyer/${dealData.buyerId}`,
    );
    setSellerConversationId(res.data.id);
  }

  async function loadBuyerConversation(dealData: Deal) {
    const res = await http.post(`/conversations`, {
      listingId: dealData.listingId,
    });
    setBuyerConversationId(res.data.id);
  }

  async function load() {
    setErr(null);
    setLoading(true);

    try {
      const res = await http.get<Deal>(`/deals/${id}`);
      setDeal(res.data);

      if (user?.id === res.data.sellerId) {
        setBuyerConversationId(null);
        try {
          await loadSellerConversation(res.data);
        } catch {
          setSellerConversationId(null);
        }
      } else if (user?.id === res.data.buyerId) {
        setSellerConversationId(null);
        try {
          await loadBuyerConversation(res.data);
        } catch {
          setBuyerConversationId(null);
        }
      } else {
        setSellerConversationId(null);
        setBuyerConversationId(null);
      }
    } catch (error: unknown) {
      setErr(extractErrorMessage(error, "Failed to load deal"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!id || !user) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id]);

  useEffect(() => {
    if (!user || !deal) return;

    const socket = getSocket();

    const handleDealUpdate = (updatedDeal: Deal) => {
      if (updatedDeal.id !== deal.id) return;
      setDeal(updatedDeal);
    };

    socket.on("deal:update", handleDealUpdate);

    return () => {
      socket.off("deal:update", handleDealUpdate);
    };
  }, [deal, user]);

  async function act(fn: () => Promise<unknown>) {
    setActionErr(null);
    setBusy(true);

    try {
      await fn();
      await load();
    } catch (error: unknown) {
      setActionErr(extractErrorMessage(error, "Action failed"));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingState width="max-w-6xl" />;
  if (err || !deal) return <ErrorState width="max-w-6xl" message={err ?? "Not found"} />;

  const isBuyer = user?.id === deal.buyerId;
  const isSeller = user?.id === deal.sellerId;
  const conversationId = isSeller ? sellerConversationId : buyerConversationId;
  const role = isBuyer ? "Buyer" : isSeller ? "Seller" : "Observer";
  const counterpartyName = isBuyer ? deal.seller.displayName : deal.buyer.displayName;

  const statusDescription =
    deal.status === "INITIATED"
      ? "Waiting for payment"
      : deal.status === "FUNDED"
        ? "Seller is preparing delivery"
        : deal.status === "DELIVERED"
          ? "Waiting for buyer confirmation"
          : deal.status === "COMPLETED"
            ? "Deal completed"
            : "Deal canceled";

  const amountLabel = `${(deal.listing.price / 100).toFixed(2)} Kč`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <Link
        to="/deals"
        className="mb-4 inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to deals
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-slate-900">Deal Status</div>
                  <div className="mt-1 text-sm text-slate-500">Escrow-safe flow for this listing transaction.</div>
                </div>
                <DealStatusBadge status={deal.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="line-clamp-1 text-base font-semibold text-slate-900">{deal.listing.title ?? "Listing"}</div>
                <div className="mt-1 text-sm text-slate-600">{amountLabel} · {deal.listing.type}</div>
              </div>

              <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                <Clock className="h-4 w-4 shrink-0" />
                <span>{statusDescription}</span>
              </div>

              {deal.status !== "COMPLETED" && deal.status !== "CANCELED" && (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  <ShieldCheck className="h-4 w-4" />
                  Protected by escrow
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-1">
              <div className="font-semibold text-slate-900">Actions</div>
              <div className="text-xs text-slate-500">Available actions depend on your role and current deal status.</div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {isBuyer && deal.status === "INITIATED" && (
                  <Button disabled={busy} onClick={() => act(() => http.post(`/deals/${deal.id}/fund`))}>
                    <CreditCard className="h-4 w-4" />
                    {busy ? "Processing..." : "Fund escrow"}
                  </Button>
                )}

                {isSeller && deal.status === "FUNDED" && (
                  <Button disabled={busy} onClick={() => act(() => http.post(`/deals/${deal.id}/delivered`))}>
                    <Package className="h-4 w-4" />
                    {busy ? "Processing..." : "Mark as delivered"}
                  </Button>
                )}

                {isBuyer && deal.status === "DELIVERED" && (
                  <Button disabled={busy} onClick={() => act(() => http.post(`/deals/${deal.id}/complete`))}>
                    <CheckCircle2 className="h-4 w-4" />
                    {busy ? "Processing..." : "Confirm & complete"}
                  </Button>
                )}

                {isSeller && (deal.status === "INITIATED" || deal.status === "FUNDED") && (
                  <Button variant="outline" disabled={busy} onClick={() => act(() => http.post(`/deals/${deal.id}/cancel`))}>
                    <XCircle className="h-4 w-4" />
                    {busy ? "Processing..." : "Cancel (refund)"}
                  </Button>
                )}
              </div>

              <div className="mt-2 text-xs text-slate-500">{statusDescription}</div>

              {actionErr && <div className="text-sm text-red-600">{actionErr}</div>}
            </CardContent>
          </Card>

          {isBuyer && deal.status === "COMPLETED" && (
            <ReviewSection dealId={deal.id} />
          )}

          {conversationId ? (
            <ConversationView
              conversation={{
                id: conversationId,
                listingId: deal.listingId,
                buyerId: deal.buyerId,
                sellerId: deal.sellerId,
                createdAt: deal.createdAt,
                listing: {
                  id: deal.listing.id,
                  title: deal.listing.title,
                  price: deal.listing.price,
                  type: deal.listing.type,
                },
                buyer: deal.buyer,
                seller: deal.seller,
              }}
            />
          ) : (
            <Card>
              <CardContent className="text-sm text-slate-500">Conversation not found yet.</CardContent>
            </Card>
          )}
        </div>

      <div className="space-y-4 lg:col-span-1">
        <Card>
          <CardHeader className="pb-2">
            <div className="text-sm font-semibold text-slate-900">Deal info</div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="line-clamp-2 text-sm font-medium text-slate-900">{deal.listing.title}</div>
            <Badge variant="outline" className="text-[10px]">
              {deal.listing.type}
            </Badge>
            <div className="border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Amount</span>
                <span className="font-semibold text-slate-900">{amountLabel}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="text-sm font-semibold text-slate-900">Participants</div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Your role</span>
              <Badge variant="outline" className="text-[10px]">
                {role}
              </Badge>
            </div>
            <div className="border-t border-slate-100 pt-3">
              <div className="text-slate-500">Counterparty</div>
              <div className="mt-1 font-medium text-slate-900">{counterpartyName}</div>
              <div className="mt-2 text-xs text-slate-500">
                Buyer: {deal.buyer.displayName} · Seller: {deal.seller.displayName}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="text-sm font-semibold text-slate-900">Timeline</div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Created</span>
              <span>{new Date(deal.createdAt).toLocaleString()}</span>
            </div>
            {deal.fundedAt && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Funded</span>
                <span>{new Date(deal.fundedAt).toLocaleString()}</span>
              </div>
            )}
            {deal.deliveredAt && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Delivered</span>
                <span>{new Date(deal.deliveredAt).toLocaleString()}</span>
              </div>
            )}
            {deal.completedAt && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Completed</span>
                <span>{new Date(deal.completedAt).toLocaleString()}</span>
              </div>
            )}
            {deal.canceledAt && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Canceled</span>
                <span>{new Date(deal.canceledAt).toLocaleString()}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
}
