import type { ReactNode } from "react";
import { Card, CardContent } from "./Card";
import { cn } from "../../lib/cn";

type Width =
  | "max-w-md"
  | "max-w-2xl"
  | "max-w-3xl"
  | "max-w-4xl"
  | "max-w-5xl"
  | "max-w-6xl"
  | "max-w-7xl";

function Wrapper({ width, children }: { width: Width; children: ReactNode }) {
  return <div className={cn("mx-auto px-4 py-6 sm:px-6", width)}>{children}</div>;
}

export function LoadingState({ width = "max-w-5xl", label = "Loading…" }: { width?: Width; label?: string }) {
  return (
    <Wrapper width={width}>
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">{label}</CardContent>
      </Card>
    </Wrapper>
  );
}

export function ErrorState({ width = "max-w-5xl", message }: { width?: Width; message: string }) {
  return (
    <Wrapper width={width}>
      <Card>
        <CardContent className="py-8 text-center text-sm text-destructive">{message}</CardContent>
      </Card>
    </Wrapper>
  );
}

export function EmptyState({ width = "max-w-5xl", message }: { width?: Width; message: string }) {
  return (
    <Wrapper width={width}>
      <Card>
        <CardContent className="text-muted-foreground">{message}</CardContent>
      </Card>
    </Wrapper>
  );
}
