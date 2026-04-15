"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { decodeFunctionData, formatUnits, parseEventLogs } from "viem";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";
import { Button, Input, Label } from "@/components/Form";
import { RoleGate } from "@/components/RoleGate";
import { useTxFeedback } from "@/components/TxFeedbackProvider";
import { useActiveNetworkConfig } from "@/lib/networkConfig";
import { EXECUTOR_ROLE, timelockAbi } from "@/lib/timelock";

const smgAbi = [
  {
    type: "function",
    name: "storemanGroupRegisterStart",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "smg",
        type: "tuple",
        components: [
          { name: "groupId", type: "bytes32" },
          { name: "preGroupId", type: "bytes32" },
          { name: "workTime", type: "uint256" },
          { name: "totalTime", type: "uint256" },
          { name: "registerDuration", type: "uint256" },
          { name: "memberCountDesign", type: "uint256" },
          { name: "threshold", type: "uint256" },
          { name: "chain1", type: "uint256" },
          { name: "chain2", type: "uint256" },
          { name: "curve1", type: "uint256" },
          { name: "curve2", type: "uint256" },
          { name: "minStakeIn", type: "uint256" },
          { name: "minDelegateIn", type: "uint256" },
          { name: "minPartIn", type: "uint256" },
          { name: "delegateFee", type: "uint256" },
        ],
      },
      { name: "wkAddrs", type: "address[]" },
      { name: "senders", type: "address[]" },
    ],
    outputs: [],
  },
] as const;

const gpkAbi = [
  {
    type: "function",
    name: "setPeriod",
    stateMutability: "nonpayable",
    inputs: [
      { name: "groupId", type: "bytes32" },
      { name: "ployCommitPeriod", type: "uint32" },
      { name: "defaultPeriod", type: "uint32" },
      { name: "negotiatePeriod", type: "uint32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setGpkCfg",
    stateMutability: "nonpayable",
    inputs: [
      { name: "groupId", type: "bytes32" },
      { name: "curIndex", type: "uint256[]" },
      { name: "algoIndex", type: "uint256[]" },
    ],
    outputs: [],
  },
] as const;

type DecodedCall =
  | {
      kind: "decoded";
      functionName: string;
      args: Record<string, unknown>;
    }
  | {
      kind: "unknown";
      reason: string;
    };

function decodeCall(
  smgContractAddr: string | null,
  gpkContractAddr: string | null,
  target: `0x${string}`,
  data: `0x${string}`
): DecodedCall {
  try {
    if (smgContractAddr && target.toLowerCase() === smgContractAddr.toLowerCase()) {
      const decoded = decodeFunctionData({ abi: smgAbi, data });
      return {
        kind: "decoded",
        functionName: decoded.functionName,
        args:
          decoded.args?.[0] && typeof decoded.args?.[0] === "object"
            ? ({
                ...(decoded.args?.[0] as any),
                wkAddrs: decoded.args?.[1],
                senders: decoded.args?.[2],
              } as any)
            : ({ args: decoded.args } as any),
      };
    }

    if (gpkContractAddr && target.toLowerCase() === gpkContractAddr.toLowerCase()) {
      const decoded = decodeFunctionData({ abi: gpkAbi, data });
      const args = decoded.args ?? [];
      const named: Record<string, unknown> = {};
      if (decoded.functionName === "setPeriod") {
        named.groupId = args[0];
        named.ployCommitPeriod = args[1];
        named.defaultPeriod = args[2];
        named.negotiatePeriod = args[3];
      } else if (decoded.functionName === "setGpkCfg") {
        named.groupId = args[0];
        named.curIndex = args[1];
        named.algoIndex = args[2];
      } else {
        named.args = args;
      }
      return { kind: "decoded", functionName: decoded.functionName, args: named };
    }

    return { kind: "unknown", reason: "target not recognized (not SMG/GPK)" };
  } catch (e: any) {
    return { kind: "unknown", reason: String(e?.message || e) };
  }
}

export default function ExecutorPage() {
  const { timelockAddr, smgContractAddr, gpkContractAddr } = useActiveNetworkConfig();
  const { isConnected } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();
  const publicClient = usePublicClient();
  const { sendTx } = useTxFeedback();

  const defaultBlocksBack = useMemo(() => {
    return Math.floor((86400 / 5) * 30);
  }, []);

  const [blocksBack, setBlocksBack] = useState(String(defaultBlocksBack));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromBlock, setFromBlock] = useState<bigint | null>(null);
  const [toBlock, setToBlock] = useState<bigint | null>(null);
  const [ops, setOps] = useState<
    Array<{
      id: `0x${string}`;
      predecessor: `0x${string}`;
      salt: `0x${string}`;
      timestamp: bigint | null;
      done: boolean;
      pending: boolean;
      ready: boolean;
      calls: Array<{
        index: bigint;
        target: `0x${string}`;
        value: bigint;
        data: `0x${string}`;
        decoded: DecodedCall;
        blockNumber: bigint;
        txHash: `0x${string}`;
      }>;
    }>
  >([]);

  async function refresh() {
    if (!publicClient) return;
    if (!timelockAddr || timelockAddr === "") return;

    setLoading(true);
    setError(null);

    try {
      const latest = await publicClient.getBlockNumber();
      const back = BigInt(Math.max(0, Number(blocksBack || "0")));
      const from = latest > back ? latest - back : BigInt(0);
      setFromBlock(from);
      setToBlock(latest);

      const callScheduledLogs = await publicClient.getLogs({
        address: timelockAddr as `0x${string}`,
        event: timelockAbi.find((x: any) => x.type === "event" && x.name === "CallScheduled") as any,
        fromBlock: from,
        toBlock: latest,
      });
      const scheduled = parseEventLogs({
        abi: timelockAbi as any,
        logs: callScheduledLogs,
        eventName: "CallScheduled",
      }) as any[];

      const callSaltLogs = await publicClient.getLogs({
        address: timelockAddr as `0x${string}`,
        event: timelockAbi.find((x: any) => x.type === "event" && x.name === "CallSalt") as any,
        fromBlock: from,
        toBlock: latest,
      });
      const saltsParsed = parseEventLogs({
        abi: timelockAbi as any,
        logs: callSaltLogs,
        eventName: "CallSalt",
      }) as any[];

      const saltById = new Map<string, `0x${string}`>();
      for (const e of saltsParsed) {
        const id = (e.args?.id ?? "") as `0x${string}`;
        const salt = (e.args?.salt ?? ("0x" + "0".repeat(64))) as `0x${string}`;
        if (id && id !== "0x") saltById.set(id.toLowerCase(), salt);
      }

      const grouped = new Map<
        string,
        {
          id: `0x${string}`;
          predecessor: `0x${string}`;
          calls: Array<{
            index: bigint;
            target: `0x${string}`;
            value: bigint;
            data: `0x${string}`;
            decoded: DecodedCall;
            blockNumber: bigint;
            txHash: `0x${string}`;
          }>;
        }
      >();

      for (const e of scheduled) {
        const a = e.args as any;
        const id = a.id as `0x${string}`;
        const key = id.toLowerCase();
        const item = grouped.get(key) ?? {
          id,
          predecessor: a.predecessor as `0x${string}`,
          calls: [],
        };
        item.calls.push({
          index: BigInt(a.index),
          target: a.target as `0x${string}`,
          value: BigInt(a.value),
          data: a.data as `0x${string}`,
          decoded: decodeCall(smgContractAddr, gpkContractAddr, a.target as any, a.data as any),
          blockNumber: BigInt(e.blockNumber ?? 0),
          txHash: (e.transactionHash ?? "0x") as `0x${string}`,
        });
        grouped.set(key, item);
      }

      const ids = Array.from(grouped.values()).map((x) => x.id);

      const statuses = await Promise.all(
        ids.map(async (opId) => {
          const [done, pending, ready, ts] = await Promise.all([
            publicClient.readContract({
              abi: timelockAbi,
              address: timelockAddr as `0x${string}`,
              functionName: "isOperationDone",
              args: [opId],
            }) as Promise<boolean>,
            publicClient.readContract({
              abi: timelockAbi,
              address: timelockAddr as `0x${string}`,
              functionName: "isOperationPending",
              args: [opId],
            }) as Promise<boolean>,
            publicClient.readContract({
              abi: timelockAbi,
              address: timelockAddr as `0x${string}`,
              functionName: "isOperationReady",
              args: [opId],
            }) as Promise<boolean>,
            publicClient
              .readContract({
                abi: timelockAbi,
                address: timelockAddr as `0x${string}`,
                functionName: "getTimestamp",
                args: [opId],
              })
              .then((x) => BigInt(x as any))
              .catch(() => null),
          ]);
          return { opId, done, pending, ready, ts };
        })
      );

      const statusById = new Map<string, { done: boolean; pending: boolean; ready: boolean; ts: bigint | null }>();
      for (const s of statuses) statusById.set(s.opId.toLowerCase(), { done: s.done, pending: s.pending, ready: s.ready, ts: s.ts });

      const list = Array.from(grouped.values())
        .map((g) => {
          const st = statusById.get(g.id.toLowerCase()) ?? { done: false, pending: false, ready: false, ts: null };
          const salt = saltById.get(g.id.toLowerCase()) ?? (("0x" + "0".repeat(64)) as `0x${string}`);

          const uniqCallsByIndex = new Map<string, (typeof g.calls)[number]>();
          for (const c of g.calls) {
            const k = c.index.toString();
            const prev = uniqCallsByIndex.get(k);
            if (!prev || c.blockNumber > prev.blockNumber) uniqCallsByIndex.set(k, c);
          }
          const calls = Array.from(uniqCallsByIndex.values()).sort((a, b) =>
            a.index === b.index ? 0 : a.index < b.index ? -1 : 1
          );

          return {
            id: g.id,
            predecessor: g.predecessor,
            salt,
            timestamp: st.ts,
            done: st.done,
            pending: st.pending,
            ready: st.ready,
            calls,
          };
        })
        .filter((x) => !x.done)
        .filter((x) => x.timestamp !== null && x.timestamp > BigInt(1))
        .filter((x) => x.ready)
        .sort((a, b) => {
          const ab = a.calls[0]?.blockNumber ?? BigInt(0);
          const bb = b.calls[0]?.blockNumber ?? BigInt(0);
          return ab === bb ? 0 : ab > bb ? -1 : 1;
        });

      setOps(list);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timelockAddr, publicClient]);

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-xl font-semibold">EXECUTOR</div>
          <div className="text-sm text-[var(--muted)] mt-1">Execute timelock operations (single or batch)</div>
        </div>
      </div>

      <RoleGate role={EXECUTOR_ROLE}>
        {({ allowed, reason }) => (
          <div className="space-y-6">
            {!allowed ? (
              <div className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-bg)] px-4 py-3 text-sm text-[var(--warning-text)]">
                {reason ?? "Missing EXECUTOR role"}
              </div>
            ) : null}

            <Card title="Scan CallScheduled (ready to execute)">
              <div className="grid grid-cols-1 gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>blocksBack (About 30days)</Label>
                    <Input value={blocksBack} onChange={(e) => setBlocksBack(e.target.value)} />
                  </div>
                  <div className="flex items-end gap-3">
                    <Button
                      disabled={!allowed || !isConnected || !timelockAddr || timelockAddr === "" || !publicClient || loading}
                      onClick={refresh}
                    >
                      {loading ? "Scanning..." : "Refresh"}
                    </Button>
                  </div>
                </div>

                <div className="text-xs text-[var(--muted)]">
                  fromBlock: {fromBlock?.toString() ?? "-"} toBlock: {toBlock?.toString() ?? "-"}
                </div>

                {error ? (
                  <div className="rounded-lg border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
                    {error}
                  </div>
                ) : null}

                <div className="grid grid-cols-1 gap-3">
                  {ops.length === 0 ? (
                    <div className="text-sm text-[var(--muted)]">No ready-to-execute operations in this range.</div>
                  ) : (
                    ops.map((op) => (
                      <div key={op.id} className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4">
                        <div className="grid grid-cols-1 gap-2">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-mono text-xs break-all">id: {op.id}</div>
                            <Button
                              disabled={!allowed || !isConnected || !timelockAddr || timelockAddr === "" || isPending}
                              onClick={async () => {
                                if (!timelockAddr || timelockAddr === "") return;
                                const predecessor = op.predecessor;
                                const salt = op.salt;
                                if (op.calls.length <= 1) {
                                  const c = op.calls[0];
                                  if (!c) return;
                                  const res = await sendTx(
                                    () =>
                                      writeContractAsync({
                                        abi: timelockAbi,
                                        address: timelockAddr as `0x${string}`,
                                        functionName: "execute",
                                        args: [c.target as any, c.value as any, c.data as any, predecessor as any, salt as any],
                                      }),
                                    "Execute operation"
                                  );

                                  if (res.status === "success") {
                                    setOps((prev) => prev.filter((x) => x.id.toLowerCase() !== op.id.toLowerCase()));
                                  }
                                } else {
                                  const targets = op.calls.map((c) => c.target);
                                  const values = op.calls.map((c) => c.value);
                                  const payloads = op.calls.map((c) => c.data);
                                  const res = await sendTx(
                                    () =>
                                      writeContractAsync({
                                        abi: timelockAbi,
                                        address: timelockAddr as `0x${string}`,
                                        functionName: "executeBatch",
                                        args: [targets as any, values as any, payloads as any, predecessor as any, salt as any],
                                      }),
                                    "Execute batch"
                                  );

                                  if (res.status === "success") {
                                    setOps((prev) => prev.filter((x) => x.id.toLowerCase() !== op.id.toLowerCase()));
                                  }
                                }
                              }}
                            >
                              {isPending ? "Submitting..." : op.calls.length <= 1 ? "Execute" : "ExecuteBatch"}
                            </Button>
                          </div>

                          <div className="text-xs text-[var(--muted)] grid grid-cols-1 md:grid-cols-2 gap-2">
                            <div className="font-mono break-all">predecessor: {op.predecessor}</div>
                            <div className="font-mono break-all">salt: {op.salt}</div>
                            <div>ready: {String(op.ready)}</div>
                            <div>pending: {String(op.pending)}</div>
                            <div>done: {String(op.done)}</div>
                            <div>timestamp: {op.timestamp?.toString() ?? "-"}</div>
                            <div>calls: {String(op.calls.length)}</div>
                          </div>

                          <div className="grid grid-cols-1 gap-3">
                            {op.calls.map((c) => (
                              <div key={`${op.id}-${c.index.toString()}`} className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-3">
                                <div className="text-xs text-[var(--muted)] grid grid-cols-1 md:grid-cols-2 gap-2">
                                  <div className="font-mono break-all">target: {c.target}</div>
                                  <div>value: {c.value === BigInt(0) ? "0" : formatUnits(c.value, 18)}</div>
                                  <div>index: {c.index.toString()}</div>
                                  <div className="font-mono break-all">tx: {c.txHash}</div>
                                </div>

                                <div className="text-xs mt-2">
                                  <div className="font-semibold mb-1">decoded</div>
                                  <pre className="text-xs whitespace-pre-wrap rounded-md border border-[var(--border)] bg-[var(--panel)] p-3">
                                    {c.decoded.kind === "decoded"
                                      ? JSON.stringify(
                                          {
                                            functionName: c.decoded.functionName,
                                            args: c.decoded.args,
                                          },
                                          (_, v) => (typeof v === "bigint" ? v.toString() : v),
                                          2
                                        )
                                      : JSON.stringify({ kind: "unknown", reason: c.decoded.reason }, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </Card>
          </div>
        )}
      </RoleGate>
    </AppShell>
  );
}
