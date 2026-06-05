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
  {
    type: "function",
    name: "select",
    stateMutability: "nonpayable",
    inputs: [{ name: "groupId", type: "bytes32" }],
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

function bytes32ToText(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("0x")) return null;
  const hex = value.slice(2);
  const chars: string[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    const byte = hex.slice(i, i + 2);
    if (!byte || byte === "00") continue;
    chars.push(String.fromCharCode(Number.parseInt(byte, 16)));
  }
  return chars.join("") || null;
}

function toBigIntValue(value: unknown) {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === "string" && value.trim() !== "") {
    try {
      return BigInt(value);
    } catch {
      return null;
    }
  }
  return null;
}

function findPloyCommitPeriodForOperation(id: `0x${string}`, ops: Array<{ id: `0x${string}`; decoded: DecodedCall | null }>) {
  const found = ops.find(
    (x) =>
      x.id.toLowerCase() === id.toLowerCase() &&
      x.decoded?.kind === "decoded" &&
      x.decoded.functionName === "setPeriod"
  );
  return found?.decoded?.kind === "decoded" ? toBigIntValue(found.decoded.args.ployCommitPeriod) : null;
}

function getStoremanGroupRegisterStartDerived(
  op: {
    id: `0x${string}`;
    timestamp: bigint | null;
    decoded: DecodedCall | null;
  },
  ops: Array<{ id: `0x${string}`; decoded: DecodedCall | null }>
) {
  if (op.decoded?.kind !== "decoded" || op.decoded.functionName !== "storemanGroupRegisterStart") return null;

  const args = op.decoded.args;
  const workTime = toBigIntValue(args.workTime);
  const totalTime = toBigIntValue(args.totalTime);
  const registerDuration = toBigIntValue(args.registerDuration);
  const ployCommitPeriod = findPloyCommitPeriodForOperation(op.id, ops);

  const workingEndTime = workTime !== null && totalTime !== null ? workTime + totalTime : null;
  const regEndTime = op.timestamp !== null && registerDuration !== null ? op.timestamp + registerDuration : null;
  const gpkEndTime = regEndTime !== null && ployCommitPeriod !== null ? regEndTime + ployCommitPeriod : null;

  return {
    groupName: bytes32ToText(args.groupId) ?? "-",
    parentGroupName: bytes32ToText(args.preGroupId) ?? "-",
    regEndTime,
    gpkEndTime,
    workingStartTime: workTime,
    workingEndTime,
  };
}

export default function CancellerPage() {
  const { timelockAddr, smgContractAddr, gpkContractAddr, needsGroupSelection } = useActiveNetworkConfig();
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
        const args = decoded.args ?? [];
        const named: Record<string, unknown> = {};
        if (decoded.functionName === "storemanGroupRegisterStart") {
          Object.assign(
            named,
            args?.[0] && typeof args?.[0] === "object"
              ? ({ ...(args?.[0] as any), wkAddrs: args?.[1], senders: args?.[2] } as any)
              : { args }
          );
        } else if (decoded.functionName === "select") {
          named.groupId = args[0];
        } else {
          named.args = args;
        }
        return {
          kind: "decoded",
          functionName: decoded.functionName,
          args: named,
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
        <div className="text-sm text-[var(--muted)] mt-1">Cancel a scheduled operation by id</div>
      </div>

      <RoleGate role={CANCELLER_ROLE}>
        {({ allowed, reason }) => (
          <div className="space-y-6">
            {needsGroupSelection ? (
              <div className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-bg)] px-4 py-3 text-sm text-[var(--warning-text)]">
                Please select a group (grpPrex) in the top-right header.
              </div>
            ) : null}

            {!allowed ? (
              <div className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-bg)] px-4 py-3 text-sm text-[var(--warning-text)]">
                {reason ?? "Missing CANCELLER role"}
              </div>
            ) : null}

            <Card title="Scan CallScheduled (last N blocks)">
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
                  <div className="rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error-text)]">
                    {error}
                  </div>
                ) : null}

                <div className="text-sm text-[var(--muted)]">
                  Showing operations that are <span className="text-[var(--foreground)]">not done</span>.
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {ops.length === 0 ? (
                    <div className="text-sm text-[var(--muted)]">No cancellable CallScheduled events in this range.</div>
                  ) : (
                    ops.map((op) => {
                      const derived = getStoremanGroupRegisterStartDerived(op, ops);

                      return (
                        <div key={`${op.id}-${op.index.toString()}`} className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4">
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

                            <div className="text-xs text-[var(--muted)] grid grid-cols-1 md:grid-cols-2 gap-2">
                              <div className="font-mono break-all">target: {op.target}</div>
                              <div>value: {op.value === BigInt(0) ? "0" : formatUnits(op.value, 18)}</div>
                              <div>delay: {op.delay.toString()} sec</div>
                              <div>timestamp: {formatTsSeconds(op.timestamp) ?? "-"}</div>
                              <div>pending: {String(op.pending)}</div>
                              <div>ready: {String(op.ready)}</div>
                              <div>done: {String(op.done)}</div>
                              <div className="font-mono break-all">tx: {op.txHash}</div>
                            </div>

                            {derived ? (
                              <div className="text-xs text-[var(--muted)] grid grid-cols-1 md:grid-cols-2 gap-2 rounded-md border border-[var(--border)] bg-[var(--panel)] p-3">
                                <div>groupName: {derived.groupName}</div>
                                <div>parentGroupName: {derived.parentGroupName}</div>
                                <div>regEndTime: {formatTsSeconds(derived.regEndTime) ?? "-"}</div>
                                <div>gpkEndTime: {formatTsSeconds(derived.gpkEndTime) ?? "-"}</div>
                                <div>workingStartTime: {formatTsSeconds(derived.workingStartTime) ?? "-"}</div>
                                <div>workingEndTime: {formatTsSeconds(derived.workingEndTime) ?? "-"}</div>
                              </div>
                            ) : null}

                            <div className="text-xs">
                              <div className="font-semibold mb-1">decoded</div>
                              <pre className="text-xs whitespace-pre-wrap rounded-md border border-[var(--border)] bg-[var(--panel)] p-3">
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
                              <pre className="text-xs whitespace-pre-wrap rounded-md border border-[var(--border)] bg-[var(--panel)] p-3 break-all">
                                {op.data}
                              </pre>
                            </div>
                          </div>
                        </div>
                      );
                    })
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
