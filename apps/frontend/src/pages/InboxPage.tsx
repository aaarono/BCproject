import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { http } from "../api/http";
import { getSocket } from "../api/socket";
import { ConversationView } from "../components/chat/ConversationView";

type Message = {
  id: string;
  conversationId: string;
  text: string;
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
  messages: Message[];
};

function sortConversations(items: Conversation[]) {
  return [...items].sort((a, b) => {
    const aTime = a.messages[0]?.createdAt ?? a.createdAt;
    const bTime = b.messages[0]?.createdAt ?? b.createdAt;
    return new Date(bTime).getTime() - new Date(aTime).getTime();
  });
}

export function InboxPage() {
  const { user, token } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function loadInbox() {
    setLoading(true);
    setErr(null);

    try {
      const res = await http.get<Conversation[]>("/conversations/me");
      const sorted = sortConversations(res.data);

      setConversations(sorted);

      if (!selectedConversationId && sorted.length > 0) {
        setSelectedConversationId(sorted[0].id);
      }

      if (
        selectedConversationId &&
        !sorted.find((c) => c.id === selectedConversationId) &&
        sorted.length > 0
      ) {
        setSelectedConversationId(sorted[0].id);
      }
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? "Failed to load inbox");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInbox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!token) return;

    const socket = getSocket(token);

    const handleInboxUpdate = (payload: { conversation: Conversation }) => {
      const updatedConversation = payload.conversation;

      setConversations((prev) => {
        const withoutCurrent = prev.filter((c) => c.id !== updatedConversation.id);
        return sortConversations([updatedConversation, ...withoutCurrent]);
      });

      setSelectedConversationId((prev) => prev ?? updatedConversation.id);
    };

    socket.on("inbox:update", handleInboxUpdate);

    return () => {
      socket.off("inbox:update", handleInboxUpdate);
    };
  }, [token]);

  const selectedConversation =
    conversations.find((c) => c.id === selectedConversationId) ?? null;

  if (loading) return <div className="p-6">Loading…</div>;
  if (err) return <div className="p-6 text-red-600">{err}</div>;

  return (
    <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
      <div className="border rounded h-[650px] overflow-y-auto">
        <div className="p-4 border-b font-semibold">Inbox</div>

        {conversations.length === 0 && (
          <div className="p-4 text-sm text-gray-500">No conversations yet.</div>
        )}

        <div className="divide-y">
          {conversations.map((conv) => {
            const otherUser =
              user?.id === conv.buyer.id ? conv.seller.displayName : conv.buyer.displayName;

            const lastMessage = conv.messages[0];

            return (
              <button
                key={conv.id}
                onClick={() => setSelectedConversationId(conv.id)}
                className={`w-full text-left p-4 hover:bg-gray-50 ${
                  selectedConversationId === conv.id ? "bg-gray-100" : ""
                }`}
              >
                <div className="font-medium">{conv.listing.title}</div>
                <div className="text-sm text-gray-600">With: {otherUser}</div>

                <div className="text-sm text-gray-500 mt-1 line-clamp-2">
                  {lastMessage
                    ? `${lastMessage.sender.displayName}: ${lastMessage.text}`
                    : "No messages yet"}
                </div>

                <div className="text-xs text-gray-400 mt-2">
                  {lastMessage
                    ? new Date(lastMessage.createdAt).toLocaleString()
                    : new Date(conv.createdAt).toLocaleString()}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        {selectedConversation ? (
          <ConversationView conversation={selectedConversation} />
        ) : (
          <div className="border rounded h-[650px] flex items-center justify-center text-gray-500">
            Select a conversation
          </div>
        )}
      </div>
    </div>
  );
}