function InputBase(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={
        "h-10 w-full rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 text-sm outline-none focus:border-[var(--foreground)]/25 disabled:bg-[var(--panel)] disabled:text-[var(--muted-2)] disabled:border-[var(--border)] disabled:cursor-not-allowed " +
        (props.className ?? "")
      }
    />
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-[var(--muted)] mb-1">{children}</div>;
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <InputBase {...props} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={
        "min-h-24 w-full rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]/25 disabled:bg-[var(--panel)] disabled:text-[var(--muted-2)] disabled:border-[var(--border)] disabled:cursor-not-allowed " +
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
          ? "bg-[var(--panel)] text-[var(--muted-2)] cursor-not-allowed"
          : "bg-[var(--foreground)] text-[var(--background)] hover:opacity-90")
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
          : "border-[var(--border)] bg-[var(--panel)] text-[var(--muted)] hover:bg-[var(--panel-2)]")
      }
    >
      {label}
    </button>
  );
}
