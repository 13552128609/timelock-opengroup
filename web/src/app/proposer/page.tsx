"use client";

import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";

export default function ProposerPage() {
  return (
    <AppShell>
      <div className="mb-6">
        <div className="text-xl font-semibold">PROPOSER</div>
        <div className="text-sm text-white/60 mt-1">This page has been removed.</div>
      </div>

      <Card title="Removed">
        <div className="text-sm text-white/70">
          Use <span className="text-white">BATCH BUILDER</span> to prepare scheduleBatch calldata, and use your workflow for
          submitting proposals.
        </div>
      </Card>
    </AppShell>
  );
}
