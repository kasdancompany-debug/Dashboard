"use client";

import useSWR from "swr";
import { format } from "date-fns";
import { Activity, RefreshCcw } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const fetcher = async () => ({ status: "Live", updatedAt: new Date() });

export function TopBar({ embedded }: { embedded?: boolean }) {
  const { data, mutate, isLoading } = useSWR("live-status", fetcher, { refreshInterval: 12000 });
  const now = new Date();

  return (
    <header
      className={cn(
        "flex min-h-0 flex-wrap items-center justify-between gap-2",
        !embedded &&
          "min-h-[68px] rounded-xl border border-[rgba(255,255,255,0.06)] bg-[linear-gradient(160deg,rgba(255,255,255,0.07),rgba(255,255,255,0.01)_45%),#121826] px-5 py-2.5 shadow-[0_24px_60px_-38px_rgba(0,0,0,0.95)] backdrop-blur-md",
      )}
    >
      <div className="min-w-0 space-y-0.5">
        <h1
          className={cn(
            "truncate font-semibold tracking-tight text-[#F8FAFC]",
            embedded ? "text-[17px] leading-tight md:text-[19px]" : "text-[22px] leading-tight md:text-[24px]",
          )}
        >
          Sault Nissan
        </h1>
        <p className={cn("truncate text-[#A1A1AA]", embedded ? "text-[11px] leading-snug" : "text-[13px]")}>
          Live operating view for profit, risk, and accountability.
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="rounded-md border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.04)] px-2.5 py-1 text-[11px] font-semibold tabular-nums text-[#A1A1AA]">
          {format(now, "EEE MMM d")}
        </div>
        <div className="flex items-center gap-1.5 rounded-md border border-[#A855F7]/35 bg-[#5B5BD6]/20 px-2 py-1 text-[11px] font-semibold text-[#E9D5FF] transition-colors duration-200">
          <Activity className="h-3.5 w-3.5" aria-hidden />
          {isLoading ? "Syncing…" : `Session · ${format(data?.updatedAt ?? now, "h:mm a")}`}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 rounded-md border-[rgba(255,255,255,0.06)] bg-[rgba(168,85,247,0.12)] px-2.5 text-[11px] font-semibold text-[#F8FAFC] transition-colors duration-150 hover:bg-[rgba(168,85,247,0.24)]"
          onClick={() => mutate()}
        >
          <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
          Refresh
        </Button>
        <div className="hidden items-center gap-2 rounded-md border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.04)] px-2 py-1 sm:flex">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="bg-[#161B2E] text-[10px] text-[#E9D5FF]">DK</AvatarFallback>
          </Avatar>
          <span className="max-w-[100px] truncate text-[11px] font-semibold text-[#F8FAFC]">Dana Kim</span>
        </div>
      </div>
    </header>
  );
}
