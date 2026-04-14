"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletBar } from "@/components/WalletBar";

function IconSchedule({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M8 2v3M16 2v3" />
      <path d="M3 9h18" />
      <path d="M5 5h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
      <path d="M9 14l2 2 4-5" />
    </svg>
  );
}

function IconExecute({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M5 12h12" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );
}

function IconCancel({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M18 6L6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}

function IconAdmin({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M12 1l3 6 6 .9-4.5 4.3 1.1 6.3L12 15.9 6.4 18.5l1.1-6.3L3 7.9 9 7z" />
    </svg>
  );
}

function NavItem({ href, label, icon }: { href: string; label: string; icon?: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link
      href={href}
      className={
        "px-3 py-2 rounded-md text-sm transition-colors " +
        (active
          ? "bg-white/10 text-white"
          : "text-white/70 hover:text-white hover:bg-white/5")
      }
    >
      <span className="flex items-center gap-2">
        {icon ? <span className="w-4 h-4 text-white/70">{icon}</span> : null}
        <span>{label}</span>
      </span>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [rolesOpen, setRolesOpen] = useState(true);

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white">
      <div className="flex min-h-screen">
        <aside className="w-72 border-r border-white/10 bg-[#070A12]">
          <div className="p-5">
            <div className="text-lg font-semibold tracking-tight">Timelock Console</div>
            <div className="text-xs text-white/50 mt-1">Wanchain 999 / 888</div>
          </div>
          <div className="px-3 pb-4">
            <button
              type="button"
              className="w-full flex items-center justify-between text-xs uppercase tracking-wider text-white/40 px-3 py-2 hover:text-white/70"
              onClick={() => setRolesOpen((v) => !v)}
            >
              <span>Roles</span>
              <span className="text-white/30">{rolesOpen ? "▾" : "▸"}</span>
            </button>

            {rolesOpen ? (
              <div className="flex flex-col gap-1 pl-3">                
                <NavItem href="/batch-builder" label="Schedule OpenGroup" icon={<IconSchedule className="w-4 h-4" />} />
                <NavItem href="/executor" label="Execute" icon={<IconExecute className="w-4 h-4" />} />
                <NavItem href="/canceller" label="Cancel" icon={<IconCancel className="w-4 h-4" />} />
                <NavItem href="/admin" label="Admin" icon={<IconAdmin className="w-4 h-4" />} />
              </div>
            ) : null}
          </div>
        </aside>

        <div className="flex-1 flex flex-col">
          <header className="h-16 border-b border-white/10 bg-[#0B0F1A]/80 backdrop-blur supports-[backdrop-filter]:bg-[#0B0F1A]/60">
            <div className="h-full px-6 flex items-center justify-between">
              <div className="text-sm text-white/70">Role-based timelock operations</div>
              <WalletBar />
            </div>
          </header>

          <main className="flex-1 p-6">
            <div className="mx-auto max-w-5xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
