"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { encodeFunctionData, pad, stringToHex } from "viem";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";
import { Button, Input, Label, Textarea } from "@/components/Form";
import { RoleGate } from "@/components/RoleGate";
import { useActiveNetworkConfig } from "@/lib/networkConfig";
import { parseLines } from "@/lib/parse";
import { PROPOSER_ROLE, timelockAbi } from "@/lib/timelock";

function toBytes32FromAscii(s: string) {
  const raw = stringToHex(s || "");
  const out = pad(raw, { size: 32, dir: "left" });
  return out as `0x${string}`;
}

function toUnixSeconds(input: string): bigint {
  // Accept: "YYYY/MM/DD-HH:mm:ss" or any Date-parsable string.
  const raw = (input || "").trim();
  const normalized = raw.includes("/") && raw.includes("-") ? raw.replace("-", " ") : raw;
  // Always treat inputs as UTC (timezone +0), not local.
  // Primary format: YYYY/MM/DD HH:mm:ss (also supports YYYY/MM/DD-HH:mm:ss).
  const m = normalized.match(
    /^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})$/
  );
  let ms: number;
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const hh = Number(m[4]);
    const mm = Number(m[5]);
    const ss = Number(m[6]);
    ms = Date.UTC(y, mo - 1, d, hh, mm, ss);
  } else {
    // Fallback: if no explicit timezone is provided, append 'Z' to force UTC.
    const hasTZ = /([zZ]|[+-]\d{2}:?\d{2})$/.test(normalized);
    const s = hasTZ ? normalized : `${normalized}Z`;
    ms = Date.parse(s);
  }
  if (!Number.isFinite(ms)) throw new Error(`Invalid datetime: ${input}`);
  return BigInt(Math.floor(ms / 1000));
}

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

