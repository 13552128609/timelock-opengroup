"use client";

import { useQuery } from "@tanstack/react-query";
import type { RepoConfig } from "@/lib/types";

export function useRepoConfig() {
  return useQuery({
    queryKey: ["repo-config"],
    queryFn: async () => {
      const res = await fetch("/api/config", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load config: ${res.status}`);
      return (await res.json()) as RepoConfig;
    },
    staleTime: 10_000,
  });
}
