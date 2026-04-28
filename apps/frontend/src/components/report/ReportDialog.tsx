import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { http } from "../../api/http";
import { extractHttpErrorMessage } from "../../utils/httpError";
import { Button } from "../ui/Button";
import { Card, CardContent, CardHeader } from "../ui/Card";
import { Input } from "../ui/Input";
import { Textarea } from "../ui/Textarea";

type ReportTargetType = "LISTING" | "USER" | "REVIEW" | "DEAL" | "MESSAGE";

type ProfileListing = {
  id: string;
  title: string;
};

type PublicProfileResponse = {
  listings: ProfileListing[];
};

type DealItem = {
  id: string;
  listing: {
    id: string;
    title: string;
  };
  buyer: {
    id: string;
    displayName: string;
  };
  seller: {
    id: string;
    displayName: string;
  };
};

type ConversationItem = {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
};

type MessageItem = {
  id: string;
  text: string;
  createdAt: string;
  sender: {
    id: string;
    displayName: string;
  };
};

type Props = {
  open: boolean;
  title: string;
  reportedUserId: string;
  defaultTargetType?: ReportTargetType;
  defaultTargetId?: string;
  onClose: () => void;
  onSubmitted?: () => void;
};

export function ReportDialog({
  open,
  title,
  reportedUserId,
  defaultTargetType = "USER",
  defaultTargetId,
  onClose,
  onSubmitted,
}: Props) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targetType, setTargetType] = useState<ReportTargetType>(defaultTargetType);

  const [listingOptions, setListingOptions] = useState<ProfileListing[]>([]);
  const [dealOptions, setDealOptions] = useState<DealItem[]>([]);
  const [conversationOptions, setConversationOptions] = useState<ConversationItem[]>([]);
  const [messageOptions, setMessageOptions] = useState<MessageItem[]>([]);

  const [selectedListingId, setSelectedListingId] = useState(defaultTargetType === "LISTING" ? defaultTargetId ?? "" : "");
  const [selectedDealId, setSelectedDealId] = useState(defaultTargetType === "DEAL" ? defaultTargetId ?? "" : "");
  const [selectedMessageId, setSelectedMessageId] = useState(defaultTargetType === "MESSAGE" ? defaultTargetId ?? "" : "");

  const selectedDeal = useMemo(
    () => dealOptions.find((deal) => deal.id === selectedDealId) ?? null,
    [dealOptions, selectedDealId],
  );

  const selectedConversation = useMemo(() => {
    if (!selectedDeal) return null;

    return (
      conversationOptions.find(
        (conversation) =>
          conversation.listingId === selectedDeal.listing.id &&
          conversation.buyerId === selectedDeal.buyer.id &&
          conversation.sellerId === selectedDeal.seller.id,
      ) ?? null
    );
  }, [conversationOptions, selectedDeal]);

  const resolvedTargetId = useMemo(() => {
    if (targetType === "USER") return reportedUserId;
    if (targetType === "LISTING") return selectedListingId;
    if (targetType === "DEAL") return selectedDealId;
    if (targetType === "MESSAGE") return selectedMessageId;
    return "";
  }, [reportedUserId, selectedDealId, selectedListingId, selectedMessageId, targetType]);

  useEffect(() => {
    if (!open) {
      setReason("");
      setDetails("");
      setError(null);
      setSubmitting(false);
      setLoadingTargets(false);
      setTargetType(defaultTargetType);
      setSelectedListingId(defaultTargetType === "LISTING" ? defaultTargetId ?? "" : "");
      setSelectedDealId(defaultTargetType === "DEAL" ? defaultTargetId ?? "" : "");
      setSelectedMessageId(defaultTargetType === "MESSAGE" ? defaultTargetId ?? "" : "");
      setMessageOptions([]);
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [defaultTargetId, defaultTargetType, open, onClose]);

  useEffect(() => {
    if (!open) return;
    if (!["LISTING", "DEAL", "MESSAGE"].includes(targetType)) return;

    let cancelled = false;
    setLoadingTargets(true);
    setError(null);

    (async () => {
      try {
        if (targetType === "LISTING") {
          const profileResponse = await http.get<PublicProfileResponse>(`/users/${reportedUserId}`);
          if (cancelled) return;

          const listings = profileResponse.data.listings ?? [];
          setListingOptions(listings);

          if (!selectedListingId || !listings.some((listing) => listing.id === selectedListingId)) {
            setSelectedListingId(defaultTargetType === "LISTING" && defaultTargetId ? defaultTargetId : listings[0]?.id ?? "");
          }
        }

        if (targetType === "DEAL" || targetType === "MESSAGE") {
          const [dealsResponse, conversationsResponse] = await Promise.all([
            http.get<DealItem[]>("/deals/me"),
            http.get<ConversationItem[]>("/conversations/me"),
          ]);

          if (cancelled) return;

          const sharedDeals = dealsResponse.data.filter(
            (deal) => deal.buyer.id === reportedUserId || deal.seller.id === reportedUserId,
          );

          setDealOptions(sharedDeals);
          setConversationOptions(conversationsResponse.data);

          if (!selectedDealId || !sharedDeals.some((deal) => deal.id === selectedDealId)) {
            setSelectedDealId(defaultTargetType === "DEAL" && defaultTargetId ? defaultTargetId : sharedDeals[0]?.id ?? "");
          }
        }
      } catch (e: unknown) {
        if (cancelled) return;
        setError(extractHttpErrorMessage(e, "Failed to load report targets"));
      } finally {
        if (!cancelled) {
          setLoadingTargets(false);
        }
      }
    })().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [defaultTargetId, defaultTargetType, open, reportedUserId, targetType]);

  useEffect(() => {
    if (!open || targetType !== "MESSAGE") {
      setMessageOptions([]);
      if (targetType !== "MESSAGE") {
        setSelectedMessageId("");
      }
      return;
    }

    if (!selectedConversation?.id) {
      setMessageOptions([]);
      setSelectedMessageId("");
      return;
    }

    let cancelled = false;
    setLoadingTargets(true);
    setError(null);

    http
      .get<MessageItem[]>(`/conversations/${selectedConversation.id}/messages`)
      .then((response) => {
        if (cancelled) return;

        const messages = response.data ?? [];
        setMessageOptions(messages);

        if (!selectedMessageId || !messages.some((message) => message.id === selectedMessageId)) {
          setSelectedMessageId(defaultTargetType === "MESSAGE" && defaultTargetId ? defaultTargetId : messages[messages.length - 1]?.id ?? "");
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(extractHttpErrorMessage(e, "Failed to load messages for selected deal"));
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingTargets(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [defaultTargetId, defaultTargetType, open, selectedConversation?.id, selectedMessageId, targetType]);

  if (!open) return null;

  async function submitReport() {
    const normalizedReason = reason.trim();
    const normalizedDetails = details.trim();

    if (normalizedReason.length < 8) {
      setError("Report reason should be at least 8 characters");
      return;
    }

    if (!resolvedTargetId) {
      setError("Please select a valid report target");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await http.post("/reports", {
        targetType,
        targetId: resolvedTargetId,
        reason: normalizedReason,
        details: normalizedDetails.length > 0 ? normalizedDetails : undefined,
      });

      onSubmitted?.();
      onClose();
    } catch (e: unknown) {
      setError(extractHttpErrorMessage(e, "Failed to send report"));
    } finally {
      setSubmitting(false);
    }
  }

  const overlay = (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <Card className="w-full max-w-lg" onClick={(event) => event.stopPropagation()}>
        <CardHeader>
          <div className="text-lg font-semibold text-foreground">{title}</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Send details to moderators. They will review this report.
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">Target type</label>
            <select
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground"
              value={targetType}
              onChange={(event) => setTargetType(event.target.value as ReportTargetType)}
              disabled={submitting || loadingTargets}
            >
              <option value="USER">User</option>
              <option value="LISTING">Listing</option>
              <option value="DEAL">Deal</option>
              <option value="MESSAGE">Message</option>
            </select>
          </div>

          {targetType === "LISTING" && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">Listing</label>
              <select
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground"
                value={selectedListingId}
                onChange={(event) => setSelectedListingId(event.target.value)}
                disabled={submitting || loadingTargets || listingOptions.length === 0}
              >
                {listingOptions.length === 0 && <option value="">No listings found</option>}
                {listingOptions.map((listing) => (
                  <option key={listing.id} value={listing.id}>{listing.title}</option>
                ))}
              </select>
            </div>
          )}

          {(targetType === "DEAL" || targetType === "MESSAGE") && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">Deal</label>
              <select
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground"
                value={selectedDealId}
                onChange={(event) => setSelectedDealId(event.target.value)}
                disabled={submitting || loadingTargets || dealOptions.length === 0}
              >
                {dealOptions.length === 0 && <option value="">No shared deals found</option>}
                {dealOptions.map((deal) => (
                  <option key={deal.id} value={deal.id}>
                    {deal.listing.title} - {deal.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {targetType === "MESSAGE" && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">Message</label>
              <select
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground"
                value={selectedMessageId}
                onChange={(event) => setSelectedMessageId(event.target.value)}
                disabled={
                  submitting ||
                  loadingTargets ||
                  !selectedConversation ||
                  messageOptions.length === 0
                }
              >
                {!selectedConversation && <option value="">No conversation for selected deal</option>}
                {selectedConversation && messageOptions.length === 0 && <option value="">No messages in conversation</option>}
                {messageOptions.map((message) => {
                  const previewText = message.text.trim().length > 0 ? message.text : "[attachment]";
                  const preview = previewText.length > 60 ? `${previewText.slice(0, 57)}...` : previewText;
                  return (
                    <option key={message.id} value={message.id}>
                      {message.sender.displayName}: {preview}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">Reason</label>
            <Input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Describe the issue"
              maxLength={300}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">Details (optional)</label>
            <Textarea
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              placeholder="Add context for moderation"
              rows={4}
              maxLength={2000}
            />
          </div>

          {error && <div className="text-sm text-destructive">{error}</div>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="button" onClick={() => submitReport().catch(() => {})} disabled={submitting}>
              {submitting ? "Sending..." : "Send report"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return createPortal(overlay, document.body);
}
