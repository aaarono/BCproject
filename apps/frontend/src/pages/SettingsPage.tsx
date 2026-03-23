import { useEffect, useRef, useState } from "react";
import { http } from "../api/http";
import { extractHttpErrorMessage } from "../utils/httpError";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { ErrorState, LoadingState } from "../components/ui/PageStates";
import { PageContainer, PageHeader } from "../components/ui/PageLayout";
import { Bell, Camera, Monitor, Moon, Save, Shield, Sun, User } from "lucide-react";
import { cn } from "../lib/cn";
import { Avatar } from "../components/ui/Avatar";
import { useAuth } from "../auth/AuthContext";

type Profile = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
  role: "BUYER" | "SELLER" | "ADMIN";
  ratingAvg: number;
  ratingCount: number;
};

export function SettingsPage() {
  const { refreshMe } = useAuth();
  const [activeTab, setActiveTab] = useState<"profile" | "notifications" | "security" | "appearance">("profile");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [notifications, setNotifications] = useState({
    newMessage: true,
    dealUpdates: true,
    weeklyDigest: true,
    marketing: false,
  });
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [themeMode, setThemeMode] = useState<"light" | "dark" | "system">("system");
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  async function loadProfile() {
    const res = await http.get<Profile>("/users/me/profile");
    setProfile(res.data);
    setDisplayName(res.data.displayName);
    setEmail(res.data.email);
    setAvatarUrl(res.data.avatarUrl ?? "");
  }

  useEffect(() => {
    setLoading(true);
    setErr(null);

    loadProfile()
      .catch((error: unknown) =>
        setErr(extractHttpErrorMessage(error, "Failed to load settings")),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (themeMode === "system") {
      document.documentElement.classList.remove("dark");
      return;
    }

    if (themeMode === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [themeMode]);

  async function save() {
    setSaving(true);
    setErr(null);
    setSuccess(null);

    try {
      const res = await http.patch<Profile>("/users/me", {
        displayName,
        email,
        avatarUrl,
      });

      setProfile(res.data);
      setDisplayName(res.data.displayName);
      setEmail(res.data.email);
      setAvatarUrl(res.data.avatarUrl ?? "");
      await refreshMe();
      setSuccess("Settings saved successfully.");
    } catch (error: unknown) {
      setErr(extractHttpErrorMessage(error, "Failed to save settings"));
    } finally {
      setSaving(false);
    }
  }

  async function saveNotifications() {
    setSuccess("Notification preferences saved.");
  }

  async function updatePassword() {
    setErr(null);
    setSuccess(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setErr("Fill all password fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErr("New passwords do not match.");
      return;
    }

    setPasswordSaving(true);

    try {
      await http.patch("/users/me/password", {
        currentPassword,
        newPassword,
      });

      setSuccess("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: unknown) {
      setErr(extractHttpErrorMessage(error, "Failed to update password"));
    } finally {
      setPasswordSaving(false);
    }
  }

  async function uploadAvatar(file: File) {
    if (!file.type.startsWith("image/")) {
      setErr("Please select an image file.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setErr("Avatar must be up to 2MB.");
      return;
    }

    setErr(null);
    setSuccess(null);
    setAvatarUploading(true);

    try {
      const form = new FormData();
      form.append("file", file);

      const res = await http.patch<Profile>("/users/me/avatar", form, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setProfile(res.data);
      setAvatarUrl(res.data.avatarUrl ?? "");
      await refreshMe();
      setSuccess("Avatar updated successfully.");
    } catch (error: unknown) {
      setErr(extractHttpErrorMessage(error, "Failed to upload avatar"));
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) {
        avatarInputRef.current.value = "";
      }
    }
  }

  if (loading) return <LoadingState width="max-w-2xl" />;
  if (err && !profile) return <ErrorState width="max-w-2xl" message={err} />;

  return (
    <PageContainer width="max-w-2xl">
      <PageHeader title="Settings" subtitle="Manage your account settings and preferences." />

      <div className="grid grid-cols-1 gap-2 rounded-xl border border-border bg-card p-2 sm:grid-cols-4">
        <button
          type="button"
          onClick={() => setActiveTab("profile")}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
            activeTab === "profile" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent",
          )}
        >
          <User className="h-4 w-4" />
          Profile
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("notifications")}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
            activeTab === "notifications" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent",
          )}
        >
          <Bell className="h-4 w-4" />
          Notifications
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("security")}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
            activeTab === "security" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent",
          )}
        >
          <Shield className="h-4 w-4" />
          Security
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("appearance")}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
            activeTab === "appearance" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent",
          )}
        >
          <Sun className="h-4 w-4" />
          Appearance
        </button>
      </div>

      {activeTab === "profile" && (
        <Card>
          <CardHeader>
            <div className="text-sm text-muted-foreground">Update your profile details and public information</div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-4">
              <Avatar
                src={avatarUrl || undefined}
                alt={displayName || profile?.displayName || "User"}
                fallback={(displayName || profile?.displayName || "U").slice(0, 2).toUpperCase()}
                className="h-16 w-16"
              />
              <div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void uploadAvatar(file);
                    }
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  disabled={avatarUploading}
                  onClick={() => avatarInputRef.current?.click()}
                >
                  <Camera className="h-4 w-4" />
                  {avatarUploading ? "Uploading..." : "Upload avatar"}
                </Button>
                <p className="mt-2 text-xs text-muted-foreground">PNG/JPG/WEBP/GIF, max 2MB.</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Display name</label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Email</label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Avatar URL</label>
              <Input
                placeholder="https://example.com/avatar.png"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Leave empty to remove avatar.
              </p>
            </div>

            {err && <div className="text-sm text-destructive">{err}</div>}
            {success && <div className="text-sm text-success">{success}</div>}

            <Button onClick={save} disabled={saving}>
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </CardContent>
        </Card>
      )}

      {activeTab === "notifications" && (
        <Card>
          <CardHeader>
            <div className="text-sm text-muted-foreground">Choose what notifications you want to receive</div>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              {
                key: "newMessage",
                label: "New messages",
                description: "Get notified when you receive a new message.",
              },
              {
                key: "dealUpdates",
                label: "Deal updates",
                description: "Receive updates about active deals.",
              },
              {
                key: "weeklyDigest",
                label: "Weekly digest",
                description: "Summary of weekly account activity.",
              },
              {
                key: "marketing",
                label: "Marketing emails",
                description: "Promotions and special offers.",
              },
            ].map((item) => {
              const key = item.key as keyof typeof notifications;
              return (
                <label key={item.key} className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
                  <div>
                    <div className="text-sm font-medium text-foreground">{item.label}</div>
                    <div className="text-xs text-muted-foreground">{item.description}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifications[key]}
                    onChange={(e) =>
                      setNotifications((prev) => ({
                        ...prev,
                        [key]: e.target.checked,
                      }))
                    }
                    className="mt-1 h-4 w-4 rounded border border-input"
                  />
                </label>
              );
            })}

            <Button onClick={saveNotifications}>Save preferences</Button>
          </CardContent>
        </Card>
      )}

      {activeTab === "security" && (
        <Card>
          <CardHeader>
            <div className="text-sm text-muted-foreground">Manage your password and security options</div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Current password</label>
              <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">New password</label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Confirm new password</label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>

            {err && <div className="text-sm text-destructive">{err}</div>}
            {success && <div className="text-sm text-success">{success}</div>}

            <Button onClick={updatePassword} disabled={passwordSaving}>
              {passwordSaving ? "Updating..." : "Update password"}
            </Button>

            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
              <div className="text-sm font-semibold text-destructive">Danger zone</div>
              <div className="mt-1 text-xs text-muted-foreground">Permanently delete account and associated data.</div>
              <Button variant="destructive" size="sm" className="mt-3">Delete account</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "appearance" && (
        <Card>
          <CardHeader>
            <div className="text-sm text-muted-foreground">Customize how TradeGame looks on your device</div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-2 text-sm font-medium text-foreground">Theme</div>
              <div className="text-xs text-muted-foreground">Select your preferred color scheme.</div>
            </div>

            <div className="grid grid-cols-3 gap-2 rounded-xl border border-border bg-muted/40 p-2">
              <button
                type="button"
                onClick={() => setThemeMode("light")}
                className={cn(
                  "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
                  themeMode === "light" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent",
                )}
              >
                <Sun className="h-4 w-4" />
                Light
              </button>
              <button
                type="button"
                onClick={() => setThemeMode("dark")}
                className={cn(
                  "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
                  themeMode === "dark" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent",
                )}
              >
                <Moon className="h-4 w-4" />
                Dark
              </button>
              <button
                type="button"
                onClick={() => setThemeMode("system")}
                className={cn(
                  "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
                  themeMode === "system" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent",
                )}
              >
                <Monitor className="h-4 w-4" />
                System
              </button>
            </div>
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}