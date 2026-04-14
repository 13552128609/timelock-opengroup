"use client";

import { useChainId } from "wagmi";
import { useRepoConfig } from "@/lib/useRepoConfig";

export function useActiveNetworkConfig() {
  const chainId = useChainId();
  const { data, isLoading, error } = useRepoConfig();

  const section = chainId === 888 ? "mainnet" : chainId === 999 ? "testnet" : null;

  const grpPrex = process.env.NEXT_PUBLIC_GRP_PREX ?? "";

  const group = section && data && grpPrex ? data[section]?.groups?.[grpPrex] : null;

  const rpcUrl = section && data ? data[section].url : null;
  const smgContractAddr = group ? group.smgContractAddr : null;
  const gpkContractAddr = group ? group.gpkContractAddr : null;
  const timelockAddr = group ? group.timelockAddr : null;
  const storemanGroupRegisterStartDefaultParams = group ? group.storemanGroupRegisterStartDefaultParams ?? null : null;
  const setPeriodDefaultParams = group ? group.setPeriodDefaultParams ?? null : null;
  const setGpkCfgDefaultParams = group ? group.setGpkCfgDefaultParams ?? null : null;

  return {
    chainId,
    section,
    grpPrex,
    rpcUrl,
    smgContractAddr,
    gpkContractAddr,
    timelockAddr,
    storemanGroupRegisterStartDefaultParams,
    setPeriodDefaultParams,
    setGpkCfgDefaultParams,
    isLoading,
    error,
  };
}
