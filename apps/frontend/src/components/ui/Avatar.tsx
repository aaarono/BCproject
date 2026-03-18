import { useMemo } from "react";
import { cn } from "../../lib/cn";

type AvatarProps = {
  src?: string | null;
  alt?: string;
  fallback: string;
  className?: string;
  fallbackClassName?: string;
};

export function Avatar({ src, alt, fallback, className, fallbackClassName }: AvatarProps) {
  const normalizedFallback = useMemo(() => fallback.slice(0, 2).toUpperCase(), [fallback]);

  if (src) {
    return (
      <img
        src={src}
        alt={alt ?? "Avatar"}
        className={cn("rounded-full object-cover", className)}
      />
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-muted text-foreground",
        className,
        fallbackClassName,
      )}
      aria-label={alt ?? "Avatar"}
    >
      {normalizedFallback}
    </span>
  );
}
