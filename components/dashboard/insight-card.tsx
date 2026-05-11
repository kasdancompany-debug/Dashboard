import { Card, CardContent } from "@/components/ui/card";

export function InsightCard({ insight }: { insight: string }) {
  return (
    <Card className="rounded-2xl bg-card shadow-sm ring-1 ring-border/70">
      <CardContent className="p-6">
        <p className="text-sm font-semibold text-primary">Executive insight</p>
        <p className="mt-2 text-base leading-7 text-foreground">{insight}</p>
      </CardContent>
    </Card>
  );
}
