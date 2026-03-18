import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { http } from "../api/http";
import { extractHttpErrorMessage } from "../utils/httpError";
import { ConversationView } from "../components/chat/ConversationView";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/PageStates";

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

export function ConversationPage() {
  const { id } = useParams<{ id: string }>();

  const [conv, setConv] = useState<Conversation | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadConversation() {
    const res = await http.get<Conversation>(`/conversations/${id}`);
    setConv(res.data);
  }

  async function loadAll() {
    setErr(null);
    setLoading(true);
    try {
      await Promise.all([loadConversation()]);
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

  if (loading) return <LoadingState width="max-w-5xl" />;
  if (err) return <ErrorState width="max-w-5xl" message={err} />;
  if (!conv) return <EmptyState width="max-w-5xl" message="No conversation" />;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <ConversationView conversation={conv} />
    </div>
  );
}
