import { ReactNode } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="velocity-atmosphere relative min-h-screen text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_18%,rgba(168,85,247,0.10),transparent_34%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_72%,rgba(91,91,214,0.10),transparent_34%)]" />
      <div className="relative">{children}</div>
    </div>
  );
}
