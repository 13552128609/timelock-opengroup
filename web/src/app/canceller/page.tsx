"use client";

import { useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";
import { Button, Input, Label } from "@/components/Form";
import { RoleGate } from "@/components/RoleGate";
import { useActiveNetworkConfig } from "@/lib/networkConfig";
import { CANCELLER_ROLE, timelockAbi } from "@/lib/timelock";

export default function CancellerPage() {
  const { timelockAddr } = useActiveNetworkConfig();
  const { isConnected } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();

  const [id, setId] = useState("0x" + "0".repeat(64));

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

            <Card title="cancel(id)">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label>operation id (bytes32)</Label>
                  <Input value={id} onChange={(e) => setId(e.target.value)} />
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    disabled={!allowed || !isConnected || !timelockAddr || timelockAddr === "" || isPending}
                    onClick={async () => {
                      if (!timelockAddr || timelockAddr === "") return;
                      await writeContractAsync({
                        abi: timelockAbi,
                        address: timelockAddr as `0x${string}`,
                        functionName: "cancel",
                        args: [id as any],
                      });
                    }}
                  >
                    {isPending ? "Submitting..." : "Cancel"}
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
