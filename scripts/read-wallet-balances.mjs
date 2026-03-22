import path from "node:path";
import { readPolicyWalletSnapshots } from "./bankr.mjs";
import {
  buildPolicySummary,
  parseArgs,
  projectRoot,
  readJson,
  resolveOperatingMode,
  resolvePauseSwitch,
  timestampSlug,
  writeJson
} from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const root = projectRoot();
const policyPath = path.resolve(root, args.policy ?? "config/policy.example.json");
const outPath = path.resolve(root, args.out ?? `outputs/wallet-balances-${timestampSlug()}.json`);
const policy = readJson(policyPath);
const policySummary = buildPolicySummary(policy);
const mode = resolveOperatingMode(policy, args);
const pauseSwitch = resolvePauseSwitch(policy, args);
const wallets = await readPolicyWalletSnapshots(policy);

const report = {
  project: policy.project,
  readAt: new Date().toISOString(),
  policyPath,
  operatingControls: {
    mode,
    pauseSwitch
  },
  policySummary,
  wallets
};

writeJson(outPath, report);
console.log(`Yield Brain wallet snapshot saved to ${outPath}`);
for (const wallet of wallets) {
  const line = wallet.status === "ok"
    ? `${wallet.label} [chain ${wallet.chainId}] = ${wallet.balanceEth} ${wallet.asset}`
    : `${wallet.label} [chain ${wallet.chainId ?? "?"}] = ERROR (${wallet.error})`;
  console.log(`- ${line}`);
}
