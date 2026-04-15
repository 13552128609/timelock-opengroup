"use client";

import { useCallback, useMemo } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSwitchChain,
  useChainId,
} from "wagmi";

import { ThemeToggle } from "@/components/ThemeToggle";
import { useRepoConfig } from "@/lib/useRepoConfig";
import { useSelectedGroup } from "@/lib/useSelectedGroup";

function shortAddress(addr?: string) {
  if (!addr) return "";
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

export function WalletBar() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain, isPending: switching } = useSwitchChain();

  const { data: repoConfig } = useRepoConfig();
  const section = chainId === 888 ? "mainnet" : chainId === 999 ? "testnet" : null;
  const { selected: grpPrex, setSelected: setGrpPrex, availableGroups, needsSelection } = useSelectedGroup(section, repoConfig);

  const supported = useMemo(() => new Set([999, 888]), []);
  const isSupportedChain = supported.has(chainId);

  const onConnect = useCallback(() => {
    const connector = connectors.find((c) => c.id === "injected") ?? connectors[0];
    if (!connector) return;
    connect({ connector });
  }, [connect, connectors]);

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 text-xs text-[var(--muted)] flex-wrap">
        <ThemeToggle />

        {isSupportedChain ? (
          <div className="flex items-center gap-2">
            <span>group:</span>
            <select
              className={
                "h-7 rounded-md px-2 bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--border)] " +
                (needsSelection ? "ring-2 ring-[var(--warning-border)]" : "")
              }
              value={grpPrex || ""}
              onChange={(e) => setGrpPrex(e.target.value)}
            >
              <option value="">Select...</option>
              {availableGroups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            {needsSelection ? <span className="text-[var(--warning-text)]">select group</span> : null}
          </div>
        ) : null}

        <span>chainId:</span>
        <span className={isSupportedChain ? "text-emerald-300" : "text-amber-300"}>{chainId}</span>
      </div>

      {isConnected ? (
        <>
          {!isSupportedChain ? (
            <div className="flex items-center gap-2">
              <button
                className="h-9 px-3 rounded-md bg-[var(--panel)] hover:bg-[var(--panel-2)] text-sm"
                onClick={() => switchChain({ chainId: 999 })}
                disabled={switching}
              >
                Switch to 999
              </button>
              <button
                className="h-9 px-3 rounded-md bg-[var(--panel)] hover:bg-[var(--panel-2)] text-sm"
                onClick={() => switchChain({ chainId: 888 })}
                disabled={switching}
              >
                Switch to 888
              </button>
            </div>
          ) : null}

          <div className="h-9 px-3 rounded-md bg-[var(--panel)] border border-[var(--border)] flex items-center text-sm">
            {shortAddress(address)}
          </div>
          <button
            className="h-9 px-3 rounded-md bg-[var(--foreground)] text-[var(--background)] text-sm hover:opacity-90"
            onClick={() => disconnect()}
          >
            Disconnect
          </button>
        </>
      ) : (
        <button
          className="h-9 px-3 rounded-md bg-[var(--foreground)] text-[var(--background)] text-sm hover:opacity-90"
          onClick={onConnect}
          disabled={isPending}
        >
          {isPending ? "Connecting..." : "Connect Wallet"}
        </button>
      )}
    </div>
  );
}
