"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { usePublicClient } from "wagmi";

type TxState =
  | {
      open: false;
    }
  | {
      open: true;
      stage: "pending" | "success" | "error";
      title: string;
      hash?: `0x${string}`;
      message?: string;
    };

type Ctx = {
  sendTx: <T extends `0x${string}`>(
    fn: () => Promise<T>,
    title: string
  ) => Promise<{ hash: T; status: "success" | "reverted" }>;
};

const TxFeedbackContext = createContext<Ctx | null>(null);

function extractErrorDetails(e: any): string {
  if (!e) return "";
  const parts: string[] = [];

  const push = (s: unknown) => {
    const t = typeof s === "string" ? s.trim() : "";
    if (t) parts.push(t);
  };

  push(e.shortMessage);
  push(e.message);
  push(e.details);
  push(e.metaMessages ? String(e.metaMessages) : "");
  push(e.cause?.shortMessage);
  push(e.cause?.message);
  push(e.cause?.details);

  const unique = Array.from(new Set(parts));
  return unique.join("\n");
}

function extractRevertReason(e: any): string {
  const candidates: string[] = [];
  const push = (s: unknown) => {
    if (typeof s !== "string") return;
    const t = s.trim();
    if (t) candidates.push(t);
  };

  push(e?.shortMessage);
  push(e?.details);
  push(e?.message);
  push(e?.cause?.shortMessage);
  push(e?.cause?.details);
  push(e?.cause?.message);

  for (const raw of candidates) {
    const first = raw.split("\n")[0]?.trim() ?? "";

    const m1 = first.match(/Execution reverted with reason:\s*(.+)$/i);
    if (m1?.[1]) return m1[1].trim();

    const m2 = first.match(/execution reverted(?::\s*(.+))?$/i);
    if (m2) return (m2[1] ? m2[1].trim() : "execution reverted");

    if (/revert/i.test(first) && first.length <= 200) return first;
  }

  const fallback = extractErrorDetails(e).split("\n")[0]?.trim() ?? "";
  return fallback;
}

export function TxFeedbackProvider({ children }: { children: React.ReactNode }) {
  const publicClient = usePublicClient();
  const [state, setState] = useState<TxState>({ open: false });

  const close = useCallback(() => setState({ open: false }), []);

  const sendTx = useCallback<Ctx["sendTx"]>(
    async (fn, title) => {
      if (!publicClient) throw new Error("Missing public client");

      setState({ open: true, stage: "pending", title });

      try {
        const hash = await fn();
        setState({ open: true, stage: "pending", title, hash });

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        const status = receipt.status;

        if (status === "success") {
          setState({ open: true, stage: "success", title, hash });
          return { hash, status: "success" };
        }

        let reason = "";
        try {
          const tx = await publicClient.getTransaction({ hash });
          if (!tx.to) throw new Error("Missing transaction 'to' address");
          await publicClient.call({
            to: tx.to,
            data: tx.input,
            value: tx.value,
            account: tx.from,
            blockNumber: receipt.blockNumber,
          });
        } catch (e: any) {
          reason = extractRevertReason(e);
        }

        setState({
          open: true,
          stage: "error",
          title,
          hash,
          message: reason ? `Transaction reverted\nreason: ${reason}` : "Transaction reverted",
        });
        return { hash, status: "reverted" };
      } catch (e: any) {
        const reason = extractRevertReason(e);
        const message = reason ? `reason: ${reason}` : String(e?.shortMessage || e?.message || e);
        setState({ open: true, stage: "error", title, message });
        throw e;
      }
    },
    [publicClient]
  );

  const value = useMemo(() => ({ sendTx }), [sendTx]);

  return (
    <TxFeedbackContext.Provider value={value}>
      {children}
      {state.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--background)]">
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between gap-3">
              <div className="text-sm font-medium">{state.title}</div>
              <button
                className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
                onClick={close}
                type="button"
              >
                Close
              </button>
            </div>
            <div className="p-5 grid grid-cols-1 gap-3 text-sm">
              <div>
                status:{" "}
                {state.stage === "pending" ? (
                  <span className="text-[var(--muted)]">pending</span>
                ) : state.stage === "success" ? (
                  <span className="text-[var(--success-text)]">success</span>
                ) : (
                  <span className="text-[var(--error-text)]">failed</span>
                )}
              </div>

              {state.hash ? <div className="font-mono text-xs break-all">hash: {state.hash}</div> : null}

              {state.message ? (
                <div className="rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error-text)] whitespace-pre-wrap">
                  {state.message}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </TxFeedbackContext.Provider>
  );
}

export function useTxFeedback() {
  const ctx = useContext(TxFeedbackContext);
  if (!ctx) throw new Error("useTxFeedback must be used within TxFeedbackProvider");
  return ctx;
}
