import { Badge } from "../ui/Badge";
import { cn } from "../../lib/cn";

type DealStatus = "INITIATED" | "FUNDED" | "DELIVERED" | "COMPLETED" | "CANCELED";

const statusClass: Record<DealStatus, string> = {
  INITIATED: "bg-muted text-muted-foreground",
  FUNDED: "bg-info/20 text-info",
  DELIVERED: "bg-warning/20 text-warning",
  COMPLETED: "bg-success/20 text-success",
  CANCELED: "bg-destructive/15 text-destructive",
};

export function DealStatusBadge({ status }: { status: DealStatus }) {
  return <Badge className={cn("border-0", statusClass[status])}>{status}</Badge>;
}
