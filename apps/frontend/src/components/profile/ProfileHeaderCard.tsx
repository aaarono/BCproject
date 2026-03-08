import { RatingStars } from "../review/RatingStars";

type Props = {
  displayName: string;
  subtitle?: string;
  ratingAvg: number;
  ratingCount: number;
};

export function ProfileHeaderCard({
  displayName,
  subtitle,
  ratingAvg,
  ratingCount,
}: Props) {
  return (
    <div className="border rounded p-4 space-y-4">
      <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center text-2xl font-bold">
        {displayName.charAt(0).toUpperCase()}
      </div>

      <div>
        <div className="text-2xl font-bold">{displayName}</div>
        {subtitle && <div className="text-sm text-gray-600">{subtitle}</div>}
      </div>

      <div className="pt-2 border-t">
        <div className="text-sm mb-1">Rating</div>
        <div className="flex items-center gap-2">
          <RatingStars value={Math.round(ratingAvg)} />
          <span className="text-sm text-gray-600">
            {ratingAvg.toFixed(2)} ({ratingCount})
          </span>
        </div>
      </div>
    </div>
  );
}