import { useState } from "react";
import { http } from "../api/http";
import { useAuth } from "../auth/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { PageContainer } from "../components/ui/PageLayout";

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
    <PageContainer width="max-w-md" className="py-8 sm:px-0">
      <Card>
        <CardHeader className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Login</h1>
          <p className="text-sm text-slate-600">Continue to your marketplace account</p>
        </CardHeader>

        <CardContent className="space-y-4">
          <form onSubmit={onSubmit} className="space-y-3.5">
            <Input
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <Input
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />

            <div className="text-xs text-slate-500">Use your registered marketplace credentials.</div>

            {err && <div className="text-sm text-red-600">{String(err)}</div>}

            <Button fullWidth size="lg" type="submit">
              Sign in
            </Button>
          </form>

          <div className="text-sm text-slate-600">
            No account?{" "}
            <Link className="font-semibold text-slate-900 underline" to="/register">
              Register
            </Link>
          </div>
        </CardContent>
      </Card>
      <div className="mt-4 text-center text-xs text-slate-500">
        Your session stays secure with httpOnly cookies.
      </div>
    </PageContainer>
  );
}
