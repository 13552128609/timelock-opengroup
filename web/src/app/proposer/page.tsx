"use client";

import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";

export default function ProposerPage() {
  return (
    <AppShell>
      <div className="mb-6">
        <div className="text-xl font-semibold">PROPOSER</div>
        <div className="text-sm text-[var(--muted)] mt-1">This page has been removed.</div>
      </div>

      <Card title="Removed">
        <div className="text-sm text-[var(--muted)]">
          Use <span className="text-[var(--foreground)]">BATCH BUILDER</span> to prepare scheduleBatch calldata, and use your workflow for
          submitting proposals.
        </div>
      </Card>
    </AppShell>
  );
}
