import { Card, CardContent } from "@/components/ui/card";

export function PacingCard({ label, value, pct }: { label: string; value: string; pct: number }) {
  return (
    <Card className="border-white/10 bg-white/[0.03]">
      <CardContent className="p-5">
        <p className="text-sm text-white/80">{label}</p>
        <p className="mt-1 text-xl font-semibold text-white">{value}</p>
        <div className="mt-3 h-1.5 rounded-full bg-white/10">
          <div className="h-1.5 rounded-full bg-white" style={{ width: `${pct}%` }} />
        </div>
      </CardContent>
    </Card>
  );
}
