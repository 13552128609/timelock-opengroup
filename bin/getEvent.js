const { ethers } = require("ethers");

// 1. 配置基础信息
const RPC_URL = "http://gwan-testnet.wandevs.org:36891";

const CONTRACT_ADDRESS = {
  "SMG":"0xcB67dcaA905a2DB9300f2f740202901fA3a68Aa5",
  "GPK":"0xcB67dcaA905a2DB9300f2f740202901fA3a68Aa5"
}

const ABI = {
  "SMG": require("./abi/smg-abi.json"),
  "GPK": require("./abi/gpk-abi.json"),
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

function printUsageAndExit() {
  console.log("Usage: node bin/getEvent.js <gpk|smg> <eventName>");
  console.log("Example: node bin/getEvent.js smg StoremanGroupRegisterStartEvent");
  process.exit(1);
}

async function main() {
  const contractArg = (process.argv[2] || "").toUpperCase();
  const eventName = process.argv[3];

  if (!contractArg || !eventName) {
    printUsageAndExit();
  }

  if (!CONTRACT_ADDRESS[contractArg]) {
    console.error("Unknown contract:", process.argv[2]);
    printUsageAndExit();
  }

  if (!ABI[contractArg]) {
    console.error("ABI not found for contract:", process.argv[2]);
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
    console.log("读取最近 1000 个区块内的历史事件...");
    const currentBlock = await provider.getBlockNumber();
    console.log(`currentBlock: ${currentBlock}`);
    
    // 查询从 currentBlock - 100000 到现在的事件
    const fromBlock = Math.max(0, currentBlock - 1000);
    const toBlock = currentBlock;
    console.log(`fromBlock: ${fromBlock}, toBlock: ${toBlock}`);
    const events = await contract.queryFilter(eventName, fromBlock, toBlock);
    console.log(`events.length: ${events.length}`);
    
    events.forEach((event) => {
      // 解析后的数据在 event.args 中
      const args = normalizeArgs(event.args);
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
