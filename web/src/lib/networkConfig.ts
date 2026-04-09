"use client";

import { useChainId } from "wagmi";
import { useRepoConfig } from "@/lib/useRepoConfig";

export function useActiveNetworkConfig() {
  const chainId = useChainId();
  const { data, isLoading, error } = useRepoConfig();

  const section = chainId === 888 ? "mainnet" : chainId === 999 ? "testnet" : null;

  const rpcUrl = section && data ? data[section].url : null;
  const smgContractAddr = section && data ? data[section].smgContractAddr : null;
  const gpkContractAddr = section && data ? data[section].gpkContractAddr : null;
  const timelockAddr = section && data ? data[section].timelockAddr : null;
  const storemanGroupRegisterStartDefaultParams =
    section && data ? data[section].storemanGroupRegisterStartDefaultParams : null;
  const setPeriodDefaultParams = section && data ? data[section].setPeriodDefaultParams : null;
  const setGpkCfgDefaultParams = section && data ? data[section].setGpkCfgDefaultParams : null;

  return {
    chainId,
    section,
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
