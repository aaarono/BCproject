import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { http } from "../../api/http";
import { useAuth } from "../../auth/AuthContext";
import type { Conversation, Message } from "../../types/chat";
import { extractHttpErrorMessage } from "../../utils/httpError";

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
    } catch (error: unknown) {
      setErr(extractHttpErrorMessage(error, "Failed to load chat"));
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
  }, [externalConversationId, listingId, user]);

  useEffect(() => {
    if (!user || !conv?.id) return;

    const t = setInterval(() => {
      loadMessages(conv.id).catch(() => {});
    }, 2000);

    return () => clearInterval(t);
  }, [conv?.id, user]);

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
    } catch (error: unknown) {
      setErr(extractHttpErrorMessage(error, "Send failed"));
    }
  }

  if (!user) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-2 font-semibold">Chat</div>
        <div className="text-sm text-muted-foreground">
          Please <Link className="underline" to="/login">login</Link> to message the seller.
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[520px] flex-col rounded-lg border border-border bg-card">
      <div className="border-b border-border p-3">
        <div className="font-semibold">Chat</div>
        <div className="text-xs text-muted-foreground">
          {conv?.id ? `conversation: ${conv.id}` : "creating conversation…"}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto bg-muted p-3">
        {loading && <div className="text-sm text-muted-foreground">Loading…</div>}

        {!loading && messages.length === 0 && (
          <div className="text-sm text-muted-foreground">No messages yet</div>
        )}

        {messages.map((m) => {
          const mine = m.senderId === user.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded px-3 py-2 ${
                  mine
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-card text-foreground"
                }`}
              >
                <div className="text-sm whitespace-pre-wrap">{m.text}</div>
                <div
                  className={`mt-1 text-[10px] ${
                    mine ? "text-primary-foreground/80" : "text-muted-foreground"
                  }`}
                >
                  {m.sender.displayName} · {new Date(m.createdAt).toLocaleTimeString()}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-border p-2">
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border border-input bg-background p-2 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a message…"
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
          />
          <button
            className="rounded-lg bg-primary px-4 text-primary-foreground transition hover:opacity-90"
            onClick={send}
          >
            Send
          </button>
        </div>
        {err && <div className="mt-2 text-sm text-destructive">{err}</div>}
      </div>
    </div>
  );
}