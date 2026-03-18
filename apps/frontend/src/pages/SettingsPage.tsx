import { useEffect, useState } from "react";
import { http } from "../api/http";
import { extractHttpErrorMessage } from "../utils/httpError";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { ErrorState, LoadingState } from "../components/ui/PageStates";
import { PageContainer, PageHeader } from "../components/ui/PageLayout";

type Profile = {
  id: string;
  email: string;
  displayName: string;
  role: "BUYER" | "SELLER" | "ADMIN";
  ratingAvg: number;
  ratingCount: number;
};

export function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadProfile() {
    const res = await http.get<Profile>("/users/me/profile");
    setProfile(res.data);
    setDisplayName(res.data.displayName);
    setEmail(res.data.email);
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

  async function save() {
    setSaving(true);
    setErr(null);
    setSuccess(null);

    try {
      const res = await http.patch<Profile>("/users/me", {
        displayName,
        email,
      });

      setProfile(res.data);
      setDisplayName(res.data.displayName);
      setEmail(res.data.email);
      setSuccess("Settings saved successfully.");
    } catch (error: unknown) {
      setErr(extractHttpErrorMessage(error, "Failed to save settings"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState width="max-w-2xl" />;
  if (err && !profile) return <ErrorState width="max-w-2xl" message={err} />;

  return (
    <PageContainer width="max-w-2xl">
      <PageHeader title="Settings" subtitle="Update your profile identity and login email." />

      <Card>
        <CardHeader>
          <div className="text-sm text-slate-600">Manage your account profile settings</div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Display name</label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} />
            <div className="mt-1 text-xs text-slate-500">Used for login and marketplace notifications.</div>
          </div>

          {err && <div className="text-sm text-red-600">{err}</div>}
          {success && <div className="text-sm text-emerald-700">{success}</div>}

          <Button onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </CardContent>
      </Card>
    </PageContainer>
  );
}