import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Row = { name: string; department: string; metric: string; value: string };

export function LeaderboardTable({ rows }: { rows: Row[] }) {
  return (
    <Card className="rounded-2xl bg-card shadow-sm ring-1 ring-border/70">
      <CardHeader>
        <CardTitle className="text-lg text-foreground">Department leaderboard</CardTitle>
      </CardHeader>
      <CardContent>
        <Table className="overflow-hidden rounded-xl">
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow className="border-border/80">
              <TableHead className="h-11 bg-muted/60 px-3 text-sm font-semibold text-foreground">Name</TableHead>
              <TableHead className="h-11 bg-muted/60 px-3 text-sm font-semibold text-foreground">Department</TableHead>
              <TableHead className="h-11 bg-muted/60 px-3 text-sm font-semibold text-foreground">Metric</TableHead>
              <TableHead className="h-11 bg-muted/60 px-3 text-right text-sm font-semibold text-foreground">Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={`${row.name}-${row.metric}`} className="border-border/70 hover:bg-muted/35">
                <TableCell className="px-3 py-3 text-sm font-semibold text-foreground">{row.name}</TableCell>
                <TableCell className="px-3 py-3 text-sm text-muted-foreground">{row.department}</TableCell>
                <TableCell className="px-3 py-3 text-sm text-muted-foreground">{row.metric}</TableCell>
                <TableCell className="px-3 py-3 text-right text-sm font-semibold text-foreground">{row.value}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
