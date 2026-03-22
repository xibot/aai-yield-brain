import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const BANKR_CONFIG_PATHS = [
  path.join(process.env.HOME ?? "", ".openclaw", "skills", "bankr", "config.json"),
  path.join(process.env.HOME ?? "", ".openclaw", "workspace", "skills", "bankr", "config.json"),
  path.join(process.env.HOME ?? "", ".bankr", "config.json")
];

const DEFAULT_RPC_URLS = {
  1: [
    "https://ethereum-rpc.publicnode.com",
    "https://cloudflare-eth.com",
    "https://eth.llamarpc.com"
  ],
  8453: [
    "https://mainnet.base.org",
    "https://base-rpc.publicnode.com",
    "https://base.llamarpc.com"
  ]
};

function readJsonConfig(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function resolveBankrConfig() {
  const envKey = process.env.BANKR_API_KEY;
  const envUrl = process.env.BANKR_API_URL;
  if (envKey) {
    return {
      apiKey: envKey,
      apiUrl: envUrl ?? "https://api.bankr.bot"
    };
  }

  for (const configPath of BANKR_CONFIG_PATHS) {
    const parsed = readJsonConfig(configPath);
    if (parsed?.apiKey) {
      return {
        apiKey: parsed.apiKey,
        apiUrl: parsed.apiUrl ?? "https://api.bankr.bot"
      };
    }
  }

  throw new Error("BANKR_API_KEY not found in env or Bankr config");
}

export function resolveBankrWallet() {
  if (process.env.BANKR_EVM_WALLET) {
    return process.env.BANKR_EVM_WALLET;
  }

  const output = execFileSync("bankr", ["whoami"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  const match = output.match(/(?:^|\n)\s*EVM(?:\s+wallet:)?\s+(0x[a-fA-F0-9]{40})/i);
  if (!match) {
    throw new Error("Could not parse Bankr EVM wallet from `bankr whoami`");
  }
  return match[1];
}

export function ethToWei(value) {
  const [wholePart, fractionPart = ""] = String(value).trim().split(".");
  const normalizedWhole = wholePart === "" ? "0" : wholePart;
  const normalizedFraction = `${fractionPart}000000000000000000`.slice(0, 18);
  return (BigInt(normalizedWhole) * 10n ** 18n + BigInt(normalizedFraction)).toString();
}

function parseRpcUrlList(value) {
  return String(value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function rpcUrlsForChain(chainId) {
  if (chainId === 1) {
    return [
      ...parseRpcUrlList(process.env.ETH_RPC_URL ?? process.env.MAINNET_RPC_URL),
      ...DEFAULT_RPC_URLS[1]
    ];
  }
  if (chainId === 8453) {
    return [
      ...parseRpcUrlList(process.env.BASE_RPC_URL),
      ...DEFAULT_RPC_URLS[8453]
    ];
  }
  return [];
}

async function rpcRequest(chainId, method, params = []) {
  const rpcUrls = rpcUrlsForChain(chainId);
  if (rpcUrls.length === 0) {
    throw new Error(`No RPC URL configured for chain ${chainId}`);
  }

  const errors = [];
  for (const rpcUrl of rpcUrls) {
    try {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method,
          params
        })
      });

      const rawText = await response.text();
      let payload;
      try {
        payload = JSON.parse(rawText);
      } catch {
        throw new Error(`non-JSON response (${rawText.slice(0, 120)})`);
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      if (payload?.error) {
        throw new Error(JSON.stringify(payload.error));
      }
      return payload.result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${rpcUrl} => ${message}`);
    }
  }

  throw new Error(`RPC ${method} failed on chain ${chainId}: ${errors.join(" | ")}`);
}

export function formatWeiToEth(value) {
  const wei = typeof value === "string" && value.startsWith("0x") ? BigInt(value) : BigInt(value ?? 0);
  const whole = wei / 10n ** 18n;
  const fraction = (wei % 10n ** 18n).toString().padStart(18, "0").replace(/0+$/, "");
  return fraction ? `${whole.toString()}.${fraction}` : whole.toString();
}

export async function readNativeBalance({ id, label, address, chainId, asset = "ETH", role = null }) {
  const snapshot = {
    id: id ?? null,
    label,
    role,
    address,
    chainId: Number(chainId),
    asset,
    readAt: new Date().toISOString(),
    status: "ok"
  };

  try {
    const [balanceWei, blockNumberHex] = await Promise.all([
      rpcRequest(Number(chainId), "eth_getBalance", [address, "latest"]),
      rpcRequest(Number(chainId), "eth_blockNumber", [])
    ]);
    snapshot.balanceWei = balanceWei;
    snapshot.balanceEth = formatWeiToEth(balanceWei);
    snapshot.blockNumber = Number(BigInt(blockNumberHex));
  } catch (error) {
    snapshot.status = "error";
    snapshot.error = error instanceof Error ? error.message : String(error);
  }

  return snapshot;
}

export async function readPolicyWalletSnapshots(policy) {
  const entries = Object.entries(policy.wallets ?? {}).map(([id, wallet]) => ({ id, ...wallet }));
  if (entries.length === 0) {
    return [];
  }

  return Promise.all(entries.map((wallet) => readNativeBalance(wallet)));
}

export async function submitBankrTransaction({ to, chainId, valueWei, data = "0x", description, waitForConfirmation = true }) {
  const { apiKey, apiUrl } = resolveBankrConfig();
  const response = await fetch(`${apiUrl}/agent/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey
    },
    body: JSON.stringify({
      transaction: {
        to,
        chainId,
        value: valueWei,
        data
      },
      description,
      waitForConfirmation
    })
  });

  const raw = await response.json();
  if (!response.ok || !raw?.success || !raw?.transactionHash) {
    throw new Error(`Bankr submit failed: ${JSON.stringify(raw)}`);
  }

  return {
    transactionHash: String(raw.transactionHash),
    raw
  };
}

export async function waitForReceipt(chainId, txHash, timeoutMs = 180000, pollMs = 4000) {
  const rpcUrls = rpcUrlsForChain(chainId);
  if (rpcUrls.length === 0) {
    return null;
  }

  const start = Date.now();
  while (true) {
    const result = await rpcRequest(chainId, "eth_getTransactionReceipt", [txHash]);
    if (result) {
      return result;
    }

    if (Date.now() - start >= timeoutMs) {
      throw new Error(`Timed out waiting for receipt ${txHash}`);
    }

    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

export async function broadcastApprovedTask(task, decision) {
  if (decision.decision !== "execute") {
    throw new Error(`Refusing to broadcast a ${decision.decision} decision`);
  }

  if (!task.action || task.action.kind !== "native-transfer") {
    throw new Error("Only native-transfer tasks are supported for live broadcast in this MVP");
  }

  const submit = await submitBankrTransaction({
    to: task.action.recipient,
    chainId: Number(task.action.chainId),
    valueWei: ethToWei(task.action.valueEth),
    description: `Yield Brain: ${task.goal}`,
    waitForConfirmation: true
  });

  const receipt = await waitForReceipt(Number(task.action.chainId), submit.transactionHash).catch(() => null);
  return {
    bankrWallet: resolveBankrWallet(),
    transactionHash: submit.transactionHash,
    receipt,
    raw: submit.raw
  };
}
