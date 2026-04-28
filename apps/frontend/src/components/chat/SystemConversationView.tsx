import { useEffect, useMemo, useState } from "react";
import { Bell, Pin } from "lucide-react";
import { http } from "../../api/http";
import { getSocket } from "../../api/socket";
import { Card, CardContent } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { LoadingState } from "../ui/PageStates";

type SystemMessage = {
  id: string;
  title: string;
  text: string;
  createdAt: string;
  readAt?: string | null;
  sender: {
    id: string;
    displayName: string;
  };
};

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

export function SystemConversationView({
  onMarkedRead,
}: {
  onMarkedRead?: () => void;
}) {
  const [messages, setMessages] = useState<SystemMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const unreadCount = useMemo(
    () => messages.filter((message) => !message.readAt).length,
    [messages],
  );

  async function loadMessages() {
    const res = await http.get<SystemMessage[]>("/system-notifications/me", {
      params: { limit: 200 },
    });
    setMessages(res.data);
  }

  async function markAllAsRead() {
    setSaving(true);
    setErr(null);

    try {
      await http.patch("/system-notifications/me/read");
      await loadMessages();
      window.dispatchEvent(new Event("inbox:read"));
      onMarkedRead?.();
    } catch (error: unknown) {
      setErr(extractErrorMessage(error, "Failed to mark notifications as read"));
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    setErr(null);

    loadMessages()
      .catch((error: unknown) => setErr(extractErrorMessage(error, "Failed to load system notifications")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const socket = getSocket();

    const handleSystemMessage = (message: SystemMessage) => {
      setMessages((prev) => {
        if (prev.some((item) => item.id === message.id)) {
          return prev;
        }
        return [...prev, message];
      });
    };

    socket.on("system:message:new", handleSystemMessage);

    return () => {
      socket.off("system:message:new", handleSystemMessage);
    };
  }, []);

  if (loading) {
    return <LoadingState width="max-w-5xl" />;
  }

  return (
    <Card className="h-[720px] overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Bell className="h-4 w-4" />
              TradeGame
              <Badge variant="outline" className="gap-1 text-[10px]">
                <Pin className="h-3 w-3" />
                Pinned
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              System announcements, achievement updates and admin broadcast messages.
            </div>
          </div>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={markAllAsRead}
            disabled={saving || unreadCount === 0}
          >
            {saving ? "Saving..." : unreadCount > 0 ? `Mark all read (${unreadCount})` : "All read"}
          </Button>
        </div>
        {err && <div className="mt-2 text-sm text-destructive">{err}</div>}
      </div>

      <CardContent className="h-[calc(720px-96px)] space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
            No system messages yet.
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className="rounded-lg border border-border bg-muted/40 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-foreground">{message.title}</div>
              {!message.readAt && <Badge className="text-[10px]">New</Badge>}
            </div>
            <div className="mt-1 text-sm text-foreground">{message.text}</div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              {new Date(message.createdAt).toLocaleString()}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