export default function BatchBuilderPage() {
  const {
    timelockAddr,
    smgContractAddr,
    gpkContractAddr,
    storemanGroupRegisterStartDefaultParams,
    setPeriodDefaultParams,
    setGpkCfgDefaultParams,
  } = useActiveNetworkConfig();
  const { isConnected } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();

  const [grpPrex, setGrpPrex] = useState("Aries");
  const [gid, setGid] = useState("Aries_065");
  const [pgid, setPgid] = useState("Aries_064");

  const [regEnd, setRegEnd] = useState("2026/04/5-04:00:00");
  const [openGroupTime, setOpenGroupTime] = useState("2026/04/4-04:00:00");
  const [gpkEnd, setGpkEnd] = useState("2026/04/8-03:00:00");
  const [wkStart, setWkStart] = useState("2026/04/9-04:00:00");
  const [wkEnd, setWkEnd] = useState("2026/05/9-04:00:00");

  const [memberCountDesign, setMemberCountDesign] = useState("");
  const [threshold, setThreshold] = useState("");
  const [chain1, setChain1] = useState("");
  const [chain2, setChain2] = useState("");
  const [curve1, setCurve1] = useState("");
  const [curve2, setCurve2] = useState("");
  const [minStakeIn, setMinStakeIn] = useState("");
  const [minDelegateIn, setMinDelegateIn] = useState("");
  const [minPartIn, setMinPartIn] = useState("");
  const [delegateFee, setDelegateFee] = useState("");

  const [wkAddrs, setWkAddrs] = useState("0x");
  const [senders, setSenders] = useState("0x");

  const [ployCommitPeriod, setPloyCommitPeriod] = useState("");
  const [defaultPeriod, setDefaultPeriod] = useState("");
  const [negotiatePeriod, setNegotiatePeriod] = useState("");

  const [curIndex, setCurIndex] = useState("");
  const [algoIndex, setAlgoIndex] = useState("");

  const [predecessor, setPredecessor] = useState("0x" + "0".repeat(64));
  const [salt, setSalt] = useState("0x" + "0".repeat(64));
  const [delay, setDelay] = useState("0");

  useEffect(() => {
    const smg = storemanGroupRegisterStartDefaultParams;
    if (smg) {
      if (Array.isArray(smg.wkAddrs) && smg.wkAddrs.length > 0 && (wkAddrs === "0x" || wkAddrs.trim() === "")) {
        setWkAddrs(smg.wkAddrs.join("\n"));
      }
      if (
        Array.isArray(smg.senders) &&
        smg.senders.length > 0 &&
        (senders === "0x" || senders.trim() === "")
      ) {
        setSenders(smg.senders.join("\n"));
      }

      if (!memberCountDesign && smg.memberCountDesign) setMemberCountDesign(smg.memberCountDesign);
      if (!threshold && smg.threshold) setThreshold(smg.threshold);
      if (!chain1 && smg.chain1) setChain1(smg.chain1);
      if (!chain2 && smg.chain2) setChain2(smg.chain2);
      if (!curve1 && smg.curve1) setCurve1(smg.curve1);
      if (!curve2 && smg.curve2) setCurve2(smg.curve2);
      if (!minStakeIn && smg.minStakeIn) setMinStakeIn(smg.minStakeIn);
      if (!minDelegateIn && smg.minDelegateIn) setMinDelegateIn(smg.minDelegateIn);
      if (!minPartIn && smg.minPartIn) setMinPartIn(smg.minPartIn);
      if (!delegateFee && smg.delegateFee) setDelegateFee(smg.delegateFee);
    }

    const sp = setPeriodDefaultParams;
    if (sp) {
      if (!ployCommitPeriod && sp.ployCommitPeriod) setPloyCommitPeriod(sp.ployCommitPeriod);
      if (!defaultPeriod && sp.defaultPeriod) setDefaultPeriod(sp.defaultPeriod);
      if (!negotiatePeriod && sp.negotiatePeriod) setNegotiatePeriod(sp.negotiatePeriod);
    }

    const sg = setGpkCfgDefaultParams;
    if (sg) {
      if (!curIndex && Array.isArray(sg.curIndex) && sg.curIndex.length > 0) setCurIndex(sg.curIndex.join("\n"));
      if (!algoIndex && Array.isArray(sg.algoIndex) && sg.algoIndex.length > 0) setAlgoIndex(sg.algoIndex.join("\n"));
    }
  }, [
    storemanGroupRegisterStartDefaultParams,
    setPeriodDefaultParams,
    setGpkCfgDefaultParams,
    wkAddrs,
    senders,
    memberCountDesign,
    threshold,
    chain1,
    chain2,
    curve1,
    curve2,
    minStakeIn,
    minDelegateIn,
    minPartIn,
    delegateFee,
    ployCommitPeriod,
    defaultPeriod,
    negotiatePeriod,
    curIndex,
    algoIndex,
  ]);

  const parsed = useMemo(() => {
    const errors: string[] = [];

    const groupIdRaw = (gid || "").trim();
    const preGroupIdRaw = (pgid || "").trim();

    const groupIdBytes32 = toBytes32FromAscii(groupIdRaw);
    const preGroupIdBytes32 = toBytes32FromAscii(preGroupIdRaw);

    let regEndTs: bigint = BigInt(0);
    let openGroupTs: bigint = BigInt(0);
    let gpkEndTs: bigint = BigInt(0);
    let wkStartTs: bigint = BigInt(0);
    let wkEndTs: bigint = BigInt(0);

    try {
      regEndTs = toUnixSeconds(regEnd);
      openGroupTs = toUnixSeconds(openGroupTime);
      gpkEndTs = toUnixSeconds(gpkEnd);
      wkStartTs = toUnixSeconds(wkStart);
      wkEndTs = toUnixSeconds(wkEnd);
    } catch (e: any) {
      errors.push(String(e?.message || e));
    }

    const registerDuration =
      regEndTs > openGroupTs && openGroupTs > BigInt(0) ? regEndTs - openGroupTs : BigInt(0);
    const totalTime = wkEndTs > wkStartTs ? wkEndTs - wkStartTs : BigInt(0);

    const nowTs = BigInt(Math.floor(Date.now() / 1000));
    const computedDelay = openGroupTs > nowTs ? openGroupTs - nowTs : BigInt(0);

    const wkList = wkAddrs.trim() === "0x" ? [] : parseLines(wkAddrs);
    const senderList = senders.trim() === "0x" ? [] : parseLines(senders);

    const smgArgs = {
      groupId: groupIdBytes32,
      preGroupId: preGroupIdBytes32,
      workTime: wkStartTs,
      totalTime,
      registerDuration,
      memberCountDesign: BigInt(memberCountDesign || "0"),
      threshold: BigInt(threshold || "0"),
      chain1: BigInt(chain1 || "0"),
      chain2: BigInt(chain2 || "0"),
      curve1: BigInt(curve1 || "0"),
      curve2: BigInt(curve2 || "0"),
      minStakeIn: BigInt(minStakeIn || "0"),
      minDelegateIn: BigInt(minDelegateIn || "0"),
      minPartIn: BigInt(minPartIn || "0"),
      delegateFee: BigInt(delegateFee || "0"),
    };

    const smgPayload = encodeFunctionData({
      abi: smgAbi,
      functionName: "storemanGroupRegisterStart",
      args: [smgArgs as any, wkList as any, senderList as any],
    });

    const setPeriodPayload = encodeFunctionData({
      abi: gpkAbi,
      functionName: "setPeriod",
      args: [
        groupIdBytes32 as any,
        Number(ployCommitPeriod || "0"),
        Number(defaultPeriod || "0"),
        Number(negotiatePeriod || "0"),
      ] as any,
    });

    const cur = parseLines(curIndex).map((x) => BigInt(x));
    const algo = parseLines(algoIndex).map((x) => BigInt(x));

    const setGpkCfgPayload = encodeFunctionData({
      abi: gpkAbi,
      functionName: "setGpkCfg",
      args: [groupIdBytes32 as any, cur as any, algo as any],
    });

    const targets = [smgContractAddr, gpkContractAddr, gpkContractAddr].filter(Boolean) as string[];
    const values = [BigInt(0), BigInt(0), BigInt(0)];
    const payloads = [smgPayload, setPeriodPayload, setGpkCfgPayload];

    const summary = {
      grpPrex: (grpPrex || "").trim(),
      groupIdRaw,
      preGroupIdRaw,
      groupIdBytes32,
      preGroupIdBytes32,
      regEndTs: regEndTs.toString(),
      openGroupTs: openGroupTs.toString(),
      gpkEndTs: gpkEndTs.toString(),
      wkStartTs: wkStartTs.toString(),
      wkEndTs: wkEndTs.toString(),
      registerDuration: registerDuration.toString(),
      totalTime: totalTime.toString(),
      delay: computedDelay.toString(),
      wkCount: wkList.length,
      senderCount: senderList.length,
    };

    return {
      errors,
      summary,
      delay: computedDelay,
      targets,
      values,
      payloads,
    };
  }, [
    grpPrex,
    gid,
    pgid,
    regEnd,
    openGroupTime,
    gpkEnd,
    wkStart,
    wkEnd,
    wkAddrs,
    senders,
    memberCountDesign,
    threshold,
    chain1,
    chain2,
    curve1,
    curve2,
    minStakeIn,
    minDelegateIn,
    minPartIn,
    delegateFee,
    ployCommitPeriod,
    defaultPeriod,
    negotiatePeriod,
    curIndex,
    algoIndex,
    smgContractAddr,
    gpkContractAddr,
  ]);

  const disabled =
    !isConnected ||
    !timelockAddr ||
    timelockAddr === "" ||
    !smgContractAddr ||
    !gpkContractAddr ||
    isPending;

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-xl font-semibold">BATCH BUILDER</div>
          <div className="text-sm text-white/60 mt-1">Build scheduleBatch payloads for SMG + GPK</div>
        </div>
      </div>

      <RoleGate role={PROPOSER_ROLE}>
        {({ allowed, reason }) => (
          <div className="space-y-6">
            {!allowed ? (
              <div className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
                {reason ?? "Missing PROPOSER role"}
              </div>
            ) : null}

            <Card title="Inputs">
              <div className="grid grid-cols-1 gap-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>grpPrex</Label>
                    <Input value={grpPrex} onChange={(e) => setGrpPrex(e.target.value)} />
                  </div>
                  <div>
                    <Label>gid (ascii, will be bytes32)</Label>
                    <Input value={gid} onChange={(e) => setGid(e.target.value)} />
                  </div>
                  <div>
                    <Label>pgid (ascii, will be bytes32)</Label>
                    <Input value={pgid} onChange={(e) => setPgid(e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>openGroupTime (YYYY/MM/DD-HH:mm:ss, UTC)</Label>
                    <Input value={openGroupTime} onChange={(e) => setOpenGroupTime(e.target.value)} />
                  </div>
                  <div>
                    <Label>regEnd (YYYY/MM/DD-HH:mm:ss)</Label>
                    <Input value={regEnd} onChange={(e) => setRegEnd(e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>gpkEnd (YYYY/MM/DD-HH:mm:ss)</Label>
                    <Input value={gpkEnd} onChange={(e) => setGpkEnd(e.target.value)} />
                  </div>
                  <div />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>wkStart (YYYY/MM/DD-HH:mm:ss)</Label>
                    <Input value={wkStart} onChange={(e) => setWkStart(e.target.value)} />
                  </div>
                  <div>
                    <Label>wkEnd (YYYY/MM/DD-HH:mm:ss)</Label>
                    <Input value={wkEnd} onChange={(e) => setWkEnd(e.target.value)} />
                  </div>
                </div>

                <div>
                  <Label>wkAddrs (one address per line, or 0x for empty)</Label>
                  <Textarea value={wkAddrs} onChange={(e) => setWkAddrs(e.target.value)} />
                </div>

                <div>
                  <Label>senders (one address per line, or 0x for empty)</Label>
                  <Textarea value={senders} onChange={(e) => setSenders(e.target.value)} />
                </div>
              </div>
            </Card>

            <Card title="storemanGroupRegisterStart struct (SMG)">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>memberCountDesign</Label>
                  <Input value={memberCountDesign} onChange={(e) => setMemberCountDesign(e.target.value)} />
                </div>
                <div>
                  <Label>threshold</Label>
                  <Input value={threshold} onChange={(e) => setThreshold(e.target.value)} />
                </div>
                <div>
                  <Label>chain1</Label>
                  <Input value={chain1} onChange={(e) => setChain1(e.target.value)} />
                </div>
                <div>
                  <Label>chain2</Label>
                  <Input value={chain2} onChange={(e) => setChain2(e.target.value)} />
                </div>
                <div>
                  <Label>curve1</Label>
                  <Input value={curve1} onChange={(e) => setCurve1(e.target.value)} />
                </div>
                <div>
                  <Label>curve2</Label>
                  <Input value={curve2} onChange={(e) => setCurve2(e.target.value)} />
                </div>
                <div>
                  <Label>minStakeIn</Label>
                  <Input value={minStakeIn} onChange={(e) => setMinStakeIn(e.target.value)} />
                </div>
                <div>
                  <Label>minDelegateIn</Label>
                  <Input value={minDelegateIn} onChange={(e) => setMinDelegateIn(e.target.value)} />
                </div>
                <div>
                  <Label>minPartIn</Label>
                  <Input value={minPartIn} onChange={(e) => setMinPartIn(e.target.value)} />
                </div>
                <div>
                  <Label>delegateFee</Label>
                  <Input value={delegateFee} onChange={(e) => setDelegateFee(e.target.value)} />
                </div>
              </div>
            </Card>

            <Card title="GPK.setPeriod">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>ployCommitPeriod (uint32)</Label>
                  <Input value={ployCommitPeriod} onChange={(e) => setPloyCommitPeriod(e.target.value)} />
                </div>
                <div>
                  <Label>defaultPeriod (uint32)</Label>
                  <Input value={defaultPeriod} onChange={(e) => setDefaultPeriod(e.target.value)} />
                </div>
                <div>
                  <Label>negotiatePeriod (uint32)</Label>
                  <Input value={negotiatePeriod} onChange={(e) => setNegotiatePeriod(e.target.value)} />
                </div>
              </div>
            </Card>

            <Card title="GPK.setGpkCfg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>curIndex (uint256[], one per line)</Label>
                  <Textarea value={curIndex} onChange={(e) => setCurIndex(e.target.value)} />
                </div>
                <div>
                  <Label>algoIndex (uint256[], one per line)</Label>
                  <Textarea value={algoIndex} onChange={(e) => setAlgoIndex(e.target.value)} />
                </div>
              </div>
            </Card>

            <Card title="Timelock params">
              <div className="grid grid-cols-1 gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>predecessor (bytes32)</Label>
                    <Input value={predecessor} onChange={(e) => setPredecessor(e.target.value)} />
                  </div>
                  <div>
                    <Label>salt (bytes32)</Label>
                    <Input value={salt} onChange={(e) => setSalt(e.target.value)} />
                  </div>
                </div>

                <div>
                  <Label>delay (seconds)</Label>
                  <Input value={parsed.delay.toString()} disabled />
                </div>
              </div>
            </Card>

            <Card title="Generated scheduleBatch">
              <div className="grid grid-cols-1 gap-4">
                {parsed.errors.length ? (
                  <div className="rounded-lg border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
                    {parsed.errors.join("\n")}
                  </div>
                ) : null}

                <div>
                  <Label>summary</Label>
                  <pre className="text-xs whitespace-pre-wrap rounded-md border border-white/10 bg-black/20 p-3">
                    {JSON.stringify(parsed.summary, null, 2)}
                  </pre>
                </div>

                <div>
                  <Label>targets</Label>
                  <pre className="text-xs whitespace-pre-wrap rounded-md border border-white/10 bg-black/20 p-3">
                    {JSON.stringify(parsed.targets, null, 2)}
                  </pre>
                </div>

                <div>
                  <Label>values</Label>
                  <pre className="text-xs whitespace-pre-wrap rounded-md border border-white/10 bg-black/20 p-3">
                    {JSON.stringify(parsed.values.map((x) => x.toString()), null, 2)}
                  </pre>
                </div>

                <div>
                  <Label>payloads</Label>
                  <pre className="text-xs whitespace-pre-wrap rounded-md border border-white/10 bg-black/20 p-3">
                    {JSON.stringify(parsed.payloads, null, 2)}
                  </pre>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    disabled={!allowed || disabled || parsed.errors.length > 0 || parsed.targets.length !== 3}
                    onClick={async () => {
                      if (!timelockAddr || timelockAddr === "") return;

                      const targets = parsed.targets as any;
                      const values = parsed.values as any;
                      const payloads = parsed.payloads as any;

                      await writeContractAsync({
                        abi: timelockAbi,
                        address: timelockAddr as `0x${string}`,
                        functionName: "scheduleBatch",
                        args: [targets, values, payloads, predecessor as any, salt as any, parsed.delay],
                      });
                    }}
                  >
                    {isPending ? "Submitting..." : "Schedule"}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </RoleGate>
    </AppShell>
  );
}
