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
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-xl font-bold text-foreground">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-xl font-bold text-foreground">{displayName}</div>
            {subtitle && <div className="text-sm text-muted-foreground">{subtitle}</div>}
          </div>
        </div>

        <div className="border-t border-border pt-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-medium text-foreground">Rating</div>
            <Badge variant="muted">{ratingCount} reviews</Badge>
          </div>
          <div className="flex items-center gap-2">
            <RatingStars value={Math.round(ratingAvg)} />
            <span className="text-sm text-muted-foreground">{ratingAvg.toFixed(2)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}