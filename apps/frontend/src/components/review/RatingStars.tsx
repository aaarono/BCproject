type Props = {
  value: number;
  size?: number;
};

export function RatingStars({ value, size = 18 }: Props) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          style={{ fontSize: size }}
          className={star <= value ? "text-warning" : "text-muted-foreground/40"}
        >
          ★
        </span>
      ))}
    </div>
  );
}