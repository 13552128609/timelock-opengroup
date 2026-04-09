export function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03]">
      <div className="px-5 py-4 border-b border-white/10">
        <div className="text-sm font-medium">{title}</div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}
