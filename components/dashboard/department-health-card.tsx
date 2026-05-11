import { Card, CardContent } from "@/components/ui/card";

export function DepartmentHealthCard({ name, score, detail }: { name: string; score: number; detail: string }) {
  const tone = score >= 90 ? "text-[#16A34A]" : score >= 80 ? "text-[#D97706]" : "text-[#DC2626]";
  const barTone = score >= 90 ? "bg-[#16A34A]" : score >= 80 ? "bg-[#D97706]" : "bg-[#DC2626]";

  return (
    <Card className="bg-white">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-[20px] font-medium tracking-tight text-[#0B0B0C]">{name}</p>
          <p className={`font-mono text-[14px] font-semibold ${tone}`}>{score}%</p>
        </div>
        <div className="mt-2 h-2 rounded-full bg-muted">
          <div className={`h-2 rounded-full ${barTone}`} style={{ width: `${score}%` }} />
        </div>
        <p className="mt-3 text-[14px] leading-6 text-[#6B7280]">{detail}</p>
      </CardContent>
    </Card>
  );
}
