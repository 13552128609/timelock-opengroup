export type StoremanGroupRegisterStartDefaultParams = {
  wkAddrs: string[];
  senders: string[];
  memberCountDesign: string;
  threshold: string;
  chain1: string;
  chain2: string;
  curve1: string;
  curve2: string;
  minStakeIn: string;
  minDelegateIn: string;
  minPartIn: string;
  delegateFee: string;
};

export type SetPeriodDefaultParams = {
  ployCommitPeriod: string;
  defaultPeriod: string;
  negotiatePeriod: string;
};

export type SetGpkCfgDefaultParams = {
  curIndex: string[];
  algoIndex: string[];
};

export type GroupConfig = {
  gpkContractAddr: string;
  smgContractAddr: string;
  timelockAddr: string;
  cron?: string;
  storemanGroupRegisterStartDefaultParams?: StoremanGroupRegisterStartDefaultParams;
  setPeriodDefaultParams?: SetPeriodDefaultParams;
  setGpkCfgDefaultParams?: SetGpkCfgDefaultParams;
};

export type NetworkConfig = {
  url: string;
  cron?: string;
  groups: Record<string, GroupConfig>;
};

export type RepoConfig = {
  testnet: NetworkConfig;
  mainnet: NetworkConfig;
};
