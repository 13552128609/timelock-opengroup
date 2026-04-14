const { ethers } = require("ethers");
const fs = require("node:fs");
const path = require("node:path");

// 1. 配置基础信息
function readRepoConfig() {
  const configPath = path.resolve(__dirname, "..", "cfg", "config.json");
  const raw = fs.readFileSync(configPath, "utf8");
  return JSON.parse(raw);
}

function parseArgs(argv) {
  const out = {
    network: "mainnet",
    grpPrex: "",
    beforeBlock: 518400,
    positional: [],
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--network") {
      out.network = argv[i + 1] || "";
      i++;
      continue;
    }
    if (a === "--grpPrex") {
      out.grpPrex = argv[i + 1] || "";
      i++;
      continue;
    }
    if (a === "--beforeBlock") {
      const raw = argv[i + 1];
      const n = Number(raw);
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
        out.beforeBlock = NaN;
      } else {
        out.beforeBlock = n;
      }
      i++;
      continue;
    }
    out.positional.push(a);
  }
  return out;
}

function buildNetworkRuntime(network, grpPrex) {
  const cfg = readRepoConfig();
  const net = cfg?.[network];
  if (!net) {
    throw new Error(`Unknown network: ${network}. Expected testnet|mainnet`);
  }
  if (!net.url) {
    throw new Error(`Missing ${network}.url in cfg/config.json`);
  }

  if (!grpPrex) {
    throw new Error(`Missing --grpPrex. Expected one of cfg.${network}.groups keys`);
  }
  const group = net?.groups?.[grpPrex];
  if (!group) {
    throw new Error(`Missing cfg.${network}.groups.${grpPrex} in cfg/config.json`);
  }
  if (!group.gpkContractAddr) {
    throw new Error(`Missing ${network}.groups.${grpPrex}.gpkContractAddr in cfg/config.json`);
  }
  if (!group.smgContractAddr) {
    throw new Error(`Missing ${network}.groups.${grpPrex}.smgContractAddr in cfg/config.json`);
  }
  if (!group.timelockAddr) {
    throw new Error(`Missing ${network}.groups.${grpPrex}.timelockAddr in cfg/config.json`);
  }

  return {
    rpcUrl: net.url,
    contractAddress: {
      SMG: group.smgContractAddr,
      GPK: group.gpkContractAddr,
      TIMELOCK: group.timelockAddr,
    },
  };
}

const ABI = {
  "SMG": require("./abi/smg-abi.json"),
  "GPK": require("./abi/gpk-abi.json"),
  "TIMELOCK": require("./abi/timelock-abi.json"),
}

function jsonReplacer(_key, value) {
  if (typeof value === "bigint") {
    return value.toString();
  }
  return value;
}

function normalizeArgs(args) {
  if (!args) return args;

  // ethers v6 uses a Result-like object which may contain both numeric and named keys
  const out = {};
  for (const key of Object.keys(args)) {
    out[key] = args[key];
  }
  return out;
}

function formatArgsWithNames(event) {
  const raw = normalizeArgs(event?.args);
  const out = {
    raw,
    named: {},
    time: {},
  };

  const inputs = event?.fragment?.inputs || [];
  for (let i = 0; i < inputs.length; i++) {
    const name = inputs[i]?.name || String(i);
    const v = event.args?.[i];
    out.named[name] = v;

    const lower = String(name).toLowerCase();
    const isTimeLike =
      lower.includes("time") ||
      lower.includes("timestamp") ||
      lower.includes("delay") ||
      lower.includes("duration");
    if (isTimeLike && typeof v === "bigint") {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0) {
        out.time[name] = {
          seconds: v,
          iso: new Date(n * 1000).toISOString(),
        };
      } else {
        out.time[name] = { seconds: v };
      }
    }
  }

  return out;
}

function printUsageAndExit() {
  console.log(
    "Usage: node bin/getEvent.js [--network testnet|mainnet (default mainnet)] --grpPrex <grpPrex> [--beforeBlock N (default 518400)] <gpk|smg|timelock> <eventName>"
  );
  console.log(
    "Example: node bin/getEvent.js --network testnet --grpPrex Aries --beforeBlock 10000 smg StoremanGroupRegisterStartEvent"
  );
  process.exit(1);
}

async function main() {
  const { network, grpPrex, beforeBlock, positional } = parseArgs(process.argv.slice(2));
  const rawContractInput = positional[0];
  const contractArg = (positional[0] || "").toUpperCase();
  const eventName = positional[1];

  let runtime;
  try {
    runtime = buildNetworkRuntime(network, grpPrex);
  } catch (e) {
    console.error(String(e?.message || e));
    printUsageAndExit();
  }

  if (!grpPrex || !contractArg || !eventName) {
    printUsageAndExit();
  }

  if (!Number.isFinite(beforeBlock)) {
    console.error("Invalid --beforeBlock. Expected a non-negative integer.");
    printUsageAndExit();
  }

  const RPC_URL = runtime.rpcUrl;
  const CONTRACT_ADDRESS = runtime.contractAddress;

  if (!CONTRACT_ADDRESS[contractArg]) {
    console.error("Unknown contract:", rawContractInput);
    printUsageAndExit();
  }

  if (!ABI[contractArg]) {
    console.error("ABI not found for contract:", rawContractInput);
    process.exit(1);
  }

  // 连接到以太坊网络
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  
  // 实例化合约
  const contractAddress = CONTRACT_ADDRESS[contractArg];
  const contractAbi = ABI[contractArg];
  const contract = new ethers.Contract(contractAddress, contractAbi, provider);

  console.log("正在连接合约，准备获取事件数据...");
  console.log("contract:", contractArg, contractAddress);
  console.log("eventName:", eventName);

  // --- 场景 A: 获取历史事件 ---
  async function getPastEvents() {
    console.log(`读取最近 ${beforeBlock} 个区块内的历史事件...`);
    const currentBlock = await provider.getBlockNumber();
    console.log(`currentBlock: ${currentBlock}`);
    
    // 查询从 currentBlock - beforeBlock 到现在的事件
    const fromBlock = Math.max(0, currentBlock - beforeBlock);
    const toBlock = currentBlock;
    console.log(`fromBlock: ${fromBlock}, toBlock: ${toBlock}`);
    const events = await contract.queryFilter(eventName, fromBlock, toBlock);
    console.log(`events.length: ${events.length}`);
    
    events.forEach((event) => {
      // 解析后的数据在 event.args 中
      const args = formatArgsWithNames(event);
      console.log(`
        [历史事件]
        eventName: ${eventName}
        区块高度: ${event.blockNumber}
        txHash: ${event.transactionHash}
        args: ${args ? JSON.stringify(args, jsonReplacer, 2) : "null"}
      `);
    });
  }
  // 执行
  await getPastEvents();
  //listenToNewEvents();
}

main().catch((error) => {
  console.error("发生错误:", error);
});
 
//node bin/getEvent.js --network testnet --beforeBlock 10000 smg StoremanGroupRegisterStartEvent
//node bin/getEvent.js --network testnet --beforeBlock 5000 timelock CallExecuted
//node bin/getEvent.js smg StoremanGroupRegisterStartEvent