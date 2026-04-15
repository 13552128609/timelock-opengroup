export function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)]">
      <div className="px-5 py-4 border-b border-[var(--border)]">
        <div className="text-sm font-medium">{title}</div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}
