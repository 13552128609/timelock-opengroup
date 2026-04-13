function InputBase(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={
        "h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm outline-none focus:border-white/25 disabled:bg-white/5 disabled:text-white/50 disabled:border-white/5 disabled:cursor-not-allowed " +
        (props.className ?? "")
      }
    />
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-white/60 mb-1">{children}</div>;
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <InputBase {...props} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={
        "min-h-24 w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/25 disabled:bg-white/5 disabled:text-white/50 disabled:border-white/5 disabled:cursor-not-allowed " +
        (props.className ?? "")
      }
    />
  );
}

export function Button({
  children,
  disabled,
  onClick,
  type,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type ?? "button"}
      onClick={onClick}
      disabled={disabled}
      className={
        "h-10 px-4 rounded-md text-sm font-medium transition-colors " +
        (disabled
          ? "bg-white/10 text-white/40 cursor-not-allowed"
          : "bg-white text-black hover:bg-white/90")
      }
    >
      {children}
    </button>
  );
}

export function Toggle({
  on,
  setOn,
  label,
}: {
  on: boolean;
  setOn: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => setOn(!on)}
      className={
        "h-9 px-3 rounded-md border text-sm transition-colors " +
        (on
          ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
          : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10")
      }
    >
      {label}
    </button>
  );
}
