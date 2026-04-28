import { useState } from "react";
import { Link } from "react-router-dom";
import { Gamepad2, Mail } from "lucide-react";
import { http } from "../api/http";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { PageContainer } from "../components/ui/PageLayout";
import { extractHttpErrorMessage } from "../utils/httpError";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await http.post("/auth/forgot-password", { email });
      setSent(true);
    } catch (e: unknown) {
      setError(extractHttpErrorMessage(e, "Failed to send reset email"));
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
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Forgot Password</h1>
          <p className="text-sm text-muted-foreground">Enter your account email to receive a reset link</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {sent && (
            <div className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
              If this email exists, a password reset link has been sent.
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

            {error && <div className="text-sm text-destructive">{error}</div>}

            <Button fullWidth size="lg" type="submit" disabled={loading}>
              {loading ? "Sending..." : "Send reset link"}
            </Button>
          </form>

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
