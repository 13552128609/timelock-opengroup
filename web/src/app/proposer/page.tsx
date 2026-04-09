"use client";

import { useMemo, useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";
import { Button, Input, Label, Textarea, Toggle } from "@/components/Form";
import { RoleGate } from "@/components/RoleGate";
import { useActiveNetworkConfig } from "@/lib/networkConfig";
import { parseLines } from "@/lib/parse";
import { PROPOSER_ROLE, timelockAbi } from "@/lib/timelock";

export default function ProposerPage() {
  const { timelockAddr } = useActiveNetworkConfig();
  const { isConnected } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();

  const [isBatch, setIsBatch] = useState(false);

  const [target, setTarget] = useState("0x");
  const [value, setValue] = useState("0");
  const [data, setData] = useState("0x");

  const [targets, setTargets] = useState("0x");
  const [values, setValues] = useState("0");
  const [payloads, setPayloads] = useState("0x");

  const [predecessor, setPredecessor] = useState("0x" + "0".repeat(64));
  const [salt, setSalt] = useState("0x" + "0".repeat(64));
  const [delay, setDelay] = useState("0");

  const parsed = useMemo(() => {
    if (!isBatch) return null;
    const t = parseLines(targets);
    const v = parseLines(values);
    const p = parseLines(payloads);
    return { t, v, p };
  }, [isBatch, targets, values, payloads]);

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-xl font-semibold">PROPOSER</div>
          <div className="text-sm text-white/60 mt-1">Schedule timelock operations (single or batch)</div>
        </div>
        <Toggle on={isBatch} setOn={setIsBatch} label={isBatch ? "Batch" : "Single"} />
      </div>

      <RoleGate role={PROPOSER_ROLE}>
        {({ allowed, reason }) => (
          <div className="space-y-6">
            {!allowed ? (
              <div className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
                {reason ?? "Missing PROPOSER role"}
              </div>
            ) : null}

            <Card title={isBatch ? "scheduleBatch" : "schedule"}>
              <div className="grid grid-cols-1 gap-4">
                {isBatch ? (
                  <>
                    <div>
                      <Label>targets (one address per line)</Label>
                      <Textarea value={targets} onChange={(e) => setTargets(e.target.value)} />
                    </div>
                    <div>
                      <Label>values (one uint per line)</Label>
                      <Textarea value={values} onChange={(e) => setValues(e.target.value)} />
                    </div>
                    <div>
                      <Label>payloads (one hex bytes per line)</Label>
                      <Textarea value={payloads} onChange={(e) => setPayloads(e.target.value)} />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <Label>target</Label>
                      <Input value={target} onChange={(e) => setTarget(e.target.value)} />
                    </div>
                    <div>
                      <Label>value (wei)</Label>
                      <Input value={value} onChange={(e) => setValue(e.target.value)} />
                    </div>
                    <div>
                      <Label>data (hex bytes)</Label>
                      <Textarea value={data} onChange={(e) => setData(e.target.value)} />
                    </div>
                  </>
                )}

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
                  <Input value={delay} onChange={(e) => setDelay(e.target.value)} />
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    disabled={!allowed || !isConnected || !timelockAddr || timelockAddr === "" || isPending}
                    onClick={async () => {
                      if (!timelockAddr || timelockAddr === "") return;

                      if (isBatch) {
                        const t = parsed?.t ?? [];
                        const v = (parsed?.v ?? []).map((x) => BigInt(x));
                        const p = parsed?.p ?? [];
                        await writeContractAsync({
                          abi: timelockAbi,
                          address: timelockAddr as `0x${string}`,
                          functionName: "scheduleBatch",
                          args: [t as any, v as any, p as any, predecessor as any, salt as any, BigInt(delay)],
                        });
                      } else {
                        await writeContractAsync({
                          abi: timelockAbi,
                          address: timelockAddr as `0x${string}`,
                          functionName: "schedule",
                          args: [target as any, BigInt(value), data as any, predecessor as any, salt as any, BigInt(delay)],
                        });
                      }
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
