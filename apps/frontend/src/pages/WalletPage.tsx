import { useEffect, useState } from "react";
import { http } from "../api/http";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { PageContainer, PageHeader } from "../components/ui/PageLayout";

type Wallet = { userId: string; balance: number };

export function WalletPage() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [amount, setAmount] = useState(50000);

  async function load() {
    const r = await http.get<Wallet>("/wallet/me");
    setWallet(r.data);
  }

  useEffect(() => {
    let cancelled = false;

    http
      .get<Wallet>("/wallet/me")
      .then((r) => {
        if (!cancelled) {
          setWallet(r.data);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  async function topup() {
    await http.post("/wallet/topup-mock", { amount });
    await load();
  }

  return (
    <PageContainer width="max-w-md">
      <PageHeader title="Wallet" />

      <Card>
        <CardHeader>
          <div className="text-sm text-slate-600">Current balance</div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-slate-900">
            {wallet ? (wallet.balance / 100).toFixed(2) : "..."} Kč
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-sm text-slate-600">Top up (mock)</div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          <Button onClick={topup}>Top up</Button>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
