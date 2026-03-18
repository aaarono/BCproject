import { Badge } from "../ui/Badge";
import { cn } from "../../lib/cn";

type DealStatus = "INITIATED" | "FUNDED" | "DELIVERED" | "COMPLETED" | "CANCELED";

const statusClass: Record<DealStatus, string> = {
  INITIATED: "bg-slate-100 text-slate-700",
  FUNDED: "bg-blue-100 text-blue-700",
  DELIVERED: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  CANCELED: "bg-rose-100 text-rose-700",
};

export function DealStatusBadge({ status }: { status: DealStatus }) {
  return <Badge className={cn("border-0", statusClass[status])}>{status}</Badge>;
}
