import {
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChevronLeft, ChevronRight, ExternalLink, Paperclip, Send, X } from "lucide-react";
import { Link } from "react-router-dom";
import { http } from "../../api/http";
import { useAuth } from "../../auth/AuthContext";
import { getSocket } from "../../api/socket";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { Avatar } from "../ui/Avatar";
import { formatUsdFromCents } from "../../lib/currency";

function extractErrorMessage(error: unknown, fallback: string) {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: { data?: { message?: unknown } } }).response?.data
      ?.message === "string"
  ) {
    return (
      (error as { response?: { data?: { message?: string } } }).response?.data
        ?.message ?? fallback
    );
  }

  return fallback;
}

type Message = {
  id: string;
  conversationId: string;
  text: string;
  mediaUrl?: string | null;
  mediaType?: "IMAGE" | "VIDEO" | null;
  mediaItems?: Array<{ mediaUrl: string; mediaType: "IMAGE" | "VIDEO" }> | null;
  senderId: string;
  createdAt: string;
  sender: {
    id: string;
    displayName: string;
  };
};

type Conversation = {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  createdAt: string;
  listing: {
    id: string;
    title: string;
    price: number;
    salePercent?: number | null;
    saleStartsAt?: string | null;
    saleEndsAt?: string | null;
    type: "GOOD" | "SERVICE";
  };
  buyer: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
  };
  seller: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
  };
};

type ActiveDeal = {
  id: string;
};

type MediaItem = {
  mediaUrl: string;
  mediaType: "IMAGE" | "VIDEO";
};

type PendingMedia = {
  id: string;
  file: File;
  mediaType: "IMAGE" | "VIDEO";
  previewUrl: string;
};

type OlderMessagesCursor = {
  beforeCreatedAt: string;
  beforeId: string;
};

type OlderMessagesResponse = {
  items: Message[];
  hasMore: boolean;
  nextCursor: OlderMessagesCursor | null;
};

const MESSAGE_PAGE_SIZE = 50;

function getApiOrigin() {
  const baseURL = http.defaults.baseURL;
  if (!baseURL || typeof baseURL !== "string") {
    return null;
  }

  try {
    return new URL(baseURL).origin;
  } catch {
    return null;
  }
}

function normalizeMediaUrl(mediaUrl: string) {
  const apiOrigin = getApiOrigin();

  try {
    const parsed = new URL(mediaUrl, window.location.origin);

    if (parsed.pathname.startsWith("/uploads/") && apiOrigin) {
      return `${apiOrigin}${parsed.pathname}${parsed.search}`;
    }

    return parsed.toString();
  } catch {
    if (mediaUrl.startsWith("/uploads/") && apiOrigin) {
      return `${apiOrigin}${mediaUrl}`;
    }

    return mediaUrl;
  }
}

function getSaleState(listing: {
  price: number;
  salePercent?: number | null;
  saleStartsAt?: string | null;
  saleEndsAt?: string | null;
}) {
  if (!listing.salePercent || !listing.saleStartsAt || !listing.saleEndsAt) {
    return { isOnSale: false, effectivePrice: listing.price };
  }

  const now = Date.now();
  const startsAt = new Date(listing.saleStartsAt).getTime();
  const endsAt = new Date(listing.saleEndsAt).getTime();

  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || now < startsAt || now > endsAt) {
    return { isOnSale: false, effectivePrice: listing.price };
  }

  const effectivePrice = Math.round((listing.price * (100 - listing.salePercent)) / 100);
  return { isOnSale: effectivePrice < listing.price, effectivePrice };
}

