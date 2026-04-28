import { useState } from "react";
import { http } from "../api/http";
import { Link, useNavigate } from "react-router-dom";
import { Check, Eye, EyeOff, Gamepad2, Lock, Mail, User } from "lucide-react";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { PageContainer } from "../components/ui/PageLayout";
import { cn } from "../lib/cn";
import { extractHttpErrorMessage } from "../utils/httpError";

export function RegisterPage() {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const nav = useNavigate();

  const passwordRequirements = [
    { met: password.length >= 8, text: "At least 8 characters" },
    { met: /[A-Z]/.test(password), text: "One uppercase letter" },
    { met: /[a-z]/.test(password), text: "One lowercase letter" },
    { met: /\d/.test(password), text: "One number" },
  ];

  const allRequirementsMet = passwordRequirements.every((requirement) => requirement.met);
  const passwordsMatch = password === confirmPassword && confirmPassword !== "";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!allRequirementsMet) {
      setErr("Password does not meet requirements");
      return;
    }

    if (!passwordsMatch) {
      setErr("Passwords do not match");
      return;
    }

    if (!acceptTerms) {
      setErr("Please accept terms and conditions");
      return;
    }

    setLoading(true);
    try {
      await http.post("/auth/register", {
        email,
        password,
        displayName,
      });
      nav("/login?registered=1");
    } catch (error: unknown) {
      setErr(extractHttpErrorMessage(error, "Register failed"));
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
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Create an account</h1>
          <p className="text-sm text-muted-foreground">Join the secure gaming marketplace</p>
        </CardHeader>

        <CardContent className="space-y-4">
          <form onSubmit={onSubmit} className="space-y-3.5">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">Display name</label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Your username"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoComplete="nickname"
                  className="pl-9"
                />
              </div>
            </div>

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
              <label className="block text-sm font-medium text-foreground">Password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Create a password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
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

              {password && (
                <div className="space-y-1 pt-1">
                  {passwordRequirements.map((requirement) => (
                    <div
                      key={requirement.text}
                      className={cn(
                        "flex items-center gap-2 text-xs",
                        requirement.met ? "text-success" : "text-muted-foreground",
                      )}
                    >
                      <Check className={cn("h-3 w-3", !requirement.met && "opacity-50")} />
                      {requirement.text}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">Confirm password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Confirm your password"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  className={cn(
                    "pl-9",
                    confirmPassword
                      ? passwordsMatch
                        ? "border-success focus-visible:ring-success"
                        : "border-destructive focus-visible:ring-destructive"
                      : "",
                  )}
                />
              </div>
              {confirmPassword && !passwordsMatch && <p className="text-xs text-destructive">Passwords do not match</p>}
            </div>

            <label className="flex items-start gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border border-input"
              />
              <span>
                I agree to the <span className="text-primary">Terms of Service</span> and <span className="text-primary">Privacy Policy</span>
              </span>
            </label>

            <div className="text-xs text-muted-foreground">One account works for both buying and selling.</div>

            {err && <div className="text-sm text-destructive">{String(err)}</div>}

            <Button fullWidth size="lg" type="submit" disabled={loading}>
              {loading ? "Creating account..." : "Create account"}
            </Button>
          </form>

          <div className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link className="font-semibold text-primary hover:underline" to="/login">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
      <div className="mt-4 text-center text-xs text-muted-foreground">
        Buyers and sellers share one account model.
      </div>
    </PageContainer>
  );
}
