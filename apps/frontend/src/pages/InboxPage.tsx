import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { http } from "../api/http";
import { getSocket } from "../api/socket";
import { ConversationView } from "../components/chat/ConversationView";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { ErrorState, LoadingState } from "../components/ui/PageStates";
import { EmptyState } from "../components/ui/EmptyState";
import { Avatar } from "../components/ui/Avatar";

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
  unreadCount?: number;
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
  const { user } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
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
    } catch (error: unknown) {
      setErr(extractErrorMessage(error, "Failed to load inbox"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInbox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!user) return;

    const socket = getSocket();

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
  }, [user]);

  const selectedConversation =
    conversations.find((c) => c.id === selectedConversationId) ?? null;

  const filteredConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return conversations;

    return conversations.filter((conv) => {
      const otherUser = user?.id === conv.buyer.id ? conv.seller.displayName : conv.buyer.displayName;
      const lastMessage = conv.messages[0]?.text ?? "";

      return (
        conv.listing.title.toLowerCase().includes(query) ||
        otherUser.toLowerCase().includes(query) ||
        lastMessage.toLowerCase().includes(query)
      );
    });
  }, [conversations, searchQuery, user?.id]);

  if (loading) return <LoadingState width="max-w-7xl" />;
  if (err) return <ErrorState width="max-w-7xl" message={err} />;

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[360px_1fr]">
      <Card className="h-[720px] overflow-hidden">
        <CardHeader className="space-y-1 border-b border-border">
          <div className="text-base font-semibold text-foreground">Inbox</div>
          <div className="text-xs text-muted-foreground">Live conversations from your listings and deals</div>
        </CardHeader>

        <div className="border-b border-border px-5 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by listing, user, or message"
              className="bg-muted pl-9"
            />
          </div>
        </div>

        <CardContent className="h-[calc(720px-145px)] overflow-y-auto p-0">
          {conversations.length === 0 && (
            <div className="p-5">
              <EmptyState
                title="No conversations yet"
                description="When buyers or sellers message you from a listing, it will appear here in real time."
              />
            </div>
          )}

          {conversations.length > 0 && filteredConversations.length === 0 && (
            <div className="p-5">
              <EmptyState
                title="No matching conversations"
                description="Try another keyword for listing title, username, or message text."
              />
            </div>
          )}

          <div className="divide-y divide-border">
            {filteredConversations.map((conv) => {
              const otherUser =
                user?.id === conv.buyer.id ? conv.seller.displayName : conv.buyer.displayName;
              const otherUserAvatar =
                user?.id === conv.buyer.id ? conv.seller.avatarUrl : conv.buyer.avatarUrl;

              const lastMessage = conv.messages[0];
              const timestamp = lastMessage?.createdAt ?? conv.createdAt;

              return (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConversationId(conv.id)}
                  className={`w-full p-4 text-left transition hover:bg-accent ${
                    selectedConversationId === conv.id ? "bg-accent" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar
                      src={otherUserAvatar ?? undefined}
                      alt={otherUser}
                      fallback={otherUser.slice(0, 2).toUpperCase()}
                      className="mt-0.5 h-9 w-9 shrink-0"
                      fallbackClassName="text-xs font-semibold"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="line-clamp-1 text-sm font-semibold text-foreground">{otherUser}</div>
                          <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{conv.listing.title}</div>
                        </div>
                        <div className="shrink-0 text-[11px] text-muted-foreground">
                          {new Date(timestamp).toLocaleString()}
                        </div>
                      </div>

                      <div className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                        {lastMessage
                          ? `${lastMessage.sender.displayName}: ${lastMessage.text}`
                          : "No messages yet"}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="min-h-[720px]">
        {selectedConversation ? (
          <ConversationView conversation={selectedConversation} />
        ) : (
          <Card className="flex h-[720px] items-center justify-center">
            <CardContent className="text-muted-foreground">Select a conversation</CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}