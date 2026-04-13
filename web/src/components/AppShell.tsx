"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletBar } from "@/components/WalletBar";

function NavItem({ href, label }: { href: string; label: string }) {
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
      {label}
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
                <NavItem href="/admin" label="Admin" />
                <NavItem href="/batch-builder" label="Schedule OpenGroup" />
                <NavItem href="/executor" label="Execute" />
                <NavItem href="/canceller" label="Cancel" />
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
