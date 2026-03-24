import type { PriceHistoryPoint } from "../../types/listing";
import { Card, CardContent, CardHeader } from "../ui/Card";
import { formatUsdFromCents } from "../../lib/currency";

function formatPrice(value: number) {
  return formatUsdFromCents(value);
}

export function PriceHistoryChart({ points }: { points: PriceHistoryPoint[] }) {
  if (points.length === 0) {
    return (
      <Card>
        <CardContent className="text-sm text-muted-foreground">
          Price history for the last 30 days is not available yet.
        </CardContent>
      </Card>
    );
  }

  if (points.length === 1) {
    return (
      <Card>
        <CardHeader className="font-semibold text-foreground">Price history (30 days)</CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div>Current historical point: {formatPrice(points[0].price)}</div>
        </CardContent>
      </Card>
    );
  }

  const values = points.map((point) => point.price);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);

  const width = 640;
  const height = 220;
  const padding = 20;

  const polyline = points
    .map((point, index) => {
      const x =
        padding + (index / Math.max(1, points.length - 1)) * (width - padding * 2);
      const y =
        height -
        padding -
        ((point.price - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-3">
        <div className="font-semibold text-foreground">Price history (30 days)</div>
        <div className="text-xs text-muted-foreground">
          Min: {formatPrice(min)} · Max: {formatPrice(max)}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full rounded-xl border border-border bg-muted">
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="text-foreground"
            points={polyline}
          />
        </svg>

        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{new Date(points[0].createdAt).toLocaleDateString()}</span>
          <span>{new Date(points[points.length - 1].createdAt).toLocaleDateString()}</span>
        </div>
      </CardContent>
    </Card>
  );
}
