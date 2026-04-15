"use client";

import { useEffect, useMemo, useState } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { injected } from "@wagmi/connectors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { RepoConfig } from "@/lib/types";
import { wanchainMainnet, wanchainTestnet } from "@/lib/wanchain";
import { TxFeedbackProvider } from "@/components/TxFeedbackProvider";

const queryClient = new QueryClient();

function applyInitialTheme() {
  if (typeof document === "undefined") return;
  try {
    const stored = localStorage.getItem("theme");
    const t = stored === "light" || stored === "dark" ? stored : null;
    if (t) {
      document.documentElement.setAttribute("data-theme", t);
      return;
    }

    const prefersDark =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.setAttribute("data-theme", prefersDark ? "dark" : "light");
  } catch {
    document.documentElement.setAttribute("data-theme", "dark");
  }
}

type Props = {
  children: React.ReactNode;
};

export function Providers({ children }: Props) {
  const [repoConfig, setRepoConfig] = useState<RepoConfig | null>(null);

  useEffect(() => {
    applyInitialTheme();

    let mounted = true;
    (async () => {
      const res = await fetch("/api/config", { cache: "no-store" });
      const json = (await res.json()) as RepoConfig;
      if (!mounted) return;
      setRepoConfig(json);
    })().catch(() => {
      if (!mounted) return;
      setRepoConfig(null);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const wagmiConfig = useMemo(() => {
    if (!repoConfig) return null;

    const testnet = wanchainTestnet(repoConfig.testnet.url);
    const mainnet = wanchainMainnet(repoConfig.mainnet.url);

    return createConfig({
      chains: [testnet, mainnet],
      connectors: [injected()],
      transports: {
        [testnet.id]: http(testnet.rpcUrls.default.http[0]),
        [mainnet.id]: http(mainnet.rpcUrls.default.http[0]),
      },
    });
  }, [repoConfig]);

  if (!wagmiConfig) {
    return (
      <QueryClientProvider client={queryClient}>
        <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex items-center justify-center">
          <div className="text-sm text-[var(--muted)]">Loading config...</div>
        </div>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <TxFeedbackProvider>{children}</TxFeedbackProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
}
