
const { ethers } = require("ethers");
const fs = require("node:fs");
const path = require("node:path");

function parseArgs(argv) {
  const out = {
    data: "",
    abiDir: path.resolve(__dirname, "abi"),
    all: false,
    positional: [],
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--data") {
      out.data = argv[i + 1] || "";
      i++;
      continue;
    }
    if (a === "--abiDir") {
      out.abiDir = path.resolve(process.cwd(), argv[i + 1] || "");
      i++;
      continue;
    }
    if (a === "--all") {
      out.all = true;
      continue;
    }
    out.positional.push(a);
  }

  return out;
}

function jsonReplacer(_key, value) {
  if (typeof value === "bigint") {
    return value.toString();
  }
  return value;
}

function normalizeArgs(args) {
  if (!args) return args;
  const out = {};
  for (const key of Object.keys(args)) {
    out[key] = args[key];
  }
  return out;
}

function safeName(name, fallback) {
  const n = typeof name === "string" ? name.trim() : "";
  return n ? n : fallback;
}

function formatValueWithParam(param, value) {
  if (!param) return value;

  // ethers v6: param.baseType is one of: array, tuple, ...
  const baseType = param.baseType || "";
  if (baseType === "array") {
    if (!Array.isArray(value)) return value;
    return value.map((v) => formatValueWithParam(param.arrayChildren, v));
  }

  if (baseType === "tuple") {
    const components = Array.isArray(param.components) ? param.components : [];
    const out = {};
    for (let i = 0; i < components.length; i++) {
      const c = components[i];
      const key = safeName(c?.name, `field${i}`);
      out[key] = formatValueWithParam(c, value?.[i]);
    }
    return out;
  }

  return value;
}

function formatArgsWithFragment(fragment, args) {
  const inputs = fragment?.inputs;
  if (!Array.isArray(inputs)) return normalizeArgs(args);

  const out = {};
  for (let i = 0; i < inputs.length; i++) {
    const p = inputs[i];
    const key = safeName(p?.name, `arg${i}`);
    out[key] = formatValueWithParam(p, args?.[i]);
  }
  return out;
}

function printUsageAndExit() {
  console.log("Usage: node bin/decodeData.js --data <0x...calldata> [--abiDir <dir>] [--all]");
  console.log("Example: node bin/decodeData.js --data 0x1234...");
  process.exit(1);
}

function normalizeHexData(data) {
  if (!data) return "";
  const trimmed = String(data).trim();
  if (!trimmed) return "";
  return trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
}

function readAbiFiles(abiDir) {
  const entries = fs.readdirSync(abiDir, { withFileTypes: true });
  const jsonFiles = entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".json"))
    .map((e) => path.join(abiDir, e.name));

  const out = [];
  for (const filePath of jsonFiles) {
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (_e) {
      continue;
    }

    const abi = Array.isArray(parsed) ? parsed : parsed?.abi;
    if (!Array.isArray(abi)) continue;
    out.push({ filePath, abi });
  }
  return out;
}

function tryDecodeWithAbi(data, abi) {
  const iface = new ethers.Interface(abi);
  const desc = iface.parseTransaction({ data });
  const args = formatArgsWithFragment(desc?.fragment, desc?.args);
  return {
    name: desc?.name,
    signature: desc?.signature,
    selector: desc?.selector,
    fragment: desc?.fragment,
    args,
  };
}

async function main() {
  const { data: rawData, abiDir, all } = parseArgs(process.argv.slice(2));
  const data = normalizeHexData(rawData);

  if (!data) {
    printUsageAndExit();
  }

  if (!ethers.isHexString(data)) {
    console.error("Invalid --data. Expected hex string like 0x...");
    process.exit(1);
  }

  if (data.length < 10) {
    console.error("Invalid --data. Expected at least 4-byte selector (>= 10 hex chars inc 0x)");
    process.exit(1);
  }

  if (!fs.existsSync(abiDir) || !fs.statSync(abiDir).isDirectory()) {
    console.error("ABI dir not found:", abiDir);
    process.exit(1);
  }

  const abiFiles = readAbiFiles(abiDir);
  if (abiFiles.length === 0) {
    console.error("No ABI json files found in:", abiDir);
    process.exit(1);
  }

  const matches = [];
  for (const { filePath, abi } of abiFiles) {
    try {
      const decoded = tryDecodeWithAbi(data, abi);
      matches.push({ filePath, decoded });
      if (!all) break;
    } catch (_e) {
      // ignore
    }
  }

  if (matches.length === 0) {
    console.log("No ABI matched this calldata.");
    console.log("selector:", data.slice(0, 10));
    process.exit(2);
  }

  for (const m of matches) {
    console.log("matchedAbi:", path.relative(process.cwd(), m.filePath));
    console.log("function:", m.decoded.signature || m.decoded.name || "(unknown)");
    console.log("selector:", m.decoded.selector || data.slice(0, 10));
    console.log("args:", m.decoded.args ? JSON.stringify(m.decoded.args, jsonReplacer, 2) : "null");
    if (!all) break;
    console.log("---");
  }
}

main().catch((e) => {
  console.error(String(e?.stack || e?.message || e));
  process.exit(1);
});

