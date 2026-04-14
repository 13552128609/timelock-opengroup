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

        setState({ open: true, stage: "error", title, hash, message: "Transaction reverted" });
        return { hash, status: "reverted" };
      } catch (e: any) {
        const message = String(e?.shortMessage || e?.message || e);
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
          <div className="w-full max-w-lg rounded-xl border border-white/10 bg-[#0B0F1A]">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-3">
              <div className="text-sm font-medium">{state.title}</div>
              <button
                className="text-xs text-white/60 hover:text-white"
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
                  <span className="text-white/70">pending</span>
                ) : state.stage === "success" ? (
                  <span className="text-emerald-200">success</span>
                ) : (
                  <span className="text-red-200">failed</span>
                )}
              </div>

              {state.hash ? <div className="font-mono text-xs break-all">hash: {state.hash}</div> : null}

              {state.message ? (
                <div className="rounded-lg border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200 whitespace-pre-wrap">
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
