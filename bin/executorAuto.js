const { ethers } = require("ethers");
const fs = require("node:fs");
const path = require("node:path");
const cron = require("node-cron");

const ABI = {
  TIMELOCK: require("./abi/timelock-abi.json"),
  SMG: require("./abi/smg-abi.json"),
  GPK: require("./abi/gpk-abi.json"),
};

function readRepoConfig() {
  const configPath = path.resolve(__dirname, "..", "cfg", "config.json");
  const raw = fs.readFileSync(configPath, "utf8");
  return JSON.parse(raw);
}

function parseArgs(argv) {
  const out = {
    grpPrex: "",
    network: "mainnet",

    cron: "",

    blocksBack: 518400,

    keystore: "",
    password: "",
    passwordEnv: "KEYSTORE_PASSWORD",

    once: false,
    dryRun: false,
    maxOps: 20,
    minConfirmations: 1,

    gasLimit: "",

    positional: [],
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];

    if (a === "--grpPrex") {
      out.grpPrex = argv[i + 1] || "";
      i++;
      continue;
    }
    if (a === "--network") {
      out.network = argv[i + 1] || "";
      i++;
      continue;
    }

    if (a === "--cron") {
      out.cron = argv[i + 1] || "";
      i++;
      continue;
    }

    if (a === "--blocksBack") {
      const n = Number(argv[i + 1]);
      out.blocksBack = Number.isFinite(n) && n >= 0 ? Math.floor(n) : NaN;
      i++;
      continue;
    }

    if (a === "--keystore") {
      out.keystore = argv[i + 1] || "";
      i++;
      continue;
    }
    if (a === "--password") {
      out.password = argv[i + 1] || "";
      i++;
      continue;
    }
    if (a === "--passwordEnv") {
      out.passwordEnv = argv[i + 1] || "KEYSTORE_PASSWORD";
      i++;
      continue;
    }

    if (a === "--once") {
      out.once = true;
      continue;
    }
    if (a === "--dryRun") {
      out.dryRun = true;
      continue;
    }

    if (a === "--maxOps") {
      const n = Number(argv[i + 1]);
      out.maxOps = Number.isFinite(n) && n > 0 ? Math.floor(n) : NaN;
      i++;
      continue;
    }

    if (a === "--minConfirmations") {
      const n = Number(argv[i + 1]);
      out.minConfirmations = Number.isFinite(n) && n >= 0 ? Math.floor(n) : NaN;
      i++;
      continue;
    }

    if (a === "--gasLimit") {
      out.gasLimit = argv[i + 1] || "";
      i++;
      continue;
    }

    out.positional.push(a);
  }

  return out;
}

function printUsageAndExit() {
  console.log(`Usage:
node bin/executorAuto.js --network testnet|mainnet --grpPrex <grpPrex> \\
  --keystore <path-to-keystore.json> \\
  [--cron "<cron expr>" (override cfg)] \\
  [--blocksBack N] [--maxOps N] [--once] [--dryRun]

Notes:
- timezone is always UTC
- cron is resolved as: --cron > cfg[network].groups[grpPrex].cron

Examples:
node bin/executorAuto.js --network testnet --grpPrex Aries --keystore ./keystore.json --once
node bin/executorAuto.js --network testnet --grpPrex Aries --keystore ./keystore.json --cron "0 4 * * *"
`);
  process.exit(1);
}

function nowIso() {
  return new Date().toISOString();
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

  if (!net.timelockAddr) throw new Error(`Missing ${network}.timelockAddr in cfg/config.json`);
  if (!net.smgContractAddr) throw new Error(`Missing ${network}.smgContractAddr in cfg/config.json`);
  if (!net.gpkContractAddr) throw new Error(`Missing ${network}.gpkContractAddr in cfg/config.json`);

  const group = grpPrex ? net?.groups?.[grpPrex] : null;
  if (!group) {
    throw new Error(`Missing cfg.${network}.groups.${grpPrex} in cfg/config.json`);
  }

  return {
    rpcUrl: net.url,
    cron: typeof group.cron === "string" && group.cron ? group.cron : "",
    contractAddress: {
      TIMELOCK: net.timelockAddr,
      SMG: net.smgContractAddr,
      GPK: net.gpkContractAddr,
    },
  };
}

