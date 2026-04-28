import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { http } from "../api/http";
import { extractHttpErrorMessage } from "../utils/httpError";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Textarea } from "../components/ui/Textarea";
import { ErrorState, LoadingState } from "../components/ui/PageStates";
import { PageContainer, PageHeader } from "../components/ui/PageLayout";
import { formatUsdFromCents } from "../lib/currency";

type Overview = {
  users: number;
  listings: number;
  activeListings: number;
  deals: number;
  activeDeals: number;
  reviews: number;
  reports: number;
};

type UserItem = {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  role: "BUYER" | "SELLER" | "ADMIN";
  avatarUrl?: string | null;
  warningCount: number;
  warningLimit: number;
  isBanned: boolean;
  isBannedPermanent: boolean;
  bannedUntil?: string | null;
  banReason?: string | null;
  ratingAvg: number;
  ratingCount: number;
  _count: {
    listings: number;
    buyerDeals: number;
    sellerDeals: number;
  };
};

type ListingItem = {
  id: string;
  title: string;
  price: number;
  status: "ACTIVE" | "ARCHIVED";
  type: "GOOD" | "SERVICE";
  category: string;
  seller: {
    id: string;
    displayName: string;
    email: string;
  };
};

type DealItem = {
  id: string;
  status: "INITIATED" | "FUNDED" | "DELIVERED" | "COMPLETED" | "CANCELED";
  canceledByActor?: "BUYER" | "SELLER" | "SYSTEM" | null;
  quantity: number;
  unitPriceSnapshot: number;
  totalAmountSnapshot: number;
  listing: { id: string; title: string };
  buyer: { id: string; displayName: string; email: string };
  seller: { id: string; displayName: string; email: string };
};

type ReviewItem = {
  id: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
  deal: { id: string; listing: { id: string; title: string } };
  buyer: { id: string; displayName: string; email: string };
  seller: { id: string; displayName: string; email: string };
};

type AchievementItem = {
  id: string;
  code: string;
  title: string;
  description: string;
  createdAt: string;
  _count?: {
    users: number;
  };
};

type ReportItem = {
  id: string;
  targetType: "LISTING" | "USER" | "REVIEW" | "DEAL" | "MESSAGE";
  targetId: string;
  reason: string;
  details?: string | null;
  status: "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "REJECTED";
  adminNote?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  reporter: {
    id: string;
    displayName: string;
    email: string;
  };
  reviewedByAdmin?: {
    id: string;
    displayName: string;
    email: string;
  } | null;
};

type ReportCase = {
  report: ReportItem & {
    reporterId?: string;
  };
  reportedUser?: {
    id: string;
    displayName: string;
    email: string;
    warningCount: number;
    warningLimit: number;
    isBanned: boolean;
    isBannedPermanent: boolean;
    bannedUntil?: string | null;
    banReason?: string | null;
  } | null;
  target?: unknown;
  evidenceMessages?: Array<{
    id: string;
    text: string;
    mediaUrl?: string | null;
    mediaType?: string | null;
    createdAt: string;
    sender?: {
      id: string;
      displayName: string;
    };
  }>;
};

type ModerationTargetUser = {
  id: string;
  displayName: string;
  email: string;
};

type AuditLogItem = {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  requestId?: string | null;
  summary?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
  createdAt: string;
  actorAdmin: {
    id: string;
    displayName: string;
    email: string;
  };
};

