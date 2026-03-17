import { useEffect, useState } from "react";
import { http } from "../api/http";

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
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Wallet</h1>
      <div className="border rounded p-4 mb-4">
        Balance: <b>{wallet ? (wallet.balance / 100).toFixed(2) : "..."}</b> Kč
      </div>

      <div className="flex gap-2">
        <input className="border rounded p-2 flex-1" type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
        <button className="bg-black text-white rounded px-3" onClick={topup}>Top up</button>
      </div>
    </div>
  );
}
