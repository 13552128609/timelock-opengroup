"use client";

import { useEffect, useMemo, useState } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { injected } from "@wagmi/connectors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { RepoConfig } from "@/lib/types";
import { wanchainMainnet, wanchainTestnet } from "@/lib/wanchain";

const queryClient = new QueryClient();

type Props = {
  children: React.ReactNode;
};

export function Providers({ children }: Props) {
  const [repoConfig, setRepoConfig] = useState<RepoConfig | null>(null);

  useEffect(() => {
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
        <div className="min-h-screen bg-[#0B0F1A] text-white flex items-center justify-center">
          <div className="text-sm text-white/70">Loading config...</div>
        </div>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
    </QueryClientProvider>
  );
}
