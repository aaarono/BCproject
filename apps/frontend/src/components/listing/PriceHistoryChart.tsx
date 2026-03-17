import type { PriceHistoryPoint } from "../../types/listing";

function formatPrice(value: number) {
  return `${(value / 100).toFixed(2)} Kč`;
}

export function PriceHistoryChart({ points }: { points: PriceHistoryPoint[] }) {
  if (points.length === 0) {
    return (
      <div className="border rounded p-4 text-sm text-gray-500">
        Price history for the last 30 days is not available yet.
      </div>
    );
  }

  if (points.length === 1) {
    return (
      <div className="border rounded p-4 space-y-2">
        <div className="font-semibold">Price history (30 days)</div>
        <div className="text-sm text-gray-600">
          Current historical point: {formatPrice(points[0].price)}
        </div>
      </div>
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
    <div className="border rounded p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-semibold">Price history (30 days)</div>
        <div className="text-xs text-gray-500">
          Min: {formatPrice(min)} · Max: {formatPrice(max)}
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-56 bg-gray-50 rounded border">
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="text-black"
          points={polyline}
        />
      </svg>

      <div className="flex justify-between text-xs text-gray-500">
        <span>{new Date(points[0].createdAt).toLocaleDateString()}</span>
        <span>{new Date(points[points.length - 1].createdAt).toLocaleDateString()}</span>
      </div>
    </div>
  );
}
