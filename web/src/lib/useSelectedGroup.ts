"use client";

import { useEffect, useMemo, useState } from "react";
import type { RepoConfig } from "@/lib/types";

const STORAGE_KEY = "timelock:selected-group";
const CHANGE_EVENT = "timelock:selected-group-changed";

type SelectionState = {
  testnet?: string;
  mainnet?: string;
};

function readSelection(): SelectionState {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as SelectionState;
  } catch {
    return {};
  }
}

function writeSelection(next: SelectionState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));

  try {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  } catch {
    // ignore
  }
}

export function useSelectedGroup(section: "testnet" | "mainnet" | null, repoConfig?: RepoConfig) {
  const [selection, setSelection] = useState<SelectionState>(() => readSelection());
  const [needsSelection, setNeedsSelection] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const sync = () => setSelection(readSelection());

    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      sync();
    };

    const onChange = () => sync();

    window.addEventListener("storage", onStorage);
    window.addEventListener(CHANGE_EVENT, onChange as EventListener);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(CHANGE_EVENT, onChange as EventListener);
    };
  }, []);

  const availableGroups = useMemo(() => {
    if (!section || !repoConfig) return [] as string[];
    const groups = repoConfig[section]?.groups || {};
    return Object.keys(groups).sort((a, b) => a.localeCompare(b));
  }, [repoConfig, section]);

  const selected = useMemo(() => {
    if (!section) return "";
    return (selection[section] ?? "").trim();
  }, [section, selection]);

  useEffect(() => {
    if (!section) {
      setNeedsSelection(false);
      return;
    }

    if (!repoConfig) return;

    if (!selected && availableGroups.length === 1) {
      const only = availableGroups[0] ?? "";
      if (only) {
        const next = { ...selection, [section]: only };
        setSelection(next);
        writeSelection(next);
        setNeedsSelection(false);
        return;
      }
    }

    const valid = selected && availableGroups.includes(selected);
    if (valid) {
      setNeedsSelection(false);
      return;
    }

    if (selection[section]) {
      const next = { ...selection };
      delete next[section];
      setSelection(next);
      writeSelection(next);
    }

    setNeedsSelection(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, repoConfig, availableGroups.join("|"), selected]);

  const setSelected = (nextValue: string) => {
    const v = (nextValue || "").trim();
    if (!section) return;
    const next = { ...selection, [section]: v };
    setSelection(next);
    writeSelection(next);
    setNeedsSelection(false);
  };

  return {
    selected,
    setSelected,
    availableGroups,
    needsSelection,
  };
}
