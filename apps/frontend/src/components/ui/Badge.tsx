import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide",
  {
    variants: {
      variant: {
        default: "bg-slate-900 text-white",
        outline: "border border-slate-200 bg-white text-slate-600",
        muted: "bg-slate-100 text-slate-600",
      },
    },
    defaultVariants: {
      variant: "muted",
    },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}
