import { useState } from "react";
import { http } from "../api/http";
import { useAuth } from "../auth/AuthContext";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, Gamepad2, Lock, Mail } from "lucide-react";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { PageContainer } from "../components/ui/PageLayout";
import { extractHttpErrorMessage } from "../utils/httpError";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const nav = useNavigate();
  const showRegisteredHint = searchParams.get("registered") === "1";
  const showVerifiedHint = searchParams.get("verified") === "1";
  const showPasswordResetHint = searchParams.get("passwordReset") === "1";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await http.post("/auth/login", { email, password });
      await login();
      nav("/");
    } catch (error: unknown) {
      setErr(extractHttpErrorMessage(error, "Login failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageContainer width="max-w-md" className="py-10 sm:px-0">
      <div className="mb-8 flex justify-center">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <Gamepad2 className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-foreground">TradeGame</span>
        </Link>
      </div>

      <Card>
        <CardHeader className="space-y-1.5 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Welcome back</h1>
          <p className="text-sm text-muted-foreground">Sign in to your account to continue</p>
        </CardHeader>

        <CardContent className="space-y-4">
          {showRegisteredHint && (
            <div className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
              Registration successful. Check your email and confirm your account before sign in.
            </div>
          )}
          {showVerifiedHint && (
            <div className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
              Email confirmed. You can now sign in.
            </div>
          )}
          {showPasswordResetHint && (
            <div className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
              Password updated. Sign in with your new password.
            </div>
          )}
          <form onSubmit={onSubmit} className="space-y-3.5">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">Email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-foreground">Password</label>
                <Link className="text-xs text-primary hover:underline" to="/forgot-password">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Enter your password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="pl-9 pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="text-xs text-muted-foreground">Use your registered marketplace credentials.</div>

            {err && <div className="text-sm text-destructive">{String(err)}</div>}

            <Button fullWidth size="lg" type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <div className="text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link className="font-semibold text-primary hover:underline" to="/register">
              Create one
            </Link>
          </div>
        </CardContent>
      </Card>
      <div className="mt-4 text-center text-xs text-muted-foreground">
        Your session stays secure with httpOnly cookies.
      </div>
    </PageContainer>
  );
}
