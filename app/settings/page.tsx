import { DataModeSettings } from "@/components/dashboard/data-mode-settings";

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-white p-7 shadow-[var(--shadow-sm-subtle)]">
        <h1 className="text-[32px] font-semibold tracking-tight text-slate-950">Settings</h1>
        <p className="mt-2 max-w-3xl text-[16px] text-slate-700">Manage Profit Desk preferences and environment display settings.</p>
      </section>
      <DataModeSettings buildMode={process.env.NEXT_PUBLIC_DATA_MODE ?? "mock"} />
    </div>
  );
}
