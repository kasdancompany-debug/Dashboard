import { ReactNode } from "react";
import { AppShell } from "@/components/dashboard/app-shell";

export default function DemoLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
