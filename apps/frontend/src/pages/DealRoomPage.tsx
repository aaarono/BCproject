import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Clock, CreditCard, Package, ShieldCheck, XCircle } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { http } from "../api/http";
import { getSocket } from "../api/socket";
import { useAuth } from "../auth/AuthContext";
import { ConversationView } from "../components/chat/ConversationView";
import { ReviewSection } from "../components/review/ReviewSection";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { DealStatusBadge } from "../components/profile/DealStatusBadge";
import { ErrorState, LoadingState } from "../components/ui/PageStates";
import { formatUsdFromCents } from "../lib/currency";

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
  canceledByActor?: "BUYER" | "SELLER" | "SYSTEM" | null;
  createdAt: string;
  expiresAt?: string | null;
  listingId: string;
  buyerId: string;
  sellerId: string;
  quantity: number;
  unitPriceSnapshot: number;
  totalAmountSnapshot: number;
  listing: {
    id: string;
    title: string;
    price: number;
    imageUrl?: string | null;
    type: "GOOD" | "SERVICE";
    status: string;
  };
  buyer: { id: string; displayName: string; avatarUrl?: string | null };
  seller: { id: string; displayName: string; avatarUrl?: string | null };
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

  function formatExpiration(expiresAt?: string | null) {
    if (!expiresAt) return null;
    return `Auto-cancel at ${new Date(expiresAt).toLocaleString()}`;
  }

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

  const statusDescription =
    deal.status === "INITIATED"
      ? "Waiting for payment"
      : deal.status === "FUNDED"
        ? "Seller is preparing delivery"
        : deal.status === "DELIVERED"
          ? "Waiting for buyer confirmation"
          : deal.status === "COMPLETED"
            ? "Deal completed"
            : deal.canceledByActor === "BUYER"
              ? "Deal canceled by buyer"
              : deal.canceledByActor === "SELLER"
                ? "Deal canceled by seller"
                : deal.canceledByActor === "SYSTEM"
                  ? "Deal auto-canceled by timeout"
                  : "Deal canceled";

  const unitLabel = formatUsdFromCents(deal.unitPriceSnapshot);
  const expirationLabel = formatExpiration(deal.expiresAt);
  const flowSteps: Array<Deal["status"]> = ["INITIATED", "FUNDED", "DELIVERED", "COMPLETED"];
  const stepIndexMap: Record<Deal["status"], number> = {
    INITIATED: 0,
    FUNDED: 1,
    DELIVERED: 2,
    COMPLETED: 3,
    CANCELED: 0,
  };
  const currentStepIndex = stepIndexMap[deal.status];
  const canFundEscrow = isBuyer && deal.status === "INITIATED";
  const canMarkDelivered = isSeller && deal.status === "FUNDED";
  const canConfirmComplete = isBuyer && deal.status === "DELIVERED";
  const canCancelDeal = (isSeller || isBuyer) && (deal.status === "INITIATED" || deal.status === "FUNDED");
  const hasAvailableActions = canFundEscrow || canMarkDelivered || canConfirmComplete || canCancelDeal;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <Link
        to="/deals"
        className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
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
                  <div className="text-lg font-semibold text-foreground">Deal</div>
                  <div className="mt-1 text-sm text-muted-foreground">Escrow-protected transaction status and actions.</div>
                </div>
                <DealStatusBadge status={deal.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <div className="line-clamp-1 text-base font-semibold text-foreground">{deal.listing.title ?? "Listing"}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {deal.listing.type} · {unitLabel} × {deal.quantity}
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4 shrink-0" />
                <span>{statusDescription}</span>
              </div>

              {(deal.status === "INITIATED" || deal.status === "FUNDED") && expirationLabel && (
                <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  <Clock className="h-4 w-4" />
                  <span>{expirationLabel}</span>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Deal progress</span>
                  <span>{deal.status}</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {flowSteps.map((step, index) => {
                    const isCompleted = deal.status !== "CANCELED" && index <= currentStepIndex;
                    return (
                      <div key={step} className="space-y-1">
                        <div className={`h-2 rounded-full ${isCompleted ? "bg-primary" : "bg-muted"}`} />
                        <div className="text-[10px] text-muted-foreground">{step.toLowerCase()}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2 border-t border-border pt-4">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Actions</div>
                <div className="flex flex-wrap gap-2">
                  {canFundEscrow && (
                    <Button disabled={busy} onClick={() => act(() => http.post(`/deals/${deal.id}/fund`))}>
                      <CreditCard className="h-4 w-4" />
                      {busy ? "Processing..." : "Fund escrow"}
                    </Button>
                  )}

                  {canMarkDelivered && (
                    <Button disabled={busy} onClick={() => act(() => http.post(`/deals/${deal.id}/delivered`))}>
                      <Package className="h-4 w-4" />
                      {busy ? "Processing..." : "Mark as delivered"}
                    </Button>
                  )}

                  {canConfirmComplete && (
                    <Button disabled={busy} onClick={() => act(() => http.post(`/deals/${deal.id}/complete`))}>
                      <CheckCircle2 className="h-4 w-4" />
                      {busy ? "Processing..." : "Confirm & complete"}
                    </Button>
                  )}

                  {canCancelDeal && (
                    <Button variant="outline" disabled={busy} onClick={() => act(() => http.post(`/deals/${deal.id}/cancel`))}>
                      <XCircle className="h-4 w-4" />
                      {busy ? "Processing..." : "Cancel deal"}
                    </Button>
                  )}
                </div>

                {!hasAvailableActions && (
                  <div className="text-xs text-muted-foreground">No actions available for the current status.</div>
                )}

                {actionErr && <div className="text-sm text-destructive">{actionErr}</div>}
              </div>

              {deal.status !== "COMPLETED" && deal.status !== "CANCELED" && (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  <ShieldCheck className="h-4 w-4" />
                  Protected by escrow
                </div>
              )}
            </CardContent>
          </Card>


          {isBuyer && deal.status === "COMPLETED" && (
            <ReviewSection dealId={deal.id} />
          )}
        </div>

        <div className="space-y-4 lg:col-span-1">
          {conversationId ? (
            <ConversationView
              heightClassName="h-[calc(100vh-12rem)] min-h-[320px] max-h-[785px]"
              conversation={{
                id: conversationId,
                listingId: deal.listingId,
                buyerId: deal.buyerId,
                sellerId: deal.sellerId,
                createdAt: deal.createdAt,
                listing: {
                  id: deal.listing.id,
                  title: deal.listing.title,
                  price: deal.unitPriceSnapshot,
                  imageUrl: deal.listing.imageUrl,
                  type: deal.listing.type,
                },
                buyer: deal.buyer,
                seller: deal.seller,
              }}
            />
          ) : (
            <Card>
              <CardContent className="text-sm text-muted-foreground">Conversation not found yet.</CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