type ListResponse<T> = {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

type WeeklyFinalizeResponse = {
  alreadyFinalized: boolean;
  competition: {
    status: "PENDING" | "FINALIZED" | "CANCELED";
    weekStart: string;
    weekEnd: string;
    rewardAmount: number;
    winner?: {
      id: string;
      displayName: string;
    } | null;
  };
  winner?: {
    id: string;
    displayName: string;
    rewardAmount: number;
  } | null;
};

function formatAmount(cents: number) {
  return formatUsdFromCents(cents);
}

function getReportStatusBadgeClass(status: ReportItem["status"]) {
  if (status === "UNDER_REVIEW") {
    return "bg-warning/20 text-warning border border-warning/40";
  }

  if (status === "RESOLVED") {
    return "bg-success/20 text-success border border-success/40";
  }

  if (status === "REJECTED") {
    return "bg-destructive/20 text-destructive border border-destructive/40";
  }

  return "";
}

export function AdminPage() {
  const [activeTab, setActiveTab] = useState<"users" | "listings" | "deals" | "reviews" | "reports" | "audit" | "achievements" | "broadcast">("users");
  const [dealCancellationFilter, setDealCancellationFilter] = useState<"ALL" | "BUYER" | "SELLER" | "SYSTEM">("ALL");
  const [reportStatusFilter, setReportStatusFilter] = useState<"ALL" | "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "REJECTED">("ALL");
  const [reportTargetFilter, setReportTargetFilter] = useState<"ALL" | "LISTING" | "USER" | "REVIEW" | "DEAL" | "MESSAGE">("ALL");
  const [auditActionFilter, setAuditActionFilter] = useState("ALL");
  const [auditEntityFilter, setAuditEntityFilter] = useState("ALL");
  const [userFilter, setUserFilter] = useState<"ALL" | "BANNED" | "WARNED">("ALL");
  const [userSort, setUserSort] = useState<
    "NAME" | "REGISTERED_NEW" | "REGISTERED_OLD" | "UNBAN_NEAREST" | "UNBAN_FARTHEST"
  >("NAME");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [deals, setDeals] = useState<DealItem[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [achievements, setAchievements] = useState<AchievementItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);

  const [achievementCode, setAchievementCode] = useState("");
  const [achievementTitle, setAchievementTitle] = useState("");
  const [achievementDescription, setAchievementDescription] = useState("");
  const [selectedAchievementCode, setSelectedAchievementCode] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedUserQuery, setSelectedUserQuery] = useState("");
  const [userSuggestionsOpen, setUserSuggestionsOpen] = useState(false);
  const [createAchievementDialogOpen, setCreateAchievementDialogOpen] = useState(false);
  const [achievementSort, setAchievementSort] = useState<"NAME" | "DATE_NEW" | "DATE_OLD" | "RAREST" | "MOST_COMMON">("DATE_NEW");
  const [achievementDialog, setAchievementDialog] = useState<
    | {
        mode: "edit" | "delete";
        achievement: AchievementItem;
      }
    | null
  >(null);
  const [achievementDialogTitle, setAchievementDialogTitle] = useState("");
  const [achievementDialogDescription, setAchievementDialogDescription] = useState("");
  const [systemMessageTitle, setSystemMessageTitle] = useState("TradeGame notifications");
  const [systemMessageText, setSystemMessageText] = useState("");

  const [query, setQuery] = useState("");
  const [banDuration, setBanDuration] = useState<"1day" | "3days" | "7days" | "30days" | "PERMANENT">("1day");
  const [moderationReason, setModerationReason] = useState("");
  const [moderationDialog, setModerationDialog] = useState<
    | { type: "ban" | "warn"; user: ModerationTargetUser }
    | null
  >(null);
  const [reportCaseDialogOpen, setReportCaseDialogOpen] = useState(false);
  const [reportCaseLoading, setReportCaseLoading] = useState(false);
  const [selectedReportCase, setSelectedReportCase] = useState<ReportCase | null>(null);
  const [reportAdminNote, setReportAdminNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const tabClass = useMemo(
    () =>
      (tab: "users" | "listings" | "deals" | "reviews" | "reports" | "audit" | "achievements" | "broadcast") =>
        `rounded-lg px-3 py-2 text-sm font-medium transition ${
          activeTab === tab ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent"
        }`,
    [activeTab],
  );

  const displayedUsers = useMemo(() => {
    const now = Date.now();

    const filtered = users.filter((user) => {
      if (userFilter === "BANNED") {
        return user.isBanned;
      }

      if (userFilter === "WARNED") {
        return user.warningCount > 0;
      }

      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      if (userSort === "NAME") {
        return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" });
      }

      if (userSort === "REGISTERED_NEW") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }

      if (userSort === "REGISTERED_OLD") {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }

      const aPermanent = a.isBannedPermanent;
      const bPermanent = b.isBannedPermanent;
      const aUntil = a.bannedUntil ? new Date(a.bannedUntil).getTime() : Number.POSITIVE_INFINITY;
      const bUntil = b.bannedUntil ? new Date(b.bannedUntil).getTime() : Number.POSITIVE_INFINITY;
      const aActiveTempBan = !aPermanent && a.isBanned && aUntil > now;
      const bActiveTempBan = !bPermanent && b.isBanned && bUntil > now;

      if (aActiveTempBan && bActiveTempBan) {
        return userSort === "UNBAN_NEAREST" ? aUntil - bUntil : bUntil - aUntil;
      }

      if (aActiveTempBan) return userSort === "UNBAN_NEAREST" ? -1 : 1;
      if (bActiveTempBan) return userSort === "UNBAN_NEAREST" ? 1 : -1;

      if (aPermanent && !bPermanent) return 1;
      if (!aPermanent && bPermanent) return -1;

      return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" });
    });

    return sorted;
  }, [users, userFilter, userSort]);

  const achievementUserSuggestions = useMemo(() => {
    const normalized = selectedUserQuery.trim().toLowerCase();
    if (!normalized) return users.slice(0, 8);

    return users
      .filter(
        (user) =>
          user.displayName.toLowerCase().includes(normalized) ||
          user.email.toLowerCase().includes(normalized),
      )
      .slice(0, 8);
  }, [users, selectedUserQuery]);

  const displayedAchievements = useMemo(() => {
    const next = [...achievements];

    next.sort((a, b) => {
      if (achievementSort === "NAME") {
        return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
      }

      if (achievementSort === "DATE_NEW") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }

      if (achievementSort === "DATE_OLD") {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }

      const aUsers = a._count?.users ?? 0;
      const bUsers = b._count?.users ?? 0;
      if (achievementSort === "RAREST") {
        if (aUsers !== bUsers) return aUsers - bUsers;
        return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
      }

      if (aUsers !== bUsers) return bUsers - aUsers;
      return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
    });

    return next;
  }, [achievements, achievementSort]);

  useEffect(() => {
    if (!selectedUserId) return;
    const selectedUser = users.find((user) => user.id === selectedUserId);
    if (!selectedUser) return;

    const label = `${selectedUser.displayName} (${selectedUser.email})`;
    if (selectedUserQuery !== label) {
      setSelectedUserQuery(label);
    }
  }, [selectedUserId, selectedUserQuery, users]);

  async function loadAll() {
    setLoading(true);
    setErr(null);

    try {
      const normalizedQuery = query.trim();
      const queryParams = normalizedQuery ? { search: normalizedQuery, limit: 20 } : { limit: 20 };
      const dealsParams = {
        limit: 20,
        ...(dealCancellationFilter !== "ALL"
          ? { canceledByActor: dealCancellationFilter }
          : {}),
      };
      const reportsParams = {
        ...queryParams,
        ...(reportStatusFilter !== "ALL" ? { status: reportStatusFilter } : {}),
        ...(reportTargetFilter !== "ALL" ? { targetType: reportTargetFilter } : {}),
      };
      const auditParams = {
        ...queryParams,
        ...(auditActionFilter !== "ALL" ? { action: auditActionFilter } : {}),
        ...(auditEntityFilter !== "ALL" ? { entityType: auditEntityFilter } : {}),
      };

      const [overviewRes, usersRes, listingsRes, dealsRes, reviewsRes, reportsRes, auditLogsRes, achievementsRes] = await Promise.all([
        http.get<Overview>("/admin/overview"),
        http.get<ListResponse<UserItem>>("/admin/users", { params: queryParams }),
        http.get<ListResponse<ListingItem>>("/admin/listings", { params: queryParams }),
        http.get<ListResponse<DealItem>>("/admin/deals", { params: dealsParams }),
        http.get<ListResponse<ReviewItem>>("/admin/reviews", { params: { limit: 20 } }),
        http.get<ListResponse<ReportItem>>("/admin/reports", { params: reportsParams }),
        http.get<ListResponse<AuditLogItem>>("/admin/audit-logs", { params: auditParams }),
        http.get<ListResponse<AchievementItem>>("/admin/achievements", { params: queryParams }),
      ]);

      setOverview(overviewRes.data);
      setUsers(usersRes.data.data);
      setListings(listingsRes.data.data);
      setDeals(dealsRes.data.data);
      setReviews(reviewsRes.data.data);
      setReports(reportsRes.data.data);
      setAuditLogs(auditLogsRes.data.data);
      setAchievements(achievementsRes.data.data);
    } catch (error: unknown) {
      setErr(extractHttpErrorMessage(error, "Failed to load admin data"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealCancellationFilter, reportStatusFilter, reportTargetFilter, auditActionFilter, auditEntityFilter]);

  async function refreshByTab() {
    setBusy(true);
    setErr(null);
    setSuccess(null);

    try {
      await loadAll();
    } finally {
      setBusy(false);
    }
  }

  async function setRole(userId: string, role: "USER" | "ADMIN") {
    setBusy(true);
    setErr(null);
    setSuccess(null);

    try {
      await http.patch(`/admin/users/${userId}/role`, { role });
      await loadAll();
      setSuccess("User role updated.");
    } catch (error: unknown) {
      setErr(extractHttpErrorMessage(error, "Failed to update role"));
    } finally {
      setBusy(false);
    }
  }

  function openModerationDialog(type: "ban" | "warn", user: ModerationTargetUser) {
    setModerationReason("");
    setBanDuration("1day");
    setModerationDialog({ type, user });
  }

  function closeModerationDialog() {
    setModerationDialog(null);
    setModerationReason("");
    setBanDuration("1day");
  }

  async function submitModerationDialog() {
    if (!moderationDialog) return;

    setBusy(true);
    setErr(null);
    setSuccess(null);

    try {
      const reason = moderationReason.trim();
      if (!reason) {
        setErr("Reason is required.");
        return;
      }

      if (moderationDialog.type === "ban") {
        await http.post(`/admin/users/${moderationDialog.user.id}/ban`, {
          duration: banDuration,
          reason,
        });
        setSuccess(`User ${moderationDialog.user.displayName} banned.`);
      } else {
        await http.post(`/admin/users/${moderationDialog.user.id}/warn`, {
          reason,
        });
        setSuccess(`Warning sent to ${moderationDialog.user.displayName}.`);
      }

      closeModerationDialog();
      await loadAll();
    } catch (error: unknown) {
      setErr(extractHttpErrorMessage(error, "Moderation action failed"));
    } finally {
      setBusy(false);
    }
  }

  async function unbanUser(userId: string) {
    setBusy(true);
    setErr(null);
    setSuccess(null);

    try {
      await http.post(`/admin/users/${userId}/unban`);
      await loadAll();
      setSuccess("User unbanned.");
    } catch (error: unknown) {
      setErr(extractHttpErrorMessage(error, "Failed to unban user"));
    } finally {
      setBusy(false);
    }
  }

  async function unwarnUser(userId: string) {
    setBusy(true);
    setErr(null);
    setSuccess(null);

    try {
      await http.post(`/admin/users/${userId}/unwarn`);
      await loadAll();
      setSuccess("One warning removed.");
    } catch (error: unknown) {
      setErr(extractHttpErrorMessage(error, "Failed to remove warning"));
    } finally {
      setBusy(false);
    }
  }

  async function removeUserAvatar(userId: string) {
    setBusy(true);
    setErr(null);
    setSuccess(null);

    try {
      await http.post(`/admin/users/${userId}/remove-avatar`);
      await loadAll();
      setSuccess("User avatar removed.");
    } catch (error: unknown) {
      setErr(extractHttpErrorMessage(error, "Failed to remove avatar"));
    } finally {
      setBusy(false);
    }
  }

  async function moderateListing(listingId: string, action: "archive" | "restore") {
    setBusy(true);
    setErr(null);
    setSuccess(null);

    try {
      await http.patch(`/admin/listings/${listingId}/${action}`);
      await loadAll();
      setSuccess(`Listing ${action}d successfully.`);
    } catch (error: unknown) {
      setErr(extractHttpErrorMessage(error, `Failed to ${action} listing`));
    } finally {
      setBusy(false);
    }
  }

  async function removeReview(reviewId: string) {
    setBusy(true);
    setErr(null);
    setSuccess(null);

    try {
      await http.delete(`/admin/reviews/${reviewId}`);
      await loadAll();
      setSuccess("Review deleted.");
    } catch (error: unknown) {
      setErr(extractHttpErrorMessage(error, "Failed to delete review"));
    } finally {
      setBusy(false);
    }
  }

  async function openReportCase(reportId: string) {
    setReportCaseDialogOpen(true);
    setReportCaseLoading(true);
    setSelectedReportCase(null);
    setReportAdminNote("");
    setErr(null);

    try {
      const response = await http.get<ReportCase>(`/admin/reports/${reportId}/case`);
      setSelectedReportCase(response.data);
      setReportAdminNote(response.data.report.adminNote ?? "");
    } catch (error: unknown) {
      setErr(extractHttpErrorMessage(error, "Failed to load report case"));
    } finally {
      setReportCaseLoading(false);
    }
  }

  function closeReportCaseDialog() {
    setReportCaseDialogOpen(false);
    setSelectedReportCase(null);
    setReportCaseLoading(false);
    setReportAdminNote("");
  }

  async function moderateSelectedReport(status: ReportItem["status"]) {
    if (!selectedReportCase) return;

    setBusy(true);
    setErr(null);
    setSuccess(null);

    try {
      const normalizedNote = reportAdminNote.trim();
      const adminNote = normalizedNote.length > 0 ? normalizedNote : undefined;

      await http.patch(`/admin/reports/${selectedReportCase.report.id}`, {
        status,
        adminNote,
      });

      await loadAll();
      if (status === "RESOLVED" || status === "REJECTED") {
        closeReportCaseDialog();
      } else if (selectedReportCase) {
        await openReportCase(selectedReportCase.report.id);
      }
      setSuccess(`Report updated to ${status}.`);
    } catch (error: unknown) {
      setErr(extractHttpErrorMessage(error, "Failed to moderate report"));
    } finally {
      setBusy(false);
    }
  }

  async function createAchievement() {
    setBusy(true);
    setErr(null);
    setSuccess(null);

    try {
      const code = achievementCode.trim().toUpperCase();
      const title = achievementTitle.trim();
      const description = achievementDescription.trim();

      if (!code || !title || !description) {
        setErr("Code, title and description are required.");
        return false;
      }

      await http.post("/admin/achievements", {
        code,
        title,
        description,
      });

      setAchievementCode("");
      setAchievementTitle("");
      setAchievementDescription("");
      await loadAll();
      setSuccess("Achievement created.");
      return true;
    } catch (error: unknown) {
      setErr(extractHttpErrorMessage(error, "Failed to create achievement"));
      return false;
    } finally {
      setBusy(false);
    }
  }

  function openEditAchievementDialog(achievement: AchievementItem) {
    setAchievementDialog({ mode: "edit", achievement });
    setAchievementDialogTitle(achievement.title);
    setAchievementDialogDescription(achievement.description);
  }

  function openDeleteAchievementDialog(achievement: AchievementItem) {
    setAchievementDialog({ mode: "delete", achievement });
    setAchievementDialogTitle(achievement.title);
    setAchievementDialogDescription(achievement.description);
  }

  function closeAchievementDialog() {
    setAchievementDialog(null);
    setAchievementDialogTitle("");
    setAchievementDialogDescription("");
  }

  async function submitAchievementDialog() {
    if (!achievementDialog) return;

    setBusy(true);
    setErr(null);
    setSuccess(null);

    try {
      if (achievementDialog.mode === "edit") {
        const title = achievementDialogTitle.trim();
        const description = achievementDialogDescription.trim();
        if (!title || !description) {
          setErr("Title and description are required.");
          return;
        }

        await http.patch(`/admin/achievements/${achievementDialog.achievement.id}`, {
          title,
          description,
        });

        setSuccess("Achievement updated.");
      } else {
        await http.delete(`/admin/achievements/${achievementDialog.achievement.id}`);
        setSuccess("Achievement deleted.");
      }

      closeAchievementDialog();
      await loadAll();
    } catch (error: unknown) {
      setErr(extractHttpErrorMessage(error, "Achievement action failed"));
    } finally {
      setBusy(false);
    }
  }

  async function assignAchievement() {
    setBusy(true);
    setErr(null);
    setSuccess(null);

    try {
      const userId = selectedUserId.trim();
      const code = selectedAchievementCode.trim().toUpperCase();

      if (!userId || !code) {
        setErr("Select user and achievement first.");
        return;
      }

      await http.post(`/admin/users/${userId}/achievements`, {
        achievementCode: code,
      });

      await loadAll();
      setSuccess("Achievement assigned to user.");
    } catch (error: unknown) {
      setErr(extractHttpErrorMessage(error, "Failed to assign achievement"));
    } finally {
      setBusy(false);
    }
  }

  async function finalizePreviousWeekReward() {
    setBusy(true);
    setErr(null);
    setSuccess(null);

    try {
      const response = await http.post<WeeklyFinalizeResponse>(
        "/admin/weekly-rewards/finalize-previous-week",
      );

      const winnerName =
        response.data.winner?.displayName ??
        response.data.competition.winner?.displayName;

      if (response.data.competition.status === "CANCELED") {
        setSuccess("Weekly reward finalized: no eligible winner this week.");
      } else if (response.data.alreadyFinalized) {
        setSuccess(
          winnerName
            ? `Weekly reward was already finalized for ${winnerName}.`
            : "Weekly reward was already finalized.",
        );
      } else {
        setSuccess(
          winnerName
            ? `Weekly reward finalized. Winner: ${winnerName}.`
            : "Weekly reward finalized.",
        );
      }

      await loadAll();
    } catch (error: unknown) {
      setErr(
        extractHttpErrorMessage(error, "Failed to finalize weekly reward"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function broadcastSystemMessage() {
    setBusy(true);
    setErr(null);
    setSuccess(null);

    try {
      const text = systemMessageText.trim();

      if (!text) {
        setErr("Message text is required.");
        return;
      }

      const response = await http.post<{ sent: number }>(
        "/admin/system-notifications/broadcast",
        {
          title: systemMessageTitle.trim() || undefined,
          text,
        },
      );

      setSystemMessageText("");
      setSuccess(`Broadcast sent to ${response.data.sent} users.`);
    } catch (error: unknown) {
      setErr(extractHttpErrorMessage(error, "Failed to send broadcast"));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingState width="max-w-7xl" />;
  if (err && !overview) return <ErrorState width="max-w-7xl" message={err} />;

  return (
    <PageContainer width="max-w-7xl" className="space-y-6">
      <PageHeader
        title="Admin"
        subtitle="Users, listings, deals, reports, audit logs and review moderation in one place."
      />

      {overview && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
          <Card><CardContent className="space-y-1"><div className="text-xs text-muted-foreground">Users</div><div className="text-lg font-semibold text-foreground">{overview.users}</div></CardContent></Card>
          <Card><CardContent className="space-y-1"><div className="text-xs text-muted-foreground">Listings</div><div className="text-lg font-semibold text-foreground">{overview.listings}</div></CardContent></Card>
          <Card><CardContent className="space-y-1"><div className="text-xs text-muted-foreground">Active Listings</div><div className="text-lg font-semibold text-foreground">{overview.activeListings}</div></CardContent></Card>
          <Card><CardContent className="space-y-1"><div className="text-xs text-muted-foreground">Deals</div><div className="text-lg font-semibold text-foreground">{overview.deals}</div></CardContent></Card>
          <Card><CardContent className="space-y-1"><div className="text-xs text-muted-foreground">Active Deals</div><div className="text-lg font-semibold text-foreground">{overview.activeDeals}</div></CardContent></Card>
          <Card><CardContent className="space-y-1"><div className="text-xs text-muted-foreground">Reviews</div><div className="text-lg font-semibold text-foreground">{overview.reviews}</div></CardContent></Card>
          <Card><CardContent className="space-y-1"><div className="text-xs text-muted-foreground">Open Reports</div><div className="text-lg font-semibold text-foreground">{overview.reports}</div></CardContent></Card>
        </div>
      )}

      <Card>
        <CardHeader className="space-y-3">
          <div className="grid w-full grid-cols-2 gap-2 rounded-xl border border-border bg-card p-2 sm:w-[940px] sm:grid-cols-8">
            <button type="button" className={tabClass("users")} onClick={() => setActiveTab("users")}>Users</button>
            <button type="button" className={tabClass("listings")} onClick={() => setActiveTab("listings")}>Listings</button>
            <button type="button" className={tabClass("deals")} onClick={() => setActiveTab("deals")}>Deals</button>
            <button type="button" className={tabClass("reviews")} onClick={() => setActiveTab("reviews")}>Reviews</button>
            <button type="button" className={tabClass("achievements")} onClick={() => setActiveTab("achievements")}>Achievements</button>
            <button type="button" className={tabClass("reports")} onClick={() => setActiveTab("reports")}>Reports</button>
            <button type="button" className={tabClass("audit")} onClick={() => setActiveTab("audit")}>Audit Logs</button>
            <button type="button" className={tabClass("broadcast")} onClick={() => setActiveTab("broadcast")}>Broadcast</button>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="Search users/listings/reports/audit..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  refreshByTab().catch(() => {});
                }
              }}
            />
            <Button type="button" onClick={() => refreshByTab().catch(() => {})} disabled={busy}>
              {busy ? "Working..." : "Refresh"}
            </Button>
            {activeTab === "achievements" && (
              <Button
                type="button"
                disabled={busy}
                onClick={() => setCreateAchievementDialogOpen(true)}
              >
                Create achievement
              </Button>
            )}
            {activeTab === "deals" && (
              <select
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
                value={dealCancellationFilter}
                onChange={(e) =>
                  setDealCancellationFilter(
                    e.target.value as "ALL" | "BUYER" | "SELLER" | "SYSTEM",
                  )
                }
              >
                <option value="ALL">All cancellation sources</option>
                <option value="BUYER">Canceled by buyer</option>
                <option value="SELLER">Canceled by seller</option>
                <option value="SYSTEM">Canceled by timeout</option>
              </select>
            )}
            {activeTab === "reports" && (
              <select
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
                value={reportStatusFilter}
                onChange={(e) =>
                  setReportStatusFilter(
                    e.target.value as "ALL" | "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "REJECTED",
                  )
                }
              >
                <option value="ALL">All report statuses</option>
                <option value="OPEN">Open</option>
                <option value="UNDER_REVIEW">Under review</option>
                <option value="RESOLVED">Resolved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            )}
            {activeTab === "audit" && (
              <select
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value)}
              >
                <option value="ALL">All actions</option>
                <option value="USER_ROLE_UPDATED">USER_ROLE_UPDATED</option>
                <option value="LISTING_ARCHIVED">LISTING_ARCHIVED</option>
                <option value="LISTING_RESTORED">LISTING_RESTORED</option>
                <option value="REVIEW_DELETED">REVIEW_DELETED</option>
                <option value="REPORT_MODERATED">REPORT_MODERATED</option>
                <option value="ACHIEVEMENT_CREATED">ACHIEVEMENT_CREATED</option>
                <option value="ACHIEVEMENT_UPDATED">ACHIEVEMENT_UPDATED</option>
                <option value="ACHIEVEMENT_DELETED">ACHIEVEMENT_DELETED</option>
                <option value="ACHIEVEMENT_ASSIGNED">ACHIEVEMENT_ASSIGNED</option>
                <option value="WEEKLY_REWARD_FINALIZED">WEEKLY_REWARD_FINALIZED</option>
                <option value="SYSTEM_BROADCAST_SENT">SYSTEM_BROADCAST_SENT</option>
                <option value="USER_BANNED">USER_BANNED</option>
                <option value="USER_UNBANNED">USER_UNBANNED</option>
                <option value="USER_WARNED">USER_WARNED</option>
                <option value="USER_UNWARNED">USER_UNWARNED</option>
                <option value="USER_AVATAR_REMOVED">USER_AVATAR_REMOVED</option>
              </select>
            )}
            {activeTab === "audit" && (
              <select
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
                value={auditEntityFilter}
                onChange={(e) => setAuditEntityFilter(e.target.value)}
              >
                <option value="ALL">All entities</option>
                <option value="USER">USER</option>
                <option value="LISTING">LISTING</option>
                <option value="REVIEW">REVIEW</option>
                <option value="REPORT">REPORT</option>
                <option value="ACHIEVEMENT">ACHIEVEMENT</option>
                <option value="WEEKLY_COMPETITION">WEEKLY_COMPETITION</option>
                <option value="SYSTEM_NOTIFICATION">SYSTEM_NOTIFICATION</option>
              </select>
            )}
            {activeTab === "reports" && (
              <select
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
                value={reportTargetFilter}
                onChange={(e) =>
                  setReportTargetFilter(
                    e.target.value as "ALL" | "LISTING" | "USER" | "REVIEW" | "DEAL" | "MESSAGE",
                  )
                }
              >
                <option value="ALL">All targets</option>
                <option value="LISTING">Listing</option>
                <option value="USER">User</option>
                <option value="REVIEW">Review</option>
                <option value="DEAL">Deal</option>
                <option value="MESSAGE">Message</option>
              </select>
            )}
            {activeTab === "users" && (
              <select
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value as "ALL" | "BANNED" | "WARNED")}
              >
                <option value="ALL">All users</option>
                <option value="BANNED">Banned</option>
                <option value="WARNED">Warned</option>
              </select>
            )}
            {activeTab === "users" && (
              <select
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
                value={userSort}
                onChange={(e) =>
                  setUserSort(
                    e.target.value as "NAME" | "REGISTERED_NEW" | "REGISTERED_OLD" | "UNBAN_NEAREST" | "UNBAN_FARTHEST",
                  )
                }
              >
                <option value="NAME">Sort: name</option>
                <option value="REGISTERED_NEW">Sort: register date (newest)</option>
                <option value="REGISTERED_OLD">Sort: register date (oldest)</option>
                <option value="UNBAN_NEAREST">Sort: time to unban (nearest)</option>
                <option value="UNBAN_FARTHEST">Sort: time to unban (farthest)</option>
              </select>
            )}
            {activeTab === "achievements" && (
              <select
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
                value={achievementSort}
                onChange={(e) =>
                  setAchievementSort(
                    e.target.value as "NAME" | "DATE_NEW" | "DATE_OLD" | "RAREST" | "MOST_COMMON",
                  )
                }
              >
                <option value="NAME">Sort: name</option>
                <option value="DATE_NEW">Sort: date (newest)</option>
                <option value="DATE_OLD">Sort: date (oldest)</option>
                <option value="RAREST">Sort: rarity (rarest)</option>
                <option value="MOST_COMMON">Sort: rarity (most common)</option>
              </select>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => finalizePreviousWeekReward().catch(() => {})}
              disabled={busy}
            >
              Finalize weekly reward
            </Button>
          </div>

          {err && <div className="text-sm text-destructive">{err}</div>}
          {success && <div className="text-sm text-success">{success}</div>}
        </CardHeader>

        <CardContent>
          {activeTab === "users" && (
            <div className="space-y-3">
              {displayedUsers.map((user) => (
                <div key={user.id} className="rounded-xl border border-border bg-muted p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        className="group relative h-12 w-12 shrink-0"
                        disabled={busy || !user.avatarUrl}
                        onClick={() => removeUserAvatar(user.id)}
                        title={user.avatarUrl ? "Remove avatar" : "No avatar"}
                      >
                        {user.avatarUrl ? (
                          <img
                            src={user.avatarUrl}
                            alt={user.displayName}
                            className="h-12 w-12 rounded-full border border-border object-cover"
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card text-sm font-semibold text-muted-foreground">
                            {user.displayName.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        {user.avatarUrl && (
                          <span className="pointer-events-none absolute inset-0 hidden items-center justify-center rounded-full bg-red-600/55 text-sm font-bold text-white group-hover:flex">
                            X
                          </span>
                        )}
                      </button>

                      <div>
                        <Link
                          to={`/users/${user.id}`}
                          target="_blank"
                          className="font-medium text-foreground underline-offset-2 hover:underline"
                        >
                          {user.displayName}
                        </Link>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Listings: {user._count.listings} · Buyer deals: {user._count.buyerDeals} · Seller deals: {user._count.sellerDeals}
                        </div>
                        <div className="mt-1 text-xs text-destructive">
                          Warnings {user.warningCount}/{user.warningLimit}
                        </div>
                        {user.isBanned && (
                          <div className="mt-1 text-xs text-destructive">
                            {user.isBannedPermanent
                              ? `Banned permanently${user.banReason ? `: ${user.banReason}` : ""}`
                              : `Banned until ${user.bannedUntil ? new Date(user.bannedUntil).toLocaleString() : "unknown"}${user.banReason ? `: ${user.banReason}` : ""}`}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {(["USER", "ADMIN"] as const).map((role) => (
                        <Button
                          key={role}
                          type="button"
                          size="sm"
                          variant={(role === "ADMIN" ? user.role === "ADMIN" : user.role !== "ADMIN") ? "default" : "outline"}
                          disabled={busy}
                          onClick={() => setRole(user.id, role)}
                        >
                          {role}
                        </Button>
                      ))}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => openModerationDialog("warn", user)}
                      >
                        Warn
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy || user.warningCount <= 0}
                        onClick={() => unwarnUser(user.id)}
                      >
                        Unwarn
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={busy}
                        onClick={() => openModerationDialog("ban", user)}
                      >
                        Ban
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy || !user.isBanned}
                        onClick={() => unbanUser(user.id)}
                      >
                        Unban
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {displayedUsers.length === 0 && (
                <div className="rounded-xl border border-border bg-muted p-4 text-sm text-muted-foreground">
                  No users found for selected filters.
                </div>
              )}
            </div>
          )}

          {activeTab === "listings" && (
            <div className="space-y-3">
              {listings.map((listing) => (
                <div key={listing.id} className="rounded-xl border border-border bg-muted p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-foreground">{listing.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {listing.seller.displayName} ({listing.seller.email})
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {listing.type} · {listing.category} · {formatAmount(listing.price)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant={listing.status === "ACTIVE" ? "default" : "muted"}>{listing.status}</Badge>
                      {listing.status === "ACTIVE" ? (
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => moderateListing(listing.id, "archive")}>
                          Archive
                        </Button>
                      ) : (
                        <Button size="sm" disabled={busy} onClick={() => moderateListing(listing.id, "restore")}>
                          Restore
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "deals" && (
            <div className="space-y-3">
              {deals.map((deal) => (
                <div key={deal.id} className="rounded-xl border border-border bg-muted p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-foreground">{deal.listing.title}</div>
                      <div className="text-xs text-muted-foreground">
                        Buyer: {deal.buyer.displayName} · Seller: {deal.seller.displayName}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {formatAmount(deal.unitPriceSnapshot)} × {deal.quantity} = {formatAmount(deal.totalAmountSnapshot)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{deal.status}</Badge>
                      {deal.status === "CANCELED" && deal.canceledByActor && (
                        <Badge variant="muted">
                          By {deal.canceledByActor === "SYSTEM" ? "timeout" : deal.canceledByActor.toLowerCase()}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "reviews" && (
            <div className="space-y-3">
              {reviews.map((review) => (
                <div key={review.id} className="rounded-xl border border-border bg-muted p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-foreground">
                        {review.deal.listing.title} · {review.rating}/5
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Buyer: {review.buyer.displayName} · Seller: {review.seller.displayName}
                      </div>
                      {review.comment && (
                        <div className="mt-1 text-sm text-foreground">{review.comment}</div>
                      )}
                    </div>
                    <Button size="sm" variant="destructive" disabled={busy} onClick={() => removeReview(review.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "reports" && (
            <div className="space-y-3">
              {reports.map((report) => (
                <div key={report.id} className="rounded-xl border border-border bg-muted p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="font-medium text-foreground">{report.reason}</div>
                      <div className="text-xs text-muted-foreground">
                        Reporter: {report.reporter.displayName} ({report.reporter.email})
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Target: {report.targetType} · {report.targetId}
                      </div>
                      {report.details && (
                        <div className="mt-1 text-sm text-foreground whitespace-pre-wrap">{report.details}</div>
                      )}
                      {report.adminNote && (
                        <div className="mt-1 text-xs text-muted-foreground">Admin note: {report.adminNote}</div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        Created: {new Date(report.createdAt).toLocaleString()}
                        {report.reviewedAt ? ` · Reviewed: ${new Date(report.reviewedAt).toLocaleString()}` : ""}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={getReportStatusBadgeClass(report.status)}>{report.status}</Badge>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => openReportCase(report.id).catch(() => {})}>
                        Open case
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

              {reports.length === 0 && (
                <div className="rounded-xl border border-border bg-muted p-4 text-sm text-muted-foreground">
                  No reports found for selected filters.
                </div>
              )}
            </div>
          )}

          {activeTab === "audit" && (
            <div className="space-y-3">
              {auditLogs.map((log) => (
                <div key={log.id} className="rounded-xl border border-border bg-muted p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="font-medium text-foreground">{log.summary ?? log.action}</div>
                      <div className="text-xs text-muted-foreground">
                        Admin: {log.actorAdmin.displayName} ({log.actorAdmin.email})
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Action: {log.action} · Entity: {log.entityType}
                        {log.entityId ? ` · Entity ID: ${log.entityId}` : ""}
                      </div>
                      {log.requestId && (
                        <div className="text-xs text-muted-foreground">Request ID: {log.requestId}</div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{log.action}</Badge>
                    </div>
                  </div>
                </div>
              ))}

              {auditLogs.length === 0 && (
                <div className="rounded-xl border border-border bg-muted p-4 text-sm text-muted-foreground">
                  No audit logs found for selected filters.
                </div>
              )}
            </div>
          )}

          {activeTab === "broadcast" && (
            <div className="space-y-3">
              <div className="rounded-xl border border-border bg-muted p-3">
                <div className="mb-3 text-sm font-medium text-foreground">System broadcast (pinned TradeGame chat)</div>
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <Input
                    placeholder="Title"
                    value={systemMessageTitle}
                    onChange={(e) => setSystemMessageTitle(e.target.value)}
                  />
                  <Button type="button" disabled={busy} onClick={() => broadcastSystemMessage().catch(() => {})}>
                    {busy ? "Sending..." : "Send broadcast"}
                  </Button>
                </div>
                <div className="mt-2">
                  <Textarea
                    placeholder="Message text"
                    value={systemMessageText}
                    onChange={(e) => setSystemMessageText(e.target.value)}
                    rows={4}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === "achievements" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-muted p-3">
                <div className="mb-3 text-sm font-medium text-foreground">Assign achievement to user</div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="relative">
                    <Input
                      placeholder="Type name or email to find user"
                      value={selectedUserQuery}
                      onFocus={() => setUserSuggestionsOpen(true)}
                      onBlur={() => {
                        setTimeout(() => setUserSuggestionsOpen(false), 120);
                      }}
                      onChange={(e) => {
                        const next = e.target.value;
                        setSelectedUserQuery(next);
                        setSelectedUserId("");
                        setUserSuggestionsOpen(true);
                      }}
                    />
                    {userSuggestionsOpen && achievementUserSuggestions.length > 0 && (
                      <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-card p-1 shadow-lg">
                        {achievementUserSuggestions.map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            className="w-full rounded-md px-2 py-2 text-left text-sm text-foreground hover:bg-accent"
                            onClick={() => {
                              setSelectedUserId(user.id);
                              setSelectedUserQuery(`${user.displayName} (${user.email})`);
                              setUserSuggestionsOpen(false);
                            }}
                          >
                            {user.displayName} ({user.email})
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <select
                    className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
                    value={selectedAchievementCode}
                    onChange={(e) => setSelectedAchievementCode(e.target.value)}
                  >
                    <option value="">Select achievement</option>
                    {achievements.map((achievement) => (
                      <option key={achievement.id} value={achievement.code}>
                        {achievement.title} ({achievement.code})
                      </option>
                    ))}
                  </select>
                  <Button type="button" disabled={busy} onClick={() => assignAchievement().catch(() => {})}>
                    {busy ? "Assigning..." : "Assign"}
                  </Button>
                </div>
              </div>

              {displayedAchievements.map((achievement) => (
                <div key={achievement.id} className="rounded-xl border border-border bg-muted p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-foreground">{achievement.title}</div>
                      <div className="mt-1 text-sm text-muted-foreground">{achievement.description}</div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        Created: {new Date(achievement.createdAt).toLocaleDateString()}
                        {achievement._count ? ` · Unlocked by ${achievement._count.users} users` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{achievement.code}</Badge>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => openEditAchievementDialog(achievement)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="destructive" disabled={busy} onClick={() => openDeleteAchievementDialog(achievement)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {reportCaseDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-4xl rounded-2xl border border-border bg-card p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="text-base font-semibold text-foreground">Report case review</div>
              <Button type="button" variant="ghost" size="sm" onClick={closeReportCaseDialog}>
                Close
              </Button>
            </div>

            {reportCaseLoading && (
              <div className="rounded-lg border border-border bg-muted p-4 text-sm text-muted-foreground">
                Loading report context...
              </div>
            )}

            {!reportCaseLoading && selectedReportCase && (
              <div className="space-y-4">
                {(() => {
                  const isFinalStatus =
                    selectedReportCase.report.status === "RESOLVED" ||
                    selectedReportCase.report.status === "REJECTED";

                  return (
                    <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-border bg-muted p-3">
                    <div className="text-sm font-medium text-foreground">Reporter details</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {selectedReportCase.report.reporter.displayName} ({selectedReportCase.report.reporter.email})
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Created: {new Date(selectedReportCase.report.createdAt).toLocaleString()}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Target: {selectedReportCase.report.targetType} · {selectedReportCase.report.targetId}
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-muted p-3">
                    <div className="text-sm font-medium text-foreground">Reported user moderation context</div>
                    {selectedReportCase.reportedUser ? (
                      <>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {selectedReportCase.reportedUser.displayName} ({selectedReportCase.reportedUser.email})
                        </div>
                        <div className="mt-1 text-xs text-destructive">
                          Warnings {selectedReportCase.reportedUser.warningCount}/{selectedReportCase.reportedUser.warningLimit}
                        </div>
                        {selectedReportCase.reportedUser.isBanned && (
                          <div className="mt-1 text-xs text-destructive">
                            {selectedReportCase.reportedUser.isBannedPermanent
                              ? "Banned permanently"
                              : `Banned until ${selectedReportCase.reportedUser.bannedUntil ? new Date(selectedReportCase.reportedUser.bannedUntil).toLocaleString() : "unknown"}`}
                          </div>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy || isFinalStatus}
                            onClick={() =>
                              openModerationDialog("warn", {
                                id: selectedReportCase.reportedUser!.id,
                                displayName: selectedReportCase.reportedUser!.displayName,
                                email: selectedReportCase.reportedUser!.email,
                              })
                            }
                          >
                            Warn user
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={busy || isFinalStatus}
                            onClick={() =>
                              openModerationDialog("ban", {
                                id: selectedReportCase.reportedUser!.id,
                                displayName: selectedReportCase.reportedUser!.displayName,
                                email: selectedReportCase.reportedUser!.email,
                              })
                            }
                          >
                            Ban user
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="mt-1 text-sm text-muted-foreground">
                        Could not identify a direct reported user for this case.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-muted p-3">
                  <div className="text-sm font-medium text-foreground">User complaint</div>
                  <div className="mt-1 text-sm text-foreground">{selectedReportCase.report.reason}</div>
                  {selectedReportCase.report.details && (
                    <div className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                      {selectedReportCase.report.details}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-border bg-muted p-3">
                  <div className="text-sm font-medium text-foreground">Evidence snippets (chat/messages)</div>
                  {selectedReportCase.evidenceMessages && selectedReportCase.evidenceMessages.length > 0 ? (
                    <div className="mt-2 max-h-[200px] space-y-2 overflow-y-auto pr-1">
                      {selectedReportCase.evidenceMessages.map((message) => (
                        <div key={message.id} className="rounded border border-border bg-background p-2">
                          <div className="text-xs text-muted-foreground">
                            {message.sender?.displayName ?? "Unknown"} · {new Date(message.createdAt).toLocaleString()}
                          </div>
                          <div className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                            {message.text || "(media message)"}
                          </div>
                          {message.mediaUrl && (
                            <div className="mt-1 text-xs text-primary">Media: {message.mediaType ?? "unknown"}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-muted-foreground">No message evidence available.</div>
                  )}
                </div>

                <div className="rounded-lg border border-border bg-muted p-3">
                  <div className="text-sm font-medium text-foreground">Admin note</div>
                  <Textarea
                    className="mt-2"
                    placeholder="Write moderation note/reasoning"
                    value={reportAdminNote}
                    onChange={(e) => setReportAdminNote(e.target.value)}
                    rows={3}
                  />

                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <Badge
                      variant="outline"
                      className={getReportStatusBadgeClass(selectedReportCase.report.status)}
                    >
                      Current: {selectedReportCase.report.status}
                    </Badge>
                    {isFinalStatus ? (
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => moderateSelectedReport("OPEN").catch(() => {})}>
                        Reopen
                      </Button>
                    ) : (
                      <>
                        <Button size="sm" disabled={busy} onClick={() => moderateSelectedReport("RESOLVED").catch(() => {})}>
                          Resolve
                        </Button>
                        <Button size="sm" variant="destructive" disabled={busy} onClick={() => moderateSelectedReport("REJECTED").catch(() => {})}>
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      {achievementDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="text-base font-semibold text-foreground">
                {achievementDialog.mode === "edit" ? "Edit achievement" : "Delete achievement"}
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={closeAchievementDialog}>
                Close
              </Button>
            </div>

            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                Code: <span className="font-medium text-foreground">{achievementDialog.achievement.code}</span>
              </div>

              {achievementDialog.mode === "edit" ? (
                <>
                  <Input
                    placeholder="Title"
                    value={achievementDialogTitle}
                    onChange={(e) => setAchievementDialogTitle(e.target.value)}
                  />
                  <Textarea
                    placeholder="Description"
                    value={achievementDialogDescription}
                    onChange={(e) => setAchievementDialogDescription(e.target.value)}
                    rows={4}
                  />
                </>
              ) : (
                <div className="rounded-lg border border-border bg-muted p-3 text-sm text-foreground">
                  This will permanently delete <span className="font-medium">{achievementDialog.achievement.title}</span>
                  and remove it from all users.
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeAchievementDialog}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant={achievementDialog.mode === "edit" ? "default" : "destructive"}
                  disabled={busy}
                  onClick={() => submitAchievementDialog().catch(() => {})}
                >
                  {achievementDialog.mode === "edit" ? "Save" : "Delete"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {createAchievementDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="text-base font-semibold text-foreground">Create achievement</div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setCreateAchievementDialogOpen(false)}
              >
                Close
              </Button>
            </div>

            <div className="space-y-3">
              <Input
                placeholder="Code (e.g. FAST_RESPONDER)"
                value={achievementCode}
                onChange={(e) => setAchievementCode(e.target.value)}
              />
              <Input
                placeholder="Title"
                value={achievementTitle}
                onChange={(e) => setAchievementTitle(e.target.value)}
              />
              <Textarea
                placeholder="Description"
                value={achievementDescription}
                onChange={(e) => setAchievementDescription(e.target.value)}
                rows={4}
              />

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateAchievementDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    const ok = await createAchievement();
                    if (ok) {
                      setCreateAchievementDialogOpen(false);
                    }
                  }}
                >
                  {busy ? "Creating..." : "Create"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {moderationDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="text-base font-semibold text-foreground">
                {moderationDialog.type === "ban" ? "Ban user" : "Warn user"}
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={closeModerationDialog}>
                Close
              </Button>
            </div>

            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                Target: <span className="font-medium text-foreground">{moderationDialog.user.displayName}</span> ({moderationDialog.user.email})
              </div>

              {moderationDialog.type === "ban" && (
                <select
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground"
                  value={banDuration}
                  onChange={(e) =>
                    setBanDuration(
                      e.target.value as "1day" | "3days" | "7days" | "30days" | "PERMANENT",
                    )
                  }
                >
                  <option value="1day">1 day</option>
                  <option value="3days">3 days</option>
                  <option value="7days">7 days</option>
                  <option value="30days">30 days</option>
                  <option value="PERMANENT">Permanent</option>
                </select>
              )}

              <Textarea
                placeholder={moderationDialog.type === "ban" ? "Ban reason" : "Warning reason"}
                value={moderationReason}
                onChange={(e) => setModerationReason(e.target.value)}
                rows={4}
              />

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeModerationDialog}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant={moderationDialog.type === "ban" ? "destructive" : "default"}
                  disabled={busy}
                  onClick={() => submitModerationDialog().catch(() => {})}
                >
                  {moderationDialog.type === "ban" ? "Confirm ban" : "Send warning"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
