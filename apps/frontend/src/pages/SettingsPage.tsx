import { useEffect, useState } from "react";
import { http } from "../api/http";
import { extractHttpErrorMessage } from "../utils/httpError";

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

  if (loading) return <div className="p-6">Loading…</div>;
  if (err && !profile) return <div className="p-6 text-red-600">{err}</div>;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Settings</h1>

      <div className="border rounded p-4 space-y-4">
        <div>
          <label className="block text-sm mb-1">Display name</label>
          <input
            className="border rounded p-2 w-full"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Email</label>
          <input
            className="border rounded p-2 w-full"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {err && <div className="text-sm text-red-600">{err}</div>}
        {success && <div className="text-sm text-green-700">{success}</div>}

        <button
          className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
          onClick={save}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </div>
  );
}