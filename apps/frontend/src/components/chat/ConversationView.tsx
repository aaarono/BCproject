import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { http } from "../../api/http";
import { useAuth } from "../../auth/AuthContext";
import { getSocket } from "../../api/socket";

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
  };
  seller: {
    id: string;
    displayName: string;
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
        `/deals/active/by-listing/${conversation.listingId}/by-buyer/${conversation.buyerId}`
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
      }
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
        }
      );

      setText("");
    } catch {
      setErr("Send failed");
    }
  }

  return (
    <div className="border rounded flex flex-col h-[650px]">
      <div className="p-4 border-b space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-semibold">{conversation.listing.title}</div>
            <div className="text-sm text-gray-600 flex items-center gap-2">
              <span>With: {otherUser}</span>
              <span
                className={`inline-block w-2.5 h-2.5 rounded-full ${
                  isOtherUserOnline ? "bg-green-500" : "bg-gray-400"
                }`}
              />
              <span className="text-xs">
                {isOtherUserOnline ? "Online" : "Offline"}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 text-sm">
            <Link className="underline" to={`/listings/${conversation.listing.id}`}>
              Open listing
            </Link>

            {activeDeal && (
              <Link className="underline" to={`/deals/${activeDeal.id}`}>
                Open deal
              </Link>
            )}
          </div>
        </div>
      </div>

      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 bg-gray-50"
      >
        {loading && <div className="text-sm text-gray-500">Loading…</div>}

        {!loading && messages.length === 0 && (
          <div className="text-sm text-gray-500">No messages yet</div>
        )}

        {messages.map((m) => {
          const mine = m.senderId === user?.id;
          return (
            <div
              key={m.id}
              className={`flex ${mine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded px-3 py-2 ${
                  mine ? "bg-black text-white" : "bg-white text-black border"
                }`}
              >
                <div className="text-sm whitespace-pre-wrap">{m.text}</div>
                <div
                  className={`text-[10px] mt-1 ${
                    mine ? "text-gray-200" : "text-gray-500"
                  }`}
                >
                  {m.sender.displayName} ·{" "}
                  {new Date(m.createdAt).toLocaleTimeString()}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-3 border-t space-y-2">
        <div className="flex gap-2">
          <input
            className="border rounded p-2 flex-1"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a message…"
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
          />
          <button
            className="bg-black text-white rounded px-4 py-2"
            onClick={send}
          >
            Send
          </button>
        </div>

        {err && <div className="text-sm text-red-600">{err}</div>}
      </div>
    </div>
  );
}