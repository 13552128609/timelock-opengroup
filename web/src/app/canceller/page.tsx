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
import { CANCELLER_ROLE, timelockAbi } from "@/lib/timelock";

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

function safeToNumber(x: bigint): number | null {
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  const min = -max;
  if (x > max || x < min) return null;
  return Number(x);
}

function formatTsSeconds(ts: bigint | null | undefined) {
  if (ts === null || ts === undefined) return null;
  const n = safeToNumber(ts);
  if (n === null) return ts.toString();
  if (n <= 1) return String(n);
  return `${n} (${new Date(n * 1000).toISOString()})`;
}

export default function CancellerPage() {
  const { timelockAddr, smgContractAddr, gpkContractAddr } = useActiveNetworkConfig();
  const { isConnected } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();
  const publicClient = usePublicClient();
  const { sendTx } = useTxFeedback();

  const defaultBlocksBack = useMemo(() => {
    // 86400 seconds/day, 5 sec/block, 30 days
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
      target: `0x${string}`;
      value: bigint;
      data: `0x${string}`;
      predecessor: `0x${string}`;
      delay: bigint;
      index: bigint;
      blockNumber: bigint;
      txHash: `0x${string}`;
      timestamp: bigint | null;
      ready: boolean | null;
      pending: boolean | null;
      done: boolean | null;
      decoded: DecodedCall | null;
    }>
  >([]);

  function decodeCall(target: `0x${string}`, data: `0x${string}`): DecodedCall {
    try {
      if (smgContractAddr && target.toLowerCase() === smgContractAddr.toLowerCase()) {
        const decoded = decodeFunctionData({ abi: smgAbi, data });
        return {
          kind: "decoded",
          functionName: decoded.functionName,
          args: (decoded.args?.[0] && typeof decoded.args?.[0] === "object")
            ? ({ ...(decoded.args?.[0] as any), wkAddrs: decoded.args?.[1], senders: decoded.args?.[2] } as any)
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

      const logs = await publicClient.getLogs({
        address: timelockAddr as `0x${string}`,
        event: timelockAbi.find((x: any) => x.type === "event" && x.name === "CallScheduled") as any,
        fromBlock: from,
        toBlock: latest,
      });

      const parsed = parseEventLogs({
        abi: timelockAbi as any,
        logs,
        eventName: "CallScheduled",
      });

      const rows = await Promise.all(
        parsed.map(async (l: any) => {
          const args = l.args as any;
          const opId = args.id as `0x${string}`;
          const target = args.target as `0x${string}`;
          const data = args.data as `0x${string}`;
          const delay = BigInt(args.delay);

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

          return {
            id: opId,
            target,
            value: BigInt(args.value),
            data,
            predecessor: args.predecessor as `0x${string}`,
            delay,
            index: BigInt(args.index),
            blockNumber: BigInt(l.blockNumber ?? 0),
            txHash: (l.transactionHash ?? "0x") as `0x${string}`,
            timestamp: ts,
            done,
            pending,
            ready,
            decoded: decodeCall(target, data),
          };
        })
      );

      const uniqMap = new Map<string, (typeof rows)[number]>();
      for (const r of rows) {
        const k = `${r.id.toLowerCase()}-${r.index.toString()}`;
        const prev = uniqMap.get(k);
        if (!prev || r.blockNumber > prev.blockNumber) uniqMap.set(k, r);
      }
      const uniqRows = Array.from(uniqMap.values());

      const filtered = uniqRows
        .filter((x) => !x.done)
        .filter((x) => x.timestamp !== null && x.timestamp > BigInt(1))
        .sort((a, b) => {
          if (a.blockNumber === b.blockNumber) return a.index > b.index ? -1 : 1;
          return a.blockNumber > b.blockNumber ? -1 : 1;
        });

      setOps(filtered);
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
      <div className="mb-6">
        <div className="text-xl font-semibold">CANCELLER</div>
        <div className="text-sm text-white/60 mt-1">Cancel a scheduled operation by id</div>
      </div>

      <RoleGate role={CANCELLER_ROLE}>
        {({ allowed, reason }) => (
          <div className="space-y-6">
            {!allowed ? (
              <div className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
                {reason ?? "Missing CANCELLER role"}
              </div>
            ) : null}

            <Card title="Scan CallScheduled (last N blocks)">
              <div className="grid grid-cols-1 gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>blocksBack (Abount 30days)</Label>
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

                <div className="text-xs text-white/60">
                  fromBlock: {fromBlock?.toString() ?? "-"} toBlock: {toBlock?.toString() ?? "-"}
                </div>

                {error ? (
                  <div className="rounded-lg border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
                    {error}
                  </div>
                ) : null}

                <div className="text-sm text-white/70">
                  Showing operations that are <span className="text-white">not done</span>.
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {ops.length === 0 ? (
                    <div className="text-sm text-white/60">No cancellable CallScheduled events in this range.</div>
                  ) : (
                    ops.map((op) => (
                      <div key={`${op.id}-${op.index.toString()}`} className="rounded-lg border border-white/10 bg-black/20 p-4">
                        <div className="grid grid-cols-1 gap-2">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-mono text-xs break-all">id: {op.id}</div>
                            <Button
                              disabled={!allowed || !isConnected || !timelockAddr || timelockAddr === "" || isPending}
                              onClick={async () => {
                                if (!timelockAddr || timelockAddr === "") return;
                                const res = await sendTx(
                                  () =>
                                    writeContractAsync({
                                      abi: timelockAbi,
                                      address: timelockAddr as `0x${string}`,
                                      functionName: "cancel",
                                      args: [op.id as any],
                                    }),
                                  "Cancel operation"
                                );

                                if (res.status === "success") {
                                  setOps((prev) => prev.filter((x) => x.id.toLowerCase() !== op.id.toLowerCase()));
                                }
                              }}
                            >
                              {isPending ? "Submitting..." : "Cancel"}
                            </Button>
                          </div>

                          <div className="text-xs text-white/70 grid grid-cols-1 md:grid-cols-2 gap-2">
                            <div className="font-mono break-all">target: {op.target}</div>
                            <div>value: {op.value === BigInt(0) ? "0" : formatUnits(op.value, 18)}</div>
                            <div>delay: {op.delay.toString()} sec</div>
                            <div>timestamp: {formatTsSeconds(op.timestamp) ?? "-"}</div>
                            <div>pending: {String(op.pending)}</div>
                            <div>ready: {String(op.ready)}</div>
                            <div>done: {String(op.done)}</div>
                            <div className="font-mono break-all">tx: {op.txHash}</div>
                          </div>

                          <div className="text-xs">
                            <div className="font-semibold mb-1">decoded</div>
                            <pre className="text-xs whitespace-pre-wrap rounded-md border border-white/10 bg-black/20 p-3">
                              {op.decoded
                                ? op.decoded.kind === "decoded"
                                  ? JSON.stringify(
                                      {
                                        functionName: op.decoded.functionName,
                                        args: op.decoded.args,
                                      },
                                      (_, v) => (typeof v === "bigint" ? v.toString() : v),
                                      2
                                    )
                                  : JSON.stringify({ kind: "unknown", reason: op.decoded.reason }, null, 2)
                                : "null"}
                            </pre>
                          </div>

                          <div className="text-xs">
                            <div className="font-semibold mb-1">raw calldata</div>
                            <pre className="text-xs whitespace-pre-wrap rounded-md border border-white/10 bg-black/20 p-3 break-all">
                              {op.data}
                            </pre>
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
