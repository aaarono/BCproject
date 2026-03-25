import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({
  className,
  ...props
}, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "min-h-[80px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});
