import { RatingStars } from "../review/RatingStars";
import { Card, CardContent } from "../ui/Card";
import { Badge } from "../ui/Badge";

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
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-xl font-bold text-slate-700">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900">{displayName}</div>
            {subtitle && <div className="text-sm text-slate-600">{subtitle}</div>}
          </div>
        </div>

        <div className="border-t border-slate-100 pt-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-medium text-slate-700">Rating</div>
            <Badge variant="muted">{ratingCount} reviews</Badge>
          </div>
          <div className="flex items-center gap-2">
            <RatingStars value={Math.round(ratingAvg)} />
            <span className="text-sm text-slate-600">{ratingAvg.toFixed(2)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}