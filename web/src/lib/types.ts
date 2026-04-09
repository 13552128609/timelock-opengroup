export type RepoConfig = {
  testnet: {
    url: string;
    gpkContractAddr: string;
    smgContractAddr: string;
    timelockAddr: string;
    storemanGroupRegisterStartDefaultParams: {
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
    setPeriodDefaultParams: {
      ployCommitPeriod: string;
      defaultPeriod: string;
      negotiatePeriod: string;
    };
    setGpkCfgDefaultParams: {
      curIndex: string[];
      algoIndex: string[];
    };
  };
  mainnet: {
    url: string;
    gpkContractAddr: string;
    smgContractAddr: string;
    timelockAddr: string;
    storemanGroupRegisterStartDefaultParams: {
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
    setPeriodDefaultParams: {
      ployCommitPeriod: string;
      defaultPeriod: string;
      negotiatePeriod: string;
    };
    setGpkCfgDefaultParams: {
      curIndex: string[];
      algoIndex: string[];
    };
  };
};
