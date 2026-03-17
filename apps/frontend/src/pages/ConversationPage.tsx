import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { http } from "../api/http";
import { useAuth } from "../auth/AuthContext";
import { extractHttpErrorMessage } from "../utils/httpError";

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
  buyer: { id: string; displayName: string };
  seller: { id: string; displayName: string };
};

type Message = {
  id: string;
  text: string;
  senderId: string;
  createdAt: string;
  sender: { id: string; displayName: string };
};

export function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [conv, setConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadConversation() {
    const res = await http.get<Conversation>(`/conversations/${id}`);
    setConv(res.data);
  }

  async function loadMessages() {
    const res = await http.get<Message[]>(`/conversations/${id}/messages`);
    setMessages(res.data);
  }

  async function loadAll() {
    setErr(null);
    setLoading(true);
    try {
      await Promise.all([loadConversation(), loadMessages()]);
    } catch (error: unknown) {
      setErr(extractHttpErrorMessage(error, "Failed to load conversation"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!id) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // polling messages only
  useEffect(() => {
    if (!id) return;
    const t = setInterval(() => {
      loadMessages().catch(() => {});
    }, 2000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function send() {
    const trimmed = text.trim();
    if (!trimmed || !id) return;

    try {
      await http.post(`/messages`, { conversationId: id, text: trimmed });
      setText("");
      await loadMessages();
    } catch (error: unknown) {
      setErr(extractHttpErrorMessage(error, "Send failed"));
    }
  }

  if (loading) return <div className="p-6">Loading…</div>;
  if (err) return <div className="p-6 text-red-600">{err}</div>;
  if (!conv) return <div className="p-6">No conversation</div>;

  return (
    <div className="max-w-3xl mx-auto p-6 flex flex-col gap-4">
      <div className="border rounded p-3">
        <div className="font-semibold">Conversation</div>
        <div className="text-sm text-gray-600">id: {conv.id}</div>
        <div className="text-sm text-gray-600">
          listing: {conv.listing.title} ({(conv.listing.price / 100).toFixed(2)}{" "}
          Kč)
        </div>
        <div className="text-sm text-gray-600">
          buyer: {conv.buyer.displayName} · seller: {conv.seller.displayName}
        </div>
      </div>

      <div className="border rounded p-4 h-[60vh] overflow-y-auto flex flex-col gap-2 bg-gray-50">
        {messages.length === 0 && (
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
                className={`max-w-[70%] rounded px-3 py-2 ${
                  mine ? "bg-black text-white" : "bg-white text-black border"
                }`}
              >
                <div className="text-sm">{m.text}</div>
                <div
                  className={`text-[10px] mt-1 ${mine ? "text-gray-200" : "text-gray-500"}`}
                >
                  {m.sender.displayName} ·{" "}
                  {new Date(m.createdAt).toLocaleTimeString()}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2">
        <input
          className="border rounded p-2 flex-1"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
        />
        <button className="bg-black text-white rounded px-4" onClick={send}>
          Send
        </button>
      </div>
    </div>
  );
}
