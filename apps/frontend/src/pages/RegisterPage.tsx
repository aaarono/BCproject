import { useState } from "react";
import { http } from "../api/http";
import { useAuth } from "../auth/AuthContext";
import { Link, useNavigate } from "react-router-dom";

export function RegisterPage() {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const { login } = useAuth();
  const nav = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const res = await http.post<{ accessToken: string }>("/auth/register", {
        email,
        password,
        displayName,
      });
      await login(res.data.accessToken);
      nav("/");
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { message?: unknown } } }).response
          ?.data?.message === "string"
          ? (error as { response?: { data?: { message?: string } } }).response
              ?.data?.message ?? "Register failed"
          : "Register failed";

      setErr(message);
    }
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Register</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input className="w-full border p-2 rounded" placeholder="display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        <input className="w-full border p-2 rounded" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="w-full border p-2 rounded" placeholder="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {err && <div className="text-red-600 text-sm">{String(err)}</div>}
        <button className="w-full bg-black text-white rounded p-2">Create account</button>
      </form>
      <div className="mt-3 text-sm">
        Have an account? <Link className="underline" to="/login">Login</Link>
      </div>
    </div>
  );
}
