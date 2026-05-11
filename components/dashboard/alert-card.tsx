import { formatDistanceToNow } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { ExecutiveAlert } from "@/src/lib/types/dealership";

const severityStyles = {
  critical: "border-red-200 bg-red-50 text-red-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  info: "border-sky-200 bg-sky-50 text-sky-800",
  win: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

export function AlertCard({ alert }: { alert: ExecutiveAlert }) {
  return (
    <Card className={`rounded-xl border shadow-sm ${severityStyles[alert.severity]}`}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-base font-semibold">{alert.title}</p>
          <span className="text-xs font-medium opacity-80">
            {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
          </span>
        </div>
        <p className="mt-2 text-sm leading-6 opacity-90">{alert.description}</p>
        <p className="mt-3 text-sm font-medium">Recommended action: {alert.recommendedAction}</p>
      </CardContent>
    </Card>
  );
}
