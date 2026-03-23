import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ExternalLink, Send } from "lucide-react";
import { Link } from "react-router-dom";
import { http } from "../../api/http";
import { useAuth } from "../../auth/AuthContext";
import { getSocket } from "../../api/socket";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { Avatar } from "../ui/Avatar";

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

export function ConversationView({
  conversation,
}: {
  conversation: Conversation;
}) {
  const { user } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [activeDeal, setActiveDeal] = useState<ActiveDeal | null>(null);
  const [isOtherUserOnline, setIsOtherUserOnline] = useState(false);

  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

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

  function scrollToBottom() {
    const el = messagesContainerRef.current;
    if (!el) return;

    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }

  async function loadMessages() {
    const res = await http.get<Message[]>(`/conversations/${conversation.id}/messages`);
    setMessages(res.data);
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

  async function send() {
    const trimmed = text.trim();
    if (!trimmed || !user) return;

    try {
      setErr(null);
      const socket = getSocket();

      socket.emit(
        "message:send",
        {
          conversationId: conversation.id,
          text: trimmed,
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
    } catch {
      setErr("Send failed");
    }
  }

  return (
    <Card className="flex h-[720px] flex-col overflow-hidden">
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
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/listings/${conversation.listing.id}`}>
                <ExternalLink className="h-4 w-4" />
                Listing
              </Link>
            </Button>

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
          <span className="ml-auto shrink-0 text-muted-foreground">{(conversation.listing.price / 100).toFixed(2)} Kč</span>
        </Link>
      </div>

      <div
        ref={messagesContainerRef}
        className="flex flex-1 flex-col gap-2 overflow-y-auto bg-muted px-4 py-6"
      >
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3">
          {loading && <div className="text-sm text-muted-foreground">Loading…</div>}

          {!loading && messages.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">No messages yet</div>
          )}

          {messages.map((m) => {
            const mine = m.senderId === user?.id;
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
                  <div className="whitespace-pre-wrap text-sm">{m.text}</div>
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
        <div className="mx-auto flex max-w-2xl gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message..."
            className="bg-background"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <Button onClick={send} disabled={!text.trim()}>
            <Send className="h-4 w-4" />
            Send
          </Button>
        </div>

        {err && <div className="mx-auto mt-2 max-w-2xl text-sm text-destructive">{err}</div>}
      </div>
    </Card>
  );
}
