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
    scAddr: "",
    indexFilters: [],
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
    if (a === "--scAddr") {
      out.scAddr = argv[i + 1] || "";
      i++;
      continue;
    }
    if (a === "--index") {
      out.indexFilters.push({ key: argv[i + 1] || "", value: argv[i + 2] || "" });
      i += 2;
      continue;
    }
    out.positional.push(a);
  }
  return out;
}

function isHexAddress(s) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(s || "").trim());
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

  if (!net.gpkContractAddr) {
    throw new Error(`Missing ${network}.gpkContractAddr in cfg/config.json`);
  }
  if (!net.smgContractAddr) {
    throw new Error(`Missing ${network}.smgContractAddr in cfg/config.json`);
  }
  if (!net.timelockAddr) {
    throw new Error(`Missing ${network}.timelockAddr in cfg/config.json`);
  }  
  return {
    rpcUrl: net.url,
    contractAddress: {
      SMG: net.smgContractAddr,
      GPK: net.gpkContractAddr,
      TIMELOCK: net.timelockAddr,
      STAKER: net.stakerAddr || net.stakerContractAddr || "",
      NON: net.nonAddr || net.nonContractAddr || "",
    },
  };
}

const ABI = {
  "SMG": require("./abi/smg-abi.json"),
  "GPK": require("./abi/gpk-abi.json"),
  "TIMELOCK": require("./abi/timelock-abi.json"),
  "STAKER": require("./abi/staker-abi.json"),
  "NON": require("./abi/non-abi.json"),
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

function normalizeIndexValue(value, type) {
  if (/^u?int/.test(type)) {
    return BigInt(value);
  }
  if (type === "bool") {
    return String(value).toLowerCase() === "true" || value === "1";
  }
  return value;
}

function buildEventFilter(contract, contractAddress, eventName, indexFilters) {
  if (!indexFilters.length) {
    return eventName;
  }

  const fragment = contract.interface.getEvent(eventName);
  const values = new Array(fragment.inputs.length).fill(null);
  for (const item of indexFilters) {
    const numericIndex = Number(item.key);
    const inputIndex = Number.isInteger(numericIndex)
      ? numericIndex
      : fragment.inputs.findIndex((input) => input.name === item.key);
    const input = fragment.inputs[inputIndex];
    if (!input) {
      throw new Error(`Invalid --index key: ${item.key}`);
    }
    if (!input.indexed) {
      throw new Error(`Event parameter is not indexed: ${item.key}`);
    }
    values[inputIndex] = normalizeIndexValue(item.value, input.type);
  }

  return {
    address: contractAddress,
    topics: contract.interface.encodeFilterTopics(fragment, values),
  };
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
    "Usage: node bin/getEvent.js [--network testnet|mainnet (default mainnet)] [--beforeBlock N (default 518400)] [--scAddr 0x...] [--index <name|index> <value>] <gpk|smg|timelock|staker|non> <eventName>"
  );
  console.log(
    "Example: node bin/getEvent.js --network testnet --beforeBlock 10000 smg StoremanGroupRegisterStartEvent"
  );
  console.log(
    "Example (override address): node bin/getEvent.js --network mainnet --beforeBlock 10000 --scAddr 0x... smg StoremanGroupRegisterStartEvent"
  );
  process.exit(1);
}

async function main() {
  const { network, grpPrex, beforeBlock, scAddr, indexFilters, positional } = parseArgs(process.argv.slice(2));
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

  if (!contractArg || !eventName) {
    printUsageAndExit();
  }

  if (!Number.isFinite(beforeBlock)) {
    console.error("Invalid --beforeBlock. Expected a non-negative integer.");
    printUsageAndExit();
  }

  const RPC_URL = runtime.rpcUrl;
  const CONTRACT_ADDRESS = runtime.contractAddress;

  if (!ABI[contractArg]) {
    console.error("ABI not found for contract:", rawContractInput);
    process.exit(1);
  }

  if (!CONTRACT_ADDRESS[contractArg] && (!scAddr || scAddr.trim() === "")) {
    console.error("Missing contract address:", rawContractInput);
    printUsageAndExit();
  }

  // 连接到以太坊网络
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  
  // 实例化合约
  const contractAddress = scAddr && scAddr.trim() !== "" ? scAddr.trim() : CONTRACT_ADDRESS[contractArg];
  if (!isHexAddress(contractAddress)) {
    console.error("Invalid contract address:", contractAddress);
    process.exit(1);
  }
  const contractAbi = ABI[contractArg];
  const contract = new ethers.Contract(contractAddress, contractAbi, provider);

  console.log("正在连接合约，准备获取事件数据...");
  console.log("contract:", contractArg, contractAddress);
  console.log("eventName:", eventName);
  if (indexFilters.length) {
    console.log("indexFilters:", indexFilters);
  }

  // --- 场景 A: 获取历史事件 ---
  async function getPastEvents() {
    console.log(`读取最近 ${beforeBlock} 个区块内的历史事件...`);
    const currentBlock = await provider.getBlockNumber();
    console.log(`currentBlock: ${currentBlock}`);
    
    // 查询从 currentBlock - beforeBlock 到现在的事件
    const fromBlock = Math.max(0, currentBlock - beforeBlock);
    const toBlock = currentBlock;
    console.log(`fromBlock: ${fromBlock}, toBlock: ${toBlock}`);
    const eventFilter = buildEventFilter(contract, contractAddress, eventName, indexFilters);
    let events;
    if (indexFilters.length) {
      const logs = await provider.getLogs({
        ...eventFilter,
        fromBlock,
        toBlock,
      });
      events = logs.map((log) => ({
        ...contract.interface.parseLog(log),
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
      }));
    } else {
      events = await contract.queryFilter(eventFilter, fromBlock, toBlock);
    }
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

//node bin/getEvent.js --network testnet --beforeBlock 518400 timelock CallExecuted
//node bin/getEvent.js --network testnet --beforeBlock 518400 smg StoremanGroupRegisterStartEvent

// node bin/getEvent.js --network mainnet --beforeBlock 518400 smg StoremanGroupRegisterStartEvent
// node bin/getEvent.js --network mainnet --beforeBlock 518400 gpk setGpkCfgEvent

// node bin/getEvent.js --network testnet --beforeBlock 518400 --scAddr 0xaA5A0f7F99FA841F410aafD97E8C435c75c22821 smg StoremanGroupDismissedEvent