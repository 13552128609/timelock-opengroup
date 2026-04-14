"use client";

import { useMemo, useState } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";
import { Button, Input, Label, Textarea } from "@/components/Form";
import { RoleGate } from "@/components/RoleGate";
import { useTxFeedback } from "@/components/TxFeedbackProvider";
import { useActiveNetworkConfig } from "@/lib/networkConfig";
import { parseLines } from "@/lib/parse";
import {
  CANCELLER_ROLE,
  EXECUTOR_ROLE,
  PROPOSER_ROLE,
  TIMELOCK_ADMIN_ROLE,
  timelockAbi,
} from "@/lib/timelock";

export default function AdminPage() {
  const { timelockAddr } = useActiveNetworkConfig();
  const { isConnected } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();
  const { sendTx } = useTxFeedback();

  const [batchAddrs, setBatchAddrs] = useState("0x");
  const [lookupAddr, setLookupAddr] = useState("0x");

  const addresses = useMemo(() => {
    if (!batchAddrs || batchAddrs.trim() === "" || batchAddrs.trim() === "0x") return [];
    return parseLines(batchAddrs);
  }, [batchAddrs]);

  const lookupEnabled = Boolean(
    isConnected &&
      timelockAddr &&
      timelockAddr !== "" &&
      lookupAddr &&
      lookupAddr.startsWith("0x") &&
      lookupAddr.length === 42
  );

  const adminRole = useReadContract({
    abi: timelockAbi,
    address: (timelockAddr || undefined) as `0x${string}` | undefined,
    functionName: "hasRole",
    args: lookupEnabled ? [TIMELOCK_ADMIN_ROLE, lookupAddr as `0x${string}`] : undefined,
    query: { enabled: lookupEnabled },
  });

  const proposerRole = useReadContract({
    abi: timelockAbi,
    address: (timelockAddr || undefined) as `0x${string}` | undefined,
    functionName: "hasRole",
    args: lookupEnabled ? [PROPOSER_ROLE, lookupAddr as `0x${string}`] : undefined,
    query: { enabled: lookupEnabled },
  });

  const executorRole = useReadContract({
    abi: timelockAbi,
    address: (timelockAddr || undefined) as `0x${string}` | undefined,
    functionName: "hasRole",
    args: lookupEnabled ? [EXECUTOR_ROLE, lookupAddr as `0x${string}`] : undefined,
    query: { enabled: lookupEnabled },
  });

  const cancellerRole = useReadContract({
    abi: timelockAbi,
    address: (timelockAddr || undefined) as `0x${string}` | undefined,
    functionName: "hasRole",
    args: lookupEnabled ? [CANCELLER_ROLE, lookupAddr as `0x${string}`] : undefined,
    query: { enabled: lookupEnabled },
  });

  const RoleBadge = ({ value }: { value: boolean | null }) => {
    if (value === null) return <span className="text-white/40">-</span>;
    return value ? (
      <span className="inline-flex items-center rounded-md border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-xs font-medium text-emerald-200">
        true
      </span>
    ) : (
      <span className="inline-flex items-center rounded-md border border-red-400/30 bg-red-400/10 px-2 py-0.5 text-xs font-medium text-red-200">
        false
      </span>
    );
  };

  return (
    <AppShell>
      <div className="mb-6">
        <div className="text-xl font-semibold">ADMIN</div>
        <div className="text-sm text-white/60 mt-1">Manage timelock roles</div>
      </div>

      <RoleGate role={TIMELOCK_ADMIN_ROLE}>
        {({ allowed, reason }) => (
          <div className="space-y-6">
            {!allowed ? (
              <div className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
                {reason ?? "Missing TIMELOCK_ADMIN role"}
              </div>
            ) : null}

            <Card title="Batch grantRole">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label>addresses (one per line)</Label>
                  <Textarea value={batchAddrs} onChange={(e) => setBatchAddrs(e.target.value)} />
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <Button
                    disabled={!allowed || !isConnected || !timelockAddr || timelockAddr === "" || isPending || addresses.length === 0}
                    onClick={async () => {
                      if (!timelockAddr || timelockAddr === "") return;
                      for (const a of addresses) {
                        await sendTx(
                          () =>
                            writeContractAsync({
                              abi: timelockAbi,
                              address: timelockAddr as `0x${string}`,
                              functionName: "grantRole",
                              args: [PROPOSER_ROLE, a as any],
                            }),
                          "Grant PROPOSER role"
                        );
                      }
                    }}
                  >
                    {isPending ? "Submitting..." : "Grant PROPOSER (batch)"}
                  </Button>

                  <Button
                    disabled={!allowed || !isConnected || !timelockAddr || timelockAddr === "" || isPending || addresses.length === 0}
                    onClick={async () => {
                      if (!timelockAddr || timelockAddr === "") return;
                      for (const a of addresses) {
                        await sendTx(
                          () =>
                            writeContractAsync({
                              abi: timelockAbi,
                              address: timelockAddr as `0x${string}`,
                              functionName: "grantRole",
                              args: [EXECUTOR_ROLE, a as any],
                            }),
                          "Grant EXECUTOR role"
                        );
                      }
                    }}
                  >
                    {isPending ? "Submitting..." : "Grant EXECUTOR (batch)"}
                  </Button>

                  <Button
                    disabled={!allowed || !isConnected || !timelockAddr || timelockAddr === "" || isPending || addresses.length === 0}
                    onClick={async () => {
                      if (!timelockAddr || timelockAddr === "") return;
                      for (const a of addresses) {
                        await sendTx(
                          () =>
                            writeContractAsync({
                              abi: timelockAbi,
                              address: timelockAddr as `0x${string}`,
                              functionName: "grantRole",
                              args: [CANCELLER_ROLE, a as any],
                            }),
                          "Grant CANCELLER role"
                        );
                      }
                    }}
                  >
                    {isPending ? "Submitting..." : "Grant CANCELLER (batch)"}
                  </Button>
                </div>
              </div>
            </Card>

            <Card title="Role lookup">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label>address</Label>
                  <Input value={lookupAddr} onChange={(e) => setLookupAddr(e.target.value)} />
                </div>

                <div className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <span>TIMELOCK_ADMIN_ROLE</span>
                      <RoleBadge value={lookupEnabled ? Boolean(adminRole.data) : null} />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>PROPOSER_ROLE</span>
                      <RoleBadge value={lookupEnabled ? Boolean(proposerRole.data) : null} />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>EXECUTOR_ROLE</span>
                      <RoleBadge value={lookupEnabled ? Boolean(executorRole.data) : null} />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>CANCELLER_ROLE</span>
                      <RoleBadge value={lookupEnabled ? Boolean(cancellerRole.data) : null} />
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}
      </RoleGate>
    </AppShell>
  );
}
