import { parseTabToCanonicalKey } from "@/src/lib/google/month-tab-resolver";

function normalize(value: string) {
  return value.replace(/[.]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

/** Tabs like `May 2026 Sault` or `12 May 2026 Sault`. */
export function parsePerformanceMeetingTabToCanonicalKey(
  tabName: string,
): { key: string; meetingDay: number } | null {
  const raw = normalize(tabName);
  if (!raw) return null;

  const withoutStore = raw.replace(/\s+sault\b.*$/, "").trim();
  const dayMatch = withoutStore.match(/^(\d{1,2})\s+/);
  const meetingDay = dayMatch ? Number(dayMatch[1]) : 0;
  const core = dayMatch ? withoutStore.slice(dayMatch[0].length).trim() : withoutStore;
  const parsed = parseTabToCanonicalKey(core);
  if (!parsed) return null;
  return { key: parsed.key, meetingDay: Number.isFinite(meetingDay) ? meetingDay : 0 };
}

export function resolvePerformanceMeetingMonthTab(selectedKey: string, availableTabNames: string[]) {
  const matches: { tabName: string; meetingDay: number }[] = [];
  for (const tabName of availableTabNames) {
    const parsed = parsePerformanceMeetingTabToCanonicalKey(tabName);
    if (parsed?.key === selectedKey) {
      matches.push({ tabName, meetingDay: parsed.meetingDay });
    }
  }
  matches.sort((a, b) => b.meetingDay - a.meetingDay || a.tabName.localeCompare(b.tabName));
  const winner = matches[0] ?? null;
  return {
    matched: Boolean(winner),
    matchedTab: winner?.tabName ?? null,
    normalizedMatchedMonth: winner ? selectedKey : null,
    attemptedTabNames: availableTabNames.filter((tab) => {
      const parsed = parsePerformanceMeetingTabToCanonicalKey(tab);
      return parsed?.key === selectedKey;
    }),
  };
}
