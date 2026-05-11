"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, ChevronRight, Cog, FileWarning, Handshake, ShieldAlert, Wrench } from "lucide-react";

const primary = [{ href: "/dashboard", label: "Today", icon: Activity }];

const groups = [
  {
    label: "Drilldowns",
    items: [
      { href: "/dashboard/sales", label: "Sales", icon: Handshake },
      { href: "/dashboard/service", label: "Service", icon: Wrench },
      { href: "/dashboard/parts", label: "Parts", icon: Activity },
    ],
  },
  {
    label: "Data",
    items: [
      { href: "/dashboard/alerts", label: "Health", icon: ShieldAlert },
      { href: "/dashboard/reports", label: "Issues", icon: FileWarning },
      { href: "/dashboard#source-health-detail", label: "Source Lineage", icon: ChevronRight },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const isActive = (href: string) => {
    const base = href.split("#")[0];
    return pathname === base || (base !== "/dashboard" && pathname?.startsWith(base));
  };

  return (
    <aside className="hidden w-[238px] shrink-0 border-r border-[rgba(255,255,255,0.06)] bg-[linear-gradient(180deg,#121826_0%,#161B2E_100%)] px-3 py-4 lg:block">
      <div className="px-1">
        <p className="text-[10px] font-semibold tracking-[0.18em] text-[#A855F7]">VELOCITY</p>
        <p className="mt-0.5 text-[15px] font-semibold tracking-tight text-[#F8FAFC]">Executive Operating System</p>
      </div>

      <nav className="mt-5 space-y-1.5">
        {primary.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-semibold transition ${
                active
                  ? "bg-[linear-gradient(90deg,rgba(139,92,246,0.32),rgba(91,91,214,0.26))] text-[#F8FAFC] shadow-[inset_2px_0_0_#A855F7]"
                  : "text-[#A1A1AA] hover:bg-[rgba(255,255,255,0.05)] hover:text-[#F8FAFC]"
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${active ? "text-[#E9D5FF]" : "text-[#71717A]"}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {groups.map((group) => (
          <div key={group.label} className="pt-2">
            <p className="px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#71717A]">{group.label}</p>
            <div className="mt-1 space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] font-medium transition ${
                      active
                        ? "bg-[linear-gradient(90deg,rgba(139,92,246,0.30),rgba(91,91,214,0.24))] text-[#F8FAFC] shadow-[inset_2px_0_0_#A855F7]"
                        : "text-[#A1A1AA] hover:bg-[rgba(255,255,255,0.05)] hover:text-[#F8FAFC]"
                    }`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${active ? "text-[#E9D5FF]" : "text-[#71717A]"}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        <div className="pt-2">
          <p className="px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#71717A]">Utility</p>
          <Link
            href="/settings"
            className={`mt-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] font-medium transition ${
              pathname === "/settings"
                ? "bg-[linear-gradient(90deg,rgba(139,92,246,0.30),rgba(91,91,214,0.24))] text-[#F8FAFC] shadow-[inset_2px_0_0_#A855F7]"
                : "text-[#A1A1AA] hover:bg-[rgba(255,255,255,0.05)] hover:text-[#F8FAFC]"
            }`}
          >
            <Cog className={`h-3.5 w-3.5 ${pathname === "/settings" ? "text-[#E9D5FF]" : "text-[#71717A]"}`} />
            <span>Settings</span>
          </Link>
        </div>
      </nav>
    </aside>
  );
}
