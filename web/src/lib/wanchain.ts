import { defineChain } from "viem";

export const wanchainTestnet = (rpcUrl: string) =>
  defineChain({
    id: 999,
    name: "Wanchain Testnet",
    nativeCurrency: { name: "WAN", symbol: "WAN", decimals: 18 },
    rpcUrls: {
      default: { http: [rpcUrl] },
      public: { http: [rpcUrl] },
    },
    blockExplorers: {
      default: { name: "Wanchain Explorer", url: "https://testnet.wanscan.org" },
    },
  });

export const wanchainMainnet = (rpcUrl: string) =>
  defineChain({
    id: 888,
    name: "Wanchain",
    nativeCurrency: { name: "WAN", symbol: "WAN", decimals: 18 },
    rpcUrls: {
      default: { http: [rpcUrl] },
      public: { http: [rpcUrl] },
    },
    blockExplorers: {
      default: { name: "Wanchain Explorer", url: "https://wanscan.org" },
    },
  });
