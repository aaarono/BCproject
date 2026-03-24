import { useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ExternalLink,
  Lock,
  Plus,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { Link } from "react-router-dom";
import { http } from "../api/http";
import { extractHttpErrorMessage } from "../utils/httpError";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { ErrorState, LoadingState } from "../components/ui/PageStates";
import { dollarsToCents, formatUsdFromCents } from "../lib/currency";

type WalletSummary = {
  userId: string;
  balance: number;
  lockedBalance: number;
  hasLinkedPaymentCard: boolean;
  paymentCardLast4?: string | null;
  paymentCardBrand?: string | null;
  paymentCardLinkedAt?: string | null;
};

type WalletTransaction = {
  id: string;
  type: "TOPUP" | "WITHDRAW" | "ESCROW_LOCK" | "ESCROW_RELEASE" | "REFUND";
  amount: number;
  dealId?: string | null;
  createdAt: string;
  description: string;
  balanceAfter: number;
};

function formatAmount(cents: number) {
  return formatUsdFromCents(cents);
}

export function WalletPage() {
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [visibleTransactionsCount, setVisibleTransactionsCount] = useState(5);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [topUpError, setTopUpError] = useState<string | null>(null);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

  async function load() {
    const walletResponse = await http.get<WalletSummary>("/wallet/me");
    setWallet(walletResponse.data);

    const transactionsResult = await http
      .get<WalletTransaction[]>("/wallet/me/transactions?limit=30")
      .then((response) => response.data)
      .catch(() => [] as WalletTransaction[]);

    setTransactions(transactionsResult);
    setVisibleTransactionsCount(5);
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        await load();
      } catch (error: unknown) {
        setErr(extractHttpErrorMessage(error, "Failed to load wallet"));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function topup() {
    if (!wallet?.hasLinkedPaymentCard) {
      setTopUpError("Link a payment card in Settings > Payment before top-up.");
      return;
    }

    const value = Number.parseFloat(topUpAmount);
    const amount = dollarsToCents(value);

    if (!Number.isFinite(value) || amount <= 0) {
      setTopUpError("Please enter a valid amount");
      return;
    }

    setTopUpError(null);
    setIsProcessing(true);
    try {
      await http.post("/wallet/topup-mock", { amount });
      setTopUpAmount("");
      await load();
    } catch (error: unknown) {
      setTopUpError(extractHttpErrorMessage(error, "Failed to top up wallet"));
    } finally {
      setIsProcessing(false);
    }
  }

  async function withdraw() {
    if (!wallet?.hasLinkedPaymentCard) {
      setWithdrawError(
        "Link a payment card in Settings > Payment before withdraw.",
      );
      return;
    }

    const value = Number.parseFloat(withdrawAmount);
    const amount = dollarsToCents(value);

    if (!Number.isFinite(value) || amount <= 0) {
      setWithdrawError("Please enter a valid amount");
      return;
    }

    if (wallet && amount > wallet.balance) {
      setWithdrawError("Amount exceeds available balance");
      return;
    }

    setWithdrawError(null);
    setIsProcessing(true);
    try {
      await http.post("/wallet/withdraw", { amount });
      setWithdrawAmount("");
      await load();
    } catch (error: unknown) {
      setWithdrawError(
        extractHttpErrorMessage(error, "Failed to withdraw funds"),
      );
    } finally {
      setIsProcessing(false);
    }
  }

  function getTransactionIcon(type: WalletTransaction["type"]) {
    switch (type) {
      case "TOPUP":
        return <ArrowDownLeft className="h-4 w-4 text-success" />;
      case "ESCROW_LOCK":
        return <Lock className="h-4 w-4 text-warning" />;
      case "ESCROW_RELEASE":
        return <ArrowUpRight className="h-4 w-4 text-destructive" />;
      case "REFUND":
        return <RefreshCw className="h-4 w-4 text-info" />;
      case "WITHDRAW":
        return <ArrowUpRight className="h-4 w-4 text-destructive" />;
      default:
        return <ArrowUpRight className="h-4 w-4" />;
    }
  }

  function getTransactionAmountColor(type: WalletTransaction["type"]) {
    switch (type) {
      case "TOPUP":
      case "REFUND":
        return "text-success";
      case "ESCROW_LOCK":
      case "ESCROW_RELEASE":
      case "WITHDRAW":
        return "text-destructive";
      default:
        return "text-foreground";
    }
  }

  if (loading) return <LoadingState width="max-w-3xl" />;
  if (err || !wallet)
    return <ErrorState width="max-w-3xl" message={err ?? "Wallet not found"} />;

  const visibleTransactions = transactions.slice(0, visibleTransactionsCount);
  const hasMoreTransactions = transactions.length > visibleTransactionsCount;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Wallet</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your balance and view transaction history
        </p>
      </div>

      <Card className="relative overflow-hidden">
        <div className="absolute right-0 top-0 h-32 w-32 -translate-y-8 translate-x-8 rounded-full bg-primary/10" />
        <CardContent className="p-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Wallet className="h-4 w-4" />
                <span className="text-sm font-medium">Available Balance</span>
              </div>
              <div className="text-3xl font-bold text-foreground">
                {formatAmount(wallet.balance)}
              </div>
              <p className="text-xs text-muted-foreground">
                {wallet.hasLinkedPaymentCard
                  ? `Linked card: ${wallet.paymentCardBrand ?? "Card"} •••• ${wallet.paymentCardLast4 ?? ""}`
                  : "No linked card. Link it in Settings > Payment to top up or withdraw."}
              </p>
            </div>

            <div className="space-y-2 sm:text-right">
              <div className="flex items-center gap-2 text-muted-foreground sm:justify-end">
                <Lock className="h-4 w-4" />
                <span className="text-sm font-medium">Locked in Escrow</span>
              </div>
              <div className="text-3xl font-bold text-muted-foreground">
                {formatAmount(wallet.lockedBalance)}
              </div>
              <p className="text-xs text-muted-foreground">
                Funds held in escrow for active deals
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Plus className="h-4 w-4" />
              <span className="text-sm font-medium">Top Up</span>
            </div>

            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Amount ($)"
                  value={topUpAmount}
                  onChange={(e) => {
                    setTopUpAmount(e.target.value);
                    if (topUpError) {
                      setTopUpError(null);
                    }
                  }}
                />
                <Button size="sm" onClick={topup} disabled={isProcessing}>
                  <Plus className="h-4 w-4" />
                  {isProcessing ? "Processing" : "Top Up"}
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {[10, 25, 50, 100].map((value) => (
                  <Button
                    key={value}
                    variant="outline"
                    size="sm"
                    onClick={() => setTopUpAmount(String(value))}
                  >
                    ${value}
                  </Button>
                ))}
              </div>
              <div className="text-xs text-muted-foreground">
                No fees for top-up.
              </div>
              {topUpError && (
                <div className="text-xs text-destructive">{topUpError}</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <ArrowUpRight className="h-4 w-4" />
              <span className="text-sm font-medium">Withdraw</span>
            </div>

            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Withdraw amount ($)"
                  value={withdrawAmount}
                  onChange={(e) => {
                    setWithdrawAmount(e.target.value);
                    if (withdrawError) {
                      setWithdrawError(null);
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={withdraw}
                  disabled={isProcessing}
                >
                  <ArrowUpRight className="h-4 w-4" />
                  {isProcessing ? "Processing" : "Withdraw"}
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {[10, 25, 50, 100].map((value) => (
                  <Button
                    key={value}
                    variant="outline"
                    size="sm"
                    onClick={() => setWithdrawAmount(String(value))}
                  >
                    ${value}
                  </Button>
                ))}
              </div>

              {withdrawAmount && Number.parseFloat(withdrawAmount) > 0 ? (
                <div className="text-xs text-muted-foreground">
                  Payout after 5% fee:{" "}
                  {formatAmount(
                    dollarsToCents(Number.parseFloat(withdrawAmount)) -
                      Math.round(
                        dollarsToCents(Number.parseFloat(withdrawAmount)) *
                          0.05,
                      ),
                  )}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  Withdraw fee: 5%
                </div>
              )}
              {withdrawError && (
                <div className="text-xs text-destructive">{withdrawError}</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="text-lg font-semibold text-foreground">
            Transaction History
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {transactions.length === 0 ? (
            <div className="px-5 py-4 text-sm text-muted-foreground">
              No transactions yet.
            </div>
          ) : (
            <div>
              {visibleTransactions.map((tx, index) => (
                <div
                  key={tx.id}
                  className={`flex items-center gap-4 px-5 py-3 ${index > 0 ? "border-t border-border" : ""}`}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    {getTransactionIcon(tx.type)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-foreground">
                      {tx.description}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(tx.createdAt).toLocaleString()}
                    </div>
                  </div>

                  <div className="text-right">
                    <div
                      className={`font-semibold ${getTransactionAmountColor(tx.type)}`}
                    >
                      {tx.amount > 0 ? "+" : ""}
                      {formatAmount(tx.amount)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Balance: {formatAmount(tx.balanceAfter)}
                    </div>
                  </div>

                  {tx.dealId && (
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                    >
                      <Link to={`/deals/${tx.dealId}`}>
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                </div>
              ))}

              {hasMoreTransactions && (
                <div className="border-t border-border px-5 py-3 text-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setVisibleTransactionsCount((current) => current + 5)
                    }
                  >
                    Load more
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-info/30 bg-info/5">
        <CardContent className="flex gap-3 p-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-info/20">
            <Wallet className="h-4 w-4 text-info" />
          </div>
          <div>
            <div className="font-medium text-foreground">How Escrow Works</div>
            <div className="mt-1 text-sm text-muted-foreground">
              When you buy, funds are locked in escrow until you confirm
              delivery. When you sell, payment is released only after buyer
              confirmation.
            </div>
            <Badge
              variant="outline"
              className="mt-3 normal-case tracking-normal text-xs"
            >
              Protected transactions
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
