import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { http } from "../../api/http";
import { useAuth } from "../../auth/AuthContext";
import type { Conversation, Message } from "../../types/chat";

type Props = {
  listingId: string;
  conversationId?: string | null;
};

export function ChatPanel({ listingId, conversationId: externalConversationId }: Props) {
  const { user } = useAuth();

  const [conv, setConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function createOrGetConversation(): Promise<Conversation> {
    const res = await http.post<Conversation>("/conversations", { listingId });
    return res.data;
  }

  async function loadMessages(targetConversationId: string) {
    const res = await http.get<Message[]>(`/conversations/${targetConversationId}/messages`);
    setMessages(res.data);
  }

  async function bootstrap() {
    if (!user) return;

    setErr(null);
    setLoading(true);

    try {
      // если conversationId пришёл извне — используем его
      if (externalConversationId) {
        setConv({
          id: externalConversationId,
          listingId,
          buyerId: "",
          sellerId: "",
          createdAt: "",
        });
        await loadMessages(externalConversationId);
      } else {
        const c = await createOrGetConversation();
        setConv(c);
        await loadMessages(c.id);
      }
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? "Failed to load chat");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setConv(null);
    setMessages([]);
    setText("");
    setErr(null);

    if (!user) return;
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId, user?.id, externalConversationId]);

  useEffect(() => {
    if (!user || !conv?.id) return;

    const t = setInterval(() => {
      loadMessages(conv.id).catch(() => {});
    }, 2000);

    return () => clearInterval(t);
  }, [conv?.id, user?.id]);

  async function send() {
    const trimmed = text.trim();
    if (!trimmed) return;

    try {
      setErr(null);

      let targetConversationId = conv?.id;

      if (!targetConversationId) {
        const c = await createOrGetConversation();
        setConv(c);
        targetConversationId = c.id;
      }

      await http.post("/messages", { conversationId: targetConversationId, text: trimmed });
      setText("");
      await loadMessages(targetConversationId);
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? "Send failed");
    }
  }

  if (!user) {
    return (
      <div className="border rounded p-4">
        <div className="font-semibold mb-2">Chat</div>
        <div className="text-sm text-gray-600">
          Please <Link className="underline" to="/login">login</Link> to message the seller.
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded flex flex-col h-[520px]">
      <div className="p-3 border-b">
        <div className="font-semibold">Chat</div>
        <div className="text-xs text-gray-600">
          {conv?.id ? `conversation: ${conv.id}` : "creating conversation…"}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 bg-gray-50">
        {loading && <div className="text-sm text-gray-500">Loading…</div>}

        {!loading && messages.length === 0 && (
          <div className="text-sm text-gray-500">No messages yet</div>
        )}

        {messages.map((m) => {
          const mine = m.senderId === user.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded px-3 py-2 ${
                  mine ? "bg-black text-white" : "bg-white text-gray-800 border"
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

      <div className="p-2 border-t">
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
          <button className="bg-black text-white rounded px-4" onClick={send}>
            Send
          </button>
        </div>
        {err && <div className="text-sm text-red-600 mt-2">{err}</div>}
      </div>
    </div>
  );
}