import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { http } from "../../api/http";
import { useAuth } from "../../auth/AuthContext";

type Message = {
  id: string;
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

export function ConversationView({ conversation }: { conversation: Conversation }) {
  const { user } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [activeDeal, setActiveDeal] = useState<ActiveDeal | null>(null);

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
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? "Failed to load conversation");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id]);

  useEffect(() => {
    const t = setInterval(() => {
      loadMessages().catch(() => {});
      loadActiveDeal().catch(() => {});
    }, 2000);

    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id]);

  async function send() {
    const trimmed = text.trim();
    if (!trimmed) return;

    try {
      setErr(null);
      await http.post("/messages", {
        conversationId: conversation.id,
        text: trimmed,
      });
      setText("");
      await loadMessages();
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? "Send failed");
    }
  }

  const otherUser =
    user?.id === conversation.buyer.id
      ? conversation.seller.displayName
      : conversation.buyer.displayName;

  return (
    <div className="border rounded flex flex-col h-[650px]">
      <div className="p-4 border-b space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-semibold">{conversation.listing.title}</div>
            <div className="text-sm text-gray-600">With: {otherUser}</div>
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

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 bg-gray-50">
        {loading && <div className="text-sm text-gray-500">Loading…</div>}

        {!loading && messages.length === 0 && (
          <div className="text-sm text-gray-500">No messages yet</div>
        )}

        {messages.map((m) => {
          const mine = m.senderId === user?.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded px-3 py-2 ${
                  mine ? "bg-black text-white" : "bg-white text-black border"
                }`}
              >
                <div className="text-sm whitespace-pre-wrap">{m.text}</div>
                <div className={`text-[10px] mt-1 ${mine ? "text-gray-200" : "text-gray-500"}`}>
                  {m.sender.displayName} · {new Date(m.createdAt).toLocaleTimeString()}
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