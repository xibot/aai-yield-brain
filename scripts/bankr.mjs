import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const BANKR_CONFIG_PATHS = [
  path.join(process.env.HOME ?? "", ".openclaw", "skills", "bankr", "config.json"),
  path.join(process.env.HOME ?? "", ".openclaw", "workspace", "skills", "bankr", "config.json"),
  path.join(process.env.HOME ?? "", ".bankr", "config.json")
];

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

function rpcUrlForChain(chainId) {
  if (chainId === 1) {
    return process.env.ETH_RPC_URL ?? null;
  }
  if (chainId === 8453) {
    return process.env.BASE_RPC_URL ?? null;
  }
  return null;
}

export async function waitForReceipt(chainId, txHash, timeoutMs = 180000, pollMs = 4000) {
  const rpcUrl = rpcUrlForChain(chainId);
  if (!rpcUrl) {
    return null;
  }

  const start = Date.now();
  while (true) {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getTransactionReceipt",
        params: [txHash]
      })
    });
    const payload = await response.json();
    if (payload?.result) {
      return payload.result;
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
