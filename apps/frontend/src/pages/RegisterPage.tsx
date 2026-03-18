import { useState } from "react";
import { http } from "../api/http";
import { useAuth } from "../auth/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { PageContainer } from "../components/ui/PageLayout";

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
      await http.post("/auth/register", {
        email,
        password,
        displayName,
      });
      await login();
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
    <PageContainer width="max-w-md" className="py-8 sm:px-0">
      <Card>
        <CardHeader className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Register</h1>
          <p className="text-sm text-slate-600">Create your marketplace account</p>
        </CardHeader>

        <CardContent className="space-y-4">
          <form onSubmit={onSubmit} className="space-y-3.5">
            <Input
              placeholder="Display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="nickname"
            />
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
              autoComplete="new-password"
            />

            <div className="text-xs text-slate-500">One account works for both buying and selling.</div>

            {err && <div className="text-sm text-red-600">{String(err)}</div>}

            <Button fullWidth size="lg" type="submit">
              Create account
            </Button>
          </form>

          <div className="text-sm text-slate-600">
            Have an account?{" "}
            <Link className="font-semibold text-slate-900 underline" to="/login">
              Login
            </Link>
          </div>
        </CardContent>
      </Card>
      <div className="mt-4 text-center text-xs text-slate-500">
        Buyers and sellers share one account model.
      </div>
    </PageContainer>
  );
}
