import { useState } from "react";
import { http } from "../api/http";
import { useAuth } from "../auth/AuthContext";
import { Link, useNavigate } from "react-router-dom";

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

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const { login } = useAuth();
  const nav = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await http.post("/auth/login", { email, password });
      await login();
      nav("/");
    } catch (error: unknown) {
      setErr(extractErrorMessage(error, "Login failed"));
    }
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Login</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input className="w-full border p-2 rounded" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="w-full border p-2 rounded" placeholder="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {err && <div className="text-red-600 text-sm">{String(err)}</div>}
        <button className="w-full bg-black text-white rounded p-2">Sign in</button>
      </form>
      <div className="mt-3 text-sm">
        No account? <Link className="underline" to="/register">Register</Link>
      </div>
    </div>
  );
}
