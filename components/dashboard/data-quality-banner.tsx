import { CheckCircle2 } from "lucide-react";

export function DataQualityBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
      <CheckCircle2 className="h-4 w-4" />
      {message}
    </div>
  );
}
