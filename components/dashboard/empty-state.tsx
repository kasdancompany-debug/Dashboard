export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/20 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-10 text-center transition hover:border-white/35">
      <p className="text-lg font-semibold tracking-tight text-white">{title}</p>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-white/65">{detail}</p>
    </div>
  );
}