function askHidden(question) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    const stdout = process.stdout;

    if (!stdin.isTTY) {
      reject(new Error("Cannot read hidden input: stdin is not a TTY"));
      return;
    }

    stdout.write(question);

    let buf = "";

    function onData(chunk) {
      const s = chunk.toString("utf8");

      if (s === "\r" || s === "\n" || s === "\r\n") {
        stdout.write("\n");
        cleanup();
        resolve(buf);
        return;
      }

      if (s === "\u0003") {
        cleanup();
        reject(new Error("Interrupted (Ctrl+C)"));
        return;
      }

      if (s === "\b" || s === "\x7f") {
        buf = buf.slice(0, -1);
        return;
      }

      if (/[\x00-\x1F]/.test(s)) return;

      buf += s;
    }

    function cleanup() {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
    }

    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}

async function loadWalletFromKeystore({ keystorePath, password }) {
  if (!keystorePath) throw new Error("Missing --keystore <path>");
  const abs = path.resolve(process.cwd(), keystorePath);
  const encryptedJson = fs.readFileSync(abs, "utf8");
  return await ethers.Wallet.fromEncryptedJson(encryptedJson, password);
}

function uniqueLatestByIndex(calls) {
  const byIndex = new Map();
  for (const c of calls) {
    const k = String(c.index);
    const prev = byIndex.get(k);
    if (!prev || BigInt(c.blockNumber) > BigInt(prev.blockNumber)) byIndex.set(k, c);
  }
  return Array.from(byIndex.values()).sort((a, b) =>
    BigInt(a.index) < BigInt(b.index) ? -1 : BigInt(a.index) > BigInt(b.index) ? 1 : 0
  );
}

async function scanReadyOperations({ provider, timelock, blocksBack }) {
  const latestBlock = await provider.getBlockNumber();
  const fromBlock = Math.max(0, latestBlock - blocksBack);

  const scheduledLogs = await timelock.queryFilter(timelock.filters.CallScheduled(), fromBlock, latestBlock);
  const saltLogs = await timelock.queryFilter(timelock.filters.CallSalt(), fromBlock, latestBlock);

  const saltById = new Map();
  for (const e of saltLogs) {
    const id = (e.args?.id || "").toString();
    const salt = (e.args?.salt || "").toString();
    if (id) saltById.set(id.toLowerCase(), salt);
  }

  const grouped = new Map();
  for (const e of scheduledLogs) {
    const a = e.args || {};
    const id = a.id;
    const key = String(id).toLowerCase();
    const item = grouped.get(key) || { id, predecessor: a.predecessor, calls: [] };

    item.calls.push({
      index: a.index,
      target: a.target,
      value: a.value,
      data: a.data,
      blockNumber: e.blockNumber,
      txHash: e.transactionHash,
    });

    grouped.set(key, item);
  }

  const results = [];
  for (const g of grouped.values()) {
    const id = g.id;
    const idLower = String(id).toLowerCase();

    const [done, ready, ts] = await Promise.all([
      timelock.isOperationDone(id),
      timelock.isOperationReady(id),
      timelock.getTimestamp(id).catch(() => 0n),
    ]);

    if (done) continue;
    if (!ready) continue;
    if (!ts || BigInt(ts) <= 1n) continue;

    const salt = saltById.get(idLower) || "0x" + "0".repeat(64);
    const calls = uniqueLatestByIndex(g.calls);

    results.push({
      id,
      predecessor: g.predecessor,
      salt,
      timestamp: BigInt(ts),
      calls,
    });
  }

  results.sort((a, b) => {
    const ab = a.calls?.[0]?.blockNumber ?? 0;
    const bb = b.calls?.[0]?.blockNumber ?? 0;
    return ab - bb;
  });

  return { fromBlock, toBlock: latestBlock, ops: results };
}

async function assertExecutorRole({ timelock, walletAddress }) {
  const role = await timelock.EXECUTOR_ROLE();
  const ok = await timelock.hasRole(role, walletAddress);
  if (!ok) {
    throw new Error(`Caller not in EXECUTOR_ROLE. caller=${walletAddress} role=${role}`);
  }
}

