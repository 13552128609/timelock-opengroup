"use client";

import { useAccount, useReadContract } from "wagmi";
import { timelockAbi } from "@/lib/timelock";
import { useActiveNetworkConfig } from "@/lib/networkConfig";

export function RoleGate({
  role,
  children,
}: {
  role: `0x${string}`;
  children: (args: { allowed: boolean; reason?: string }) => React.ReactNode;
}) {
  const { address, isConnected } = useAccount();
  const { timelockAddr, section } = useActiveNetworkConfig();

  const enabled = Boolean(isConnected && address && timelockAddr && timelockAddr !== "");

  const { data } = useReadContract({
    abi: timelockAbi,
    address: (timelockAddr || undefined) as `0x${string}` | undefined,
    functionName: "hasRole",
    args: address ? [role, address] : undefined,
    query: { enabled },
  });

  if (!section) {
    return children({ allowed: false, reason: "Unsupported chain. Switch to 999 or 888." });
  }

  if (!timelockAddr) {
    return children({ allowed: false, reason: "Config not loaded" });
  }

  if (timelockAddr === "") {
    return children({ allowed: false, reason: "Timelock not configured for this network" });
  }

  if (!isConnected || !address) {
    return children({ allowed: false, reason: "Connect wallet" });
  }

  return children({ allowed: Boolean(data) });
}