export function ConversationView({
  conversation,
  heightClassName,
}: {
  conversation: Conversation;
  heightClassName?: string;
}) {
  const { user } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<PendingMedia[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const [olderCursor, setOlderCursor] = useState<OlderMessagesCursor | null>(null);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [activeDeal, setActiveDeal] = useState<ActiveDeal | null>(null);
  const [isOtherUserOnline, setIsOtherUserOnline] = useState(false);

  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const pendingMediaRef = useRef<PendingMedia[]>([]);
  const preventNextAutoScrollRef = useRef(false);

  const otherUser =
    user?.id === conversation.buyer.id
      ? conversation.seller.displayName
      : conversation.buyer.displayName;

  const otherUserAvatar =
    user?.id === conversation.buyer.id
      ? conversation.seller.avatarUrl
      : conversation.buyer.avatarUrl;

  const otherUserId =
    user?.id === conversation.buyer.id
      ? conversation.seller.id
      : conversation.buyer.id;
  const { isOnSale, effectivePrice } = getSaleState(conversation.listing);

  function scrollToBottom() {
    const el = messagesContainerRef.current;
    if (!el) return;

    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }

  async function loadMessages() {
    const res = await http.get<Message[]>(`/conversations/${conversation.id}/messages`);
    const loadedMessages = res.data;

    setMessages(loadedMessages);

    if (loadedMessages.length > 0) {
      const oldest = loadedMessages[0];
      setOlderCursor({
        beforeCreatedAt: oldest.createdAt,
        beforeId: oldest.id,
      });
    } else {
      setOlderCursor(null);
    }

    setHasOlderMessages(loadedMessages.length >= MESSAGE_PAGE_SIZE);
    window.dispatchEvent(new Event("inbox:read"));
  }

  async function loadOlderMessages() {
    if (!olderCursor || loadingOlderMessages) {
      return;
    }

    setLoadingOlderMessages(true);

    try {
      const container = messagesContainerRef.current;
      const previousScrollHeight = container?.scrollHeight ?? 0;
      const previousScrollTop = container?.scrollTop ?? 0;

      const res = await http.get<OlderMessagesResponse>(
        `/conversations/${conversation.id}/messages/older`,
        {
          params: {
            beforeCreatedAt: olderCursor.beforeCreatedAt,
            beforeId: olderCursor.beforeId,
            limit: MESSAGE_PAGE_SIZE,
          },
        },
      );

      const olderItems = res.data.items;

      if (olderItems.length === 0) {
        setHasOlderMessages(false);
        setOlderCursor(null);
        return;
      }

      preventNextAutoScrollRef.current = true;

      setMessages((prev) => {
        const existingIds = new Set(prev.map((message) => message.id));
        const uniqueOlder = olderItems.filter((message) => !existingIds.has(message.id));
        return [...uniqueOlder, ...prev];
      });

      setHasOlderMessages(res.data.hasMore);
      setOlderCursor(res.data.nextCursor);

      requestAnimationFrame(() => {
        const element = messagesContainerRef.current;
        if (!element) return;
        const delta = element.scrollHeight - previousScrollHeight;
        element.scrollTop = previousScrollTop + delta;
      });
    } catch {
      setErr("Failed to load older messages");
    } finally {
      setLoadingOlderMessages(false);
    }
  }

  async function loadActiveDeal() {
    try {
      const res = await http.get<ActiveDeal>(
        `/deals/active/by-listing/${conversation.listingId}/by-buyer/${conversation.buyerId}`,
      );
      setActiveDeal(res.data);
    } catch {
      setActiveDeal(null);
    }
  }

  async function bootstrap() {
    setErr(null);
    setLoading(true);
    try {
      await Promise.all([loadMessages(), loadActiveDeal()]);
    } catch (error: unknown) {
      setErr(extractErrorMessage(error, "Failed to load conversation"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id]);

  useLayoutEffect(() => {
    if (preventNextAutoScrollRef.current) {
      preventNextAutoScrollRef.current = false;
      return;
    }

    scrollToBottom();
  }, [messages.length]);

  useEffect(() => {
    if (!user) return;

    const socket = getSocket();

    const handleNewMessage = (message: Message) => {
      if (message.conversationId !== conversation.id) return;

      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
    };

    const handlePresenceUpdate = (payload: { userId: string; isOnline: boolean }) => {
      if (payload.userId === otherUserId) {
        setIsOtherUserOnline(payload.isOnline);
      }
    };

    socket.emit("conversation:join", { conversationId: conversation.id });

    socket.emit(
      "presence:check",
      { userId: otherUserId },
      (response: { userId: string; isOnline: boolean }) => {
        if (response?.userId === otherUserId) {
          setIsOtherUserOnline(response.isOnline);
        }
      },
    );

    socket.on("message:new", handleNewMessage);
    socket.on("presence:update", handlePresenceUpdate);

    return () => {
      socket.emit("conversation:leave", { conversationId: conversation.id });
      socket.off("message:new", handleNewMessage);
      socket.off("presence:update", handlePresenceUpdate);
    };
  }, [conversation.id, otherUserId, user]);

  useEffect(() => {
    pendingMediaRef.current = pendingMedia;
  }, [pendingMedia]);

  useEffect(() => {
    return () => {
      for (const media of pendingMediaRef.current) {
        URL.revokeObjectURL(media.previewUrl);
      }
    };
  }, []);

  function getMessageMediaItems(message: Message): MediaItem[] {
    if (Array.isArray(message.mediaItems) && message.mediaItems.length > 0) {
      return message.mediaItems.map((item) => ({
        mediaUrl: normalizeMediaUrl(item.mediaUrl),
        mediaType: item.mediaType,
      }));
    }

    if (message.mediaUrl && message.mediaType) {
      return [
        {
          mediaUrl: normalizeMediaUrl(message.mediaUrl),
          mediaType: message.mediaType,
        },
      ];
    }

    return [];
  }

  const galleryItems = useMemo(
    () =>
      messages.flatMap((message) =>
        getMessageMediaItems(message).map((item) => ({ ...item, messageId: message.id })),
      ),
    [messages],
  );

  const messageMediaOffsets = useMemo(() => {
    const offsets = new Map<string, number>();
    let offset = 0;

    for (const message of messages) {
      offsets.set(message.id, offset);
      offset += getMessageMediaItems(message).length;
    }

    return offsets;
  }, [messages]);

  function isSupportedMediaFile(file: File) {
    return file.type.startsWith("image/") || file.type.startsWith("video/");
  }

  function addMediaFiles(files: File[]) {
    const mediaFiles = files.filter((file) => isSupportedMediaFile(file));
    if (mediaFiles.length === 0) {
      setErr("Only image/video files are supported");
      return;
    }

    const capacityLeft = Math.max(0, 8 - pendingMedia.length);
    if (capacityLeft === 0) {
      setErr("You can attach up to 8 files per message");
      return;
    }

    const accepted: PendingMedia[] = mediaFiles.slice(0, capacityLeft).map((file, index) => ({
      id: `${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
      file,
      mediaType: file.type.startsWith("video/") ? "VIDEO" : "IMAGE",
      previewUrl: URL.createObjectURL(file),
    }));

    setPendingMedia((prev) => [...prev, ...accepted]);

    if (mediaFiles.length > capacityLeft) {
      setErr("Only first 8 files were attached");
    } else {
      setErr(null);
    }
  }

  function removePendingMedia(mediaId: string) {
    setPendingMedia((prev) => {
      const target = prev.find((item) => item.id === mediaId);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== mediaId);
    });
  }

  function clearAllPendingMedia() {
    setPendingMedia((prev) => {
      for (const media of prev) {
        URL.revokeObjectURL(media.previewUrl);
      }
      return [];
    });
  }

  function showPreviousMedia() {
    setGalleryIndex((prev) => {
      if (prev === null || galleryItems.length === 0) return prev;
      return (prev - 1 + galleryItems.length) % galleryItems.length;
    });
  }

  function showNextMedia() {
    setGalleryIndex((prev) => {
      if (prev === null || galleryItems.length === 0) return prev;
      return (prev + 1) % galleryItems.length;
    });
  }

  useEffect(() => {
    if (galleryIndex === null) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setGalleryIndex(null);
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        showPreviousMedia();
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        showNextMedia();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [galleryIndex, galleryItems.length]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const TOP_SCROLL_THRESHOLD_PX = 72;

    const onScroll = () => {
      if (!hasOlderMessages || loadingOlderMessages || !olderCursor) {
        return;
      }

      if (container.scrollTop <= TOP_SCROLL_THRESHOLD_PX) {
        void loadOlderMessages();
      }
    };

    container.addEventListener("scroll", onScroll);
    return () => container.removeEventListener("scroll", onScroll);
  }, [hasOlderMessages, loadingOlderMessages, olderCursor]);

  async function send() {
    const trimmed = text.trim();
    if ((!trimmed && pendingMedia.length === 0) || !user) return;

    try {
      setErr(null);
      let mediaPayload:
        | { mediaItems?: Array<{ mediaUrl: string; mediaType: "IMAGE" | "VIDEO" }> }
        | undefined;

      if (pendingMedia.length > 0) {
        const formData = new FormData();
        for (const media of pendingMedia) {
          formData.append("files", media.file);
        }

        setMediaUploading(true);

        const uploadResponse = await http.post<{
          mediaItems: Array<{ mediaUrl: string; mediaType: "IMAGE" | "VIDEO" }>;
        }>(
          "/messages/upload-media",
          formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          },
        );

        mediaPayload = {
          mediaItems: uploadResponse.data.mediaItems,
        };
      }

      const socket = getSocket();

      socket.emit(
        "message:send",
        {
          conversationId: conversation.id,
          text: trimmed,
          ...(mediaPayload ?? {}),
        },
        (response: { ok: boolean; message?: Message; error?: string }) => {
          if (!response?.ok) {
            setErr(response?.error ?? "Send failed");
            return;
          }

          if (response.message) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === response.message!.id)) return prev;
              return [...prev, response.message!];
            });
          }
        },
      );

      setText("");
      clearAllPendingMedia();
    } catch {
      setErr("Send failed");
    } finally {
      setMediaUploading(false);
    }
  }

  async function handlePickMedia(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = "";

    if (files.length === 0) return;
    addMediaFiles(files);
  }

  function handleInputPaste(event: ClipboardEvent<HTMLInputElement>) {
    const items = event.clipboardData?.items;
    if (!items) return;

    const mediaItem = Array.from(items).find(
      (item) => item.kind === "file" && (item.type.startsWith("image/") || item.type.startsWith("video/")),
    );

    if (!mediaItem) return;

    event.preventDefault();

    const file = mediaItem.getAsFile();
    if (!file) return;

    addMediaFiles([file]);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!isDragOver) {
      setIsDragOver(true);
    }
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();

    const target = event.currentTarget;
    const nextTarget = event.relatedTarget as Node | null;
    if (nextTarget && target.contains(nextTarget)) {
      return;
    }

    setIsDragOver(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragOver(false);

    const files = event.dataTransfer?.files ? Array.from(event.dataTransfer.files) : [];
    if (files.length === 0) return;

    addMediaFiles(files);
  }

  const containerHeightClassName = heightClassName ?? "h-[720px]";

  return (
    <Card
      className={`relative flex ${containerHeightClassName} flex-col overflow-hidden ${
        isDragOver ? "ring-2 ring-primary/40" : ""
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragOver && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-background/70 text-sm font-medium text-foreground">
          Drop image/video to attach
        </div>
      )}

      {galleryIndex !== null && galleryItems[galleryIndex] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6"
          onClick={() => setGalleryIndex(null)}
        >
          <button
            type="button"
            className="absolute right-5 top-5 rounded-full bg-background/80 p-2 text-foreground"
            onClick={(event) => {
              event.stopPropagation();
              setGalleryIndex(null);
            }}
          >
            <X className="h-5 w-5" />
          </button>

          {galleryItems.length > 1 && (
            <>
              <button
                type="button"
                className="absolute left-4 rounded-full bg-background/70 p-2 text-foreground"
                onClick={(event) => {
                  event.stopPropagation();
                  showPreviousMedia();
                }}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                className="absolute right-4 rounded-full bg-background/70 p-2 text-foreground"
                onClick={(event) => {
                  event.stopPropagation();
                  showNextMedia();
                }}
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}

          <div className="max-h-full max-w-full" onClick={(event) => event.stopPropagation()}>
            {galleryItems[galleryIndex].mediaType === "IMAGE" ? (
              <img
                src={galleryItems[galleryIndex].mediaUrl}
                alt="Chat media"
                className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain"
              />
            ) : (
              <video
                src={galleryItems[galleryIndex].mediaUrl}
                controls
                autoPlay
                className="max-h-[85vh] max-w-[85vw] rounded-lg"
              />
            )}
          </div>
        </div>
      )}

      <div className="border-b border-border bg-background p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground">
              <Avatar
                src={otherUserAvatar ?? undefined}
                alt={otherUser}
                fallback={otherUser.slice(0, 2).toUpperCase()}
                className="h-10 w-10"
                fallbackClassName="text-sm font-semibold"
              />
              <span
                className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background ${
                  isOtherUserOnline ? "bg-emerald-500" : "bg-muted-foreground"
                }`}
              />
            </div>

            <div className="min-w-0">
              <div className="truncate font-semibold text-foreground">{otherUser}</div>
              <div className="text-xs text-muted-foreground">{isOtherUserOnline ? "Online" : "Offline"}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeDeal && (
              <Button variant="ghost" size="sm" asChild>
                <Link to={`/deals/${activeDeal.id}`}>
                  <ExternalLink className="h-4 w-4" />
                  Deal
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="border-b border-border bg-muted px-4 py-2">
        <Link
          to={`/listings/${conversation.listing.id}`}
          className="flex items-center gap-2 text-sm"
        >
          <Badge variant="outline" className="text-[10px]">
            Related listing
          </Badge>
          <span className="line-clamp-1 font-medium text-foreground">{conversation.listing.title}</span>
          <span className="ml-auto shrink-0 text-right">
            {isOnSale ? (
              <span className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground line-through">{formatUsdFromCents(conversation.listing.price)}</span>
                <span className="font-medium text-primary">{formatUsdFromCents(effectivePrice)}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">{formatUsdFromCents(conversation.listing.price)}</span>
            )}
          </span>
        </Link>
      </div>

      <div
        ref={messagesContainerRef}
        className="flex flex-1 flex-col gap-2 overflow-y-auto bg-muted px-4 py-6"
      >
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3">
          {loadingOlderMessages && (
            <div className="py-1 text-center text-xs text-muted-foreground">Loading older messages…</div>
          )}

          {loading && <div className="text-sm text-muted-foreground">Loading…</div>}

          {!loading && messages.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">No messages yet</div>
          )}

          {messages.map((m) => {
            const mine = m.senderId === user?.id;
            const mediaItems = getMessageMediaItems(m);
            const mediaOffset = messageMediaOffsets.get(m.id) ?? 0;

            return (
              <div
                key={m.id}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                    mine
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-background text-foreground"
                  }`}
                >
                  {mediaItems.length > 0 && (
                    <div
                      className={`mb-2 grid gap-1.5 ${
                        mediaItems.length === 1 ? "grid-cols-1" : "grid-cols-2"
                      }`}
                    >
                      {mediaItems.map((media, mediaIndex) => (
                        <button
                          key={`${media.mediaUrl}-${mediaIndex}`}
                          type="button"
                          className="relative overflow-hidden rounded-lg border border-border/40"
                          onClick={() => setGalleryIndex(mediaOffset + mediaIndex)}
                        >
                          {media.mediaType === "IMAGE" ? (
                            <img
                              src={media.mediaUrl}
                              alt="Chat attachment"
                              className="h-36 w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <>
                              <video
                                src={media.mediaUrl}
                                className="h-36 w-full object-cover"
                                muted
                              />
                              <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                                Video
                              </span>
                            </>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {m.text && <div className="whitespace-pre-wrap text-sm">{m.text}</div>}
                  <div
                    className={`mt-1 text-[10px] ${
                      mine ? "text-primary-foreground/70" : "text-muted-foreground"
                    }`}
                  >
                    {m.sender.displayName} · {new Date(m.createdAt).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-border bg-background p-4">
        <div className="mx-auto max-w-2xl space-y-2">
          {pendingMedia.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/30 p-2">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="truncate text-xs text-muted-foreground">
                  {pendingMedia.length} file(s) attached
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllPendingMedia}
                  disabled={mediaUploading}
                >
                  <X className="h-4 w-4" />
                  Clear all
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {pendingMedia.map((media) => (
                  <div key={media.id} className="relative overflow-hidden rounded-md border border-border">
                    <button
                      type="button"
                      className="absolute right-1 top-1 z-10 rounded-full bg-black/65 p-1 text-white"
                      onClick={() => removePendingMedia(media.id)}
                      disabled={mediaUploading}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>

                    {media.mediaType === "IMAGE" ? (
                      <img
                        src={media.previewUrl}
                        alt={media.file.name}
                        className="h-24 w-full object-cover"
                      />
                    ) : (
                      <video
                        src={media.previewUrl}
                        className="h-24 w-full object-cover"
                        muted
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <input
              ref={mediaInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={handlePickMedia}
            />

            <Button
              variant="outline"
              onClick={() => mediaInputRef.current?.click()}
              disabled={mediaUploading || pendingMedia.length >= 8}
            >
              <Paperclip className="h-4 w-4" />
            </Button>

            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a message... (or paste image/video)"
              className="bg-background"
              onPaste={handleInputPaste}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <Button onClick={send} disabled={(!text.trim() && pendingMedia.length === 0) || mediaUploading}>
              <Send className="h-4 w-4" />
              {mediaUploading ? "Uploading…" : "Send"}
            </Button>
          </div>
        </div>

        {err && <div className="mx-auto mt-2 max-w-2xl text-sm text-destructive">{err}</div>}
      </div>
    </Card>
  );
}