async function executeOneOperation({ timelock, op, dryRun, gasLimit }) {
  const predecessor = op.predecessor;
  const salt = op.salt;

  if (op.calls.length <= 1) {
    const c = op.calls[0];
    if (!c) return { skipped: true, reason: "empty calls" };

    if (dryRun) {
      return { dryRun: true, kind: "execute", id: op.id, target: c.target };
    }

    const overrides = {};
    if (gasLimit) overrides.gasLimit = BigInt(gasLimit);

    const tx = await timelock.execute(c.target, c.value, c.data, predecessor, salt, overrides);
    return { txHash: tx.hash, kind: "execute", id: op.id };
  }

  const targets = op.calls.map((c) => c.target);
  const values = op.calls.map((c) => c.value);
  const payloads = op.calls.map((c) => c.data);

  if (dryRun) {
    return { dryRun: true, kind: "executeBatch", id: op.id, calls: op.calls.length };
  }

  const overrides = {};
  if (gasLimit) overrides.gasLimit = BigInt(gasLimit);

  const tx = await timelock.executeBatch(targets, values, payloads, predecessor, salt, overrides);
  return { txHash: tx.hash, kind: "executeBatch", id: op.id, calls: op.calls.length };
}

async function runOnce(args) {
  const runtime = buildNetworkRuntime(args.network, args.grpPrex);

  const provider = new ethers.JsonRpcProvider(runtime.rpcUrl);
  const password =
    args.password ||
    process.env[args.passwordEnv] ||
    (await askHidden(`Keystore password (env ${args.passwordEnv} not set): `));

  const wallet = await loadWalletFromKeystore({
    keystorePath: args.keystore,
    password,
  });

  const signer = wallet.connect(provider);

  const timelockAddr = runtime.contractAddress.TIMELOCK;
  const timelock = new ethers.Contract(timelockAddr, ABI.TIMELOCK, signer);

  console.log(`[${nowIso()}] network=${args.network} grpPrex=${args.grpPrex} rpc=${runtime.rpcUrl}`);
  console.log(`[${nowIso()}] timelock=${timelockAddr}`);
  console.log(`[${nowIso()}] executor=${await signer.getAddress()}`);

  await assertExecutorRole({ timelock, walletAddress: await signer.getAddress() });

  const { fromBlock, toBlock, ops } = await scanReadyOperations({
    provider,
    timelock,
    blocksBack: args.blocksBack,
  });

  console.log(`[${nowIso()}] scan blocks: from=${fromBlock} to=${toBlock} scheduledReady=${ops.length}`);

  const toRun = ops.slice(0, args.maxOps);

  for (let i = 0; i < toRun.length; i++) {
    const op = toRun[i];
    console.log(`[${nowIso()}] executing (${i + 1}/${toRun.length}) id=${op.id} calls=${op.calls.length}`);

    try {
      const res = await executeOneOperation({
        timelock,
        op,
        dryRun: args.dryRun,
        gasLimit: args.gasLimit,
      });

      if (res?.txHash) {
        console.log(`[${nowIso()}] submitted tx=${res.txHash} kind=${res.kind}`);
        const receipt = await provider.waitForTransaction(res.txHash, args.minConfirmations);
        console.log(`[${nowIso()}] mined status=${receipt?.status} block=${receipt?.blockNumber}`);
      } else {
        console.log(`[${nowIso()}] result=${JSON.stringify(res)}`);
      }
    } catch (e) {
      console.error(`[${nowIso()}] execute failed id=${op.id}:`, String(e?.message || e));
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.network || !args.grpPrex) {
    console.error("Missing required args: --network and --grpPrex");
    printUsageAndExit();
  }
  if (!Number.isFinite(args.blocksBack)) {
    console.error("Invalid --blocksBack");
    printUsageAndExit();
  }
  if (!Number.isFinite(args.maxOps)) {
    console.error("Invalid --maxOps");
    printUsageAndExit();
  }
  if (!Number.isFinite(args.minConfirmations)) {
    console.error("Invalid --minConfirmations");
    printUsageAndExit();
  }

  if (args.once) {
    await runOnce(args);
    return;
  }

  const runtime = buildNetworkRuntime(args.network, args.grpPrex);
  const finalCron = args.cron || runtime.cron;

  if (!finalCron) {
    console.error(
      "Missing cron: provide --cron or set cfg[network].groups[grpPrex].cron (or use --once)"
    );
    printUsageAndExit();
  }

  if (!cron.validate(finalCron)) {
    throw new Error(`Invalid cron expression: ${finalCron}`);
  }

  console.log(`[${nowIso()}] cron scheduled: "${finalCron}" tz=UTC`);
  cron.schedule(
    finalCron,
    async () => {
      console.log(`[${nowIso()}] cron fired`);
      try {
        await runOnce(args);
      } catch (e) {
        console.error(`[${nowIso()}] runOnce error:`, String(e?.stack || e?.message || e));
      }
    },
    { timezone: "UTC" }
  );
}

main().catch((e) => {
  console.error(String(e?.stack || e?.message || e));
  process.exit(1);
});
