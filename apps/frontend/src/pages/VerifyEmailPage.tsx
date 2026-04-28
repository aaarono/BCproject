import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Gamepad2 } from "lucide-react";
import { http } from "../api/http";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { PageContainer } from "../components/ui/PageLayout";
import { extractHttpErrorMessage } from "../utils/httpError";

type VerifyStatus = "idle" | "loading" | "success" | "error";

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [status, setStatus] = useState<VerifyStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [resendEmail, setResendEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError("Missing verification token");
      return;
    }

    const verify = async () => {
      setStatus("loading");
      setError(null);

      try {
        await http.get("/auth/verify-email", { params: { token } });
        setStatus("success");
      } catch (e: unknown) {
        setStatus("error");
        setError(extractHttpErrorMessage(e, "Failed to verify email"));
      }
    };

    void verify();
  }, [token]);

  async function onResend(e: React.FormEvent) {
    e.preventDefault();
    setResending(true);
    setResent(false);

    try {
      await http.post("/auth/resend-verification", { email: resendEmail });
      setResent(true);
    } catch (e: unknown) {
      setError(extractHttpErrorMessage(e, "Failed to resend verification email"));
    } finally {
      setResending(false);
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
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Email Verification</h1>
          <p className="text-sm text-muted-foreground">Confirming your account email</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "loading" && <div className="text-sm text-muted-foreground">Verifying your email...</div>}

          {status === "success" && (
            <div className="space-y-3">
              <div className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
                Email verified successfully.
              </div>
              <Button fullWidth size="lg" onClick={() => nav("/login?verified=1")}>Sign in</Button>
            </div>
          )}

          {status === "error" && (
            <>
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error ?? "Verification failed"}
              </div>

              <form onSubmit={onResend} className="space-y-3">
                <label className="block text-sm font-medium text-foreground">Resend verification email</label>
                <Input
                  placeholder="your@email.com"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  autoComplete="email"
                />
                {resent && (
                  <div className="text-sm text-success">
                    If this email exists, verification instructions were sent.
                  </div>
                )}
                <Button fullWidth type="submit" disabled={resending}>
                  {resending ? "Sending..." : "Resend verification"}
                </Button>
              </form>
            </>
          )}

          <div className="text-center text-sm text-muted-foreground">
            <Link className="font-semibold text-primary hover:underline" to="/login">
              Back to sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
