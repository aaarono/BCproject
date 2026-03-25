import { TrendingDown } from "lucide-react";
import type { PriceHistoryPoint, PriceHistoryStats } from "../../types/listing";
import { Card, CardContent, CardHeader } from "../ui/Card";
import { formatUsdFromCents } from "../../lib/currency";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Props = {
  points: PriceHistoryPoint[];
  stats: PriceHistoryStats | null;
  period: "30d" | "all";
  onPeriodChange: (period: "30d" | "all") => void;
  currentEffectivePrice: number;
  currentIsSale?: boolean;
  currentSalePercent?: number | null;
  loading?: boolean;
};

type ChartPoint = {
  date: string;
  price: number;
  isSale: boolean;
  salePercent?: number | null;
  isCurrent?: boolean;
};

function formatShortDateEnglish(dateValue: string) {
  return new Date(dateValue).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
  });
}

function formatFullDateEnglish(dateValue: string) {
  return new Date(dateValue).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function buildYDomain(values: number[]) {
  if (values.length === 0) return [0, 1] as const;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(1, max - min);
  const padding = Math.max(50, Math.round(spread * 0.2));

  return [Math.max(0, min - padding), max + padding] as const;
}

function formatRoundedUsdFromCents(value: number) {
  const roundedDollars = Math.round(value / 100);
  return `$${roundedDollars.toLocaleString("en-US")}`;
}

function buildNextPointDate(dateValue: string) {
  const next = new Date(dateValue);
  next.setSeconds(next.getSeconds() + 1);
  return next.toISOString();
}

export function PriceHistoryChart({
  points,
  stats,
  period,
  onPeriodChange,
  currentEffectivePrice,
  currentIsSale = false,
  currentSalePercent = null,
  loading = false,
}: Props) {
  if (points.length === 0) {
    return (
      <Card>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div>Price history is not available yet.</div>
          <div className="inline-flex rounded-lg border border-border bg-muted p-1">
            <button
              type="button"
              onClick={() => onPeriodChange("30d")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                period === "30d" ? "bg-background text-foreground" : "text-muted-foreground"
              }`}
            >
              30d
            </button>
            <button
              type="button"
              onClick={() => onPeriodChange("all")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                period === "all" ? "bg-background text-foreground" : "text-muted-foreground"
              }`}
            >
              All Time
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const sortedPoints = [...points].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  const historyData: ChartPoint[] = sortedPoints.map((point) => ({
    date: point.createdAt,
    price: point.price,
    isSale: point.isSale,
    salePercent: point.salePercent,
  }));

  const lastHistoryDate = historyData[historyData.length - 1]?.date ?? new Date().toISOString();
  const chartData: ChartPoint[] = [
    ...historyData,
    {
      date: buildNextPointDate(lastHistoryDate),
      price: currentEffectivePrice,
      isSale: currentIsSale,
      salePercent: currentSalePercent,
      isCurrent: true,
    },
  ];

  const previousPrice =
    sortedPoints.length >= 2
      ? sortedPoints[sortedPoints.length - 2].price
      : sortedPoints[sortedPoints.length - 1].price;
  const change = currentEffectivePrice - previousPrice;
  const changeTone =
    change > 0 ? "text-success" : change < 0 ? "text-destructive" : "text-muted-foreground";
  const changePrefix = change > 0 ? "+" : "";

  const yDomain = buildYDomain(chartData.map((point) => point.price));

  const minSaleLabel = stats?.minPriceOnSales
    ? `${formatUsdFromCents(stats.minPriceOnSales.price)}`
    : "N/A";
  const minNoSaleLabel = stats?.minPriceNoSales
    ? `${formatUsdFromCents(stats.minPriceNoSales.price)}`
    : "N/A";

  const minSaleDateLabel = stats?.minPriceOnSales
    ? formatFullDateEnglish(stats.minPriceOnSales.createdAt)
    : null;
  const minNoSaleDateLabel = stats?.minPriceNoSales
    ? formatFullDateEnglish(stats.minPriceNoSales.createdAt)
    : null;

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <TrendingDown className="h-4 w-4" />
            Price History
          </div>
          <div className={`rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-semibold ${changeTone}`}>
            {changePrefix}{((currentEffectivePrice - previousPrice) / Math.max(previousPrice, 1) * 100).toFixed(1)}%
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3 sm:text-sm">
          <div className="group relative rounded-lg border border-border bg-muted/30 px-3 py-2">
            <div className="text-muted-foreground">MinPriceOnSales</div>
            <div className="font-semibold text-foreground">{minSaleLabel}</div>
            {minSaleDateLabel && (
              <div className="pointer-events-none absolute -top-8 left-2 z-10 whitespace-nowrap rounded-md border border-border bg-card px-2 py-1 text-[11px] text-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                {minSaleDateLabel}
              </div>
            )}
          </div>
          <div className="group relative rounded-lg border border-border bg-muted/30 px-3 py-2">
            <div className="text-muted-foreground">MinPriceNoSales</div>
            <div className="font-semibold text-foreground">{minNoSaleLabel}</div>
            {minNoSaleDateLabel && (
              <div className="pointer-events-none absolute -top-8 left-2 z-10 whitespace-nowrap rounded-md border border-border bg-card px-2 py-1 text-[11px] text-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                {minNoSaleDateLabel}
              </div>
            )}
          </div>
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
            <div className="text-muted-foreground">Change</div>
            <div className={`font-semibold ${changeTone}`}>
              {changePrefix}{formatUsdFromCents(change)}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 28, left: 2, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.7} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                tickFormatter={formatShortDateEnglish}
                tickLine={false}
                axisLine={false}
                minTickGap={24}
                padding={{ left: 6, right: 12 }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "var(--muted-foreground)", dx: -6 }}
                tickFormatter={(value: number) => formatRoundedUsdFromCents(value)}
                tickLine={false}
                axisLine={false}
                width={84}
                tickMargin={8}
                domain={yDomain}
              />
              <Tooltip
                formatter={(value, _name, entry) => {
                  const price = formatUsdFromCents(Number(value) || 0);
                  const row = entry.payload as ChartPoint;
                  if (row?.isSale) {
                    return [price, "Sale Price"];
                  }
                  if (row?.isCurrent) {
                    return [price, "Current Price"];
                  }
                  return [price, "Base Price"];
                }}
                labelFormatter={(value) => formatFullDateEnglish(String(value))}
                contentStyle={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "10px",
                  color: "var(--foreground)",
                }}
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke="var(--primary)"
                strokeWidth={2.5}
                dot={(props) => {
                  const payload = props.payload as ChartPoint;
                  if (!payload) return null;

                  if (payload.isCurrent) {
                    const currentFill = payload.isSale
                      ? "var(--chart-2)"
                      : "var(--foreground)";

                    return (
                      <g>
                        <circle
                          cx={props.cx}
                          cy={props.cy}
                          r={8}
                          fill={payload.isSale ? "var(--chart-2)" : "var(--primary)"}
                          fillOpacity={0.18}
                        />
                        <circle
                          cx={props.cx}
                          cy={props.cy}
                          r={5}
                          fill={currentFill}
                          stroke="var(--background)"
                          strokeWidth={2}
                        />
                      </g>
                    );
                  }

                  if (payload.isSale) {
                    return (
                      <circle
                        cx={props.cx}
                        cy={props.cy}
                        r={4}
                        fill="var(--chart-2)"
                        stroke="var(--background)"
                        strokeWidth={1.5}
                      />
                    );
                  }

                  return (
                    <circle
                      cx={props.cx}
                      cy={props.cy}
                      r={3}
                      fill="var(--primary)"
                      stroke="var(--background)"
                      strokeWidth={1.5}
                    />
                  );
                }}
                activeDot={(props) => {
                  const payload = props.payload as ChartPoint;

                  if (payload?.isCurrent) {
                    const currentFill = payload.isSale
                      ? "var(--chart-2)"
                      : "var(--foreground)";

                    return (
                      <g>
                        <circle
                          cx={props.cx}
                          cy={props.cy}
                          r={10}
                          fill={payload.isSale ? "var(--chart-2)" : "var(--primary)"}
                          fillOpacity={0.22}
                        />
                        <circle
                          cx={props.cx}
                          cy={props.cy}
                          r={6}
                          fill={currentFill}
                          stroke="var(--background)"
                          strokeWidth={2}
                        />
                      </g>
                    );
                  }

                  if (payload?.isSale) {
                    return (
                      <circle
                        cx={props.cx}
                        cy={props.cy}
                        r={6}
                        fill="var(--chart-2)"
                        stroke="var(--background)"
                        strokeWidth={2}
                      />
                    );
                  }

                  return (
                    <circle
                      cx={props.cx}
                      cy={props.cy}
                      r={5}
                      fill="var(--primary)"
                      stroke="var(--background)"
                      strokeWidth={2}
                    />
                  );
                }}
              />
              <ReferenceLine
                y={currentEffectivePrice}
                stroke="var(--muted-foreground)"
                strokeOpacity={0.35}
                strokeDasharray="4 3"
                strokeWidth={1}
                ifOverflow="extendDomain"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {loading && <div className="text-xs text-muted-foreground">Updating chart…</div>}

        <div className="inline-flex rounded-lg border border-border bg-muted p-1">
          <button
            type="button"
            onClick={() => onPeriodChange("30d")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
              period === "30d"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            aria-pressed={period === "30d"}
          >
            30d
          </button>
          <button
            type="button"
            onClick={() => onPeriodChange("all")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
              period === "all"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            aria-pressed={period === "all"}
          >
            All Time
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
