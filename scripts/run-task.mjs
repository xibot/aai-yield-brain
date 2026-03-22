import path from "node:path";
import { broadcastApprovedTask, readPolicyWalletSnapshots } from "./bankr.mjs";
import {
  applyDecision,
  buildPolicySummary,
  buildReceipt,
  deriveTreasuryState,
  evaluateTask,
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
const scenarioPath = path.resolve(root, args.scenario ?? "examples/demo-scenario.json");
const taskId = args["task-id"];

if (!taskId) {
  throw new Error("Missing required --task-id");
}

const policy = readJson(policyPath);
const scenario = readJson(scenarioPath);
const task = scenario.tasks.find((entry) => entry.id === taskId);
if (!task) {
  throw new Error(`Task ${taskId} not found in ${scenarioPath}`);
}

const mode = resolveOperatingMode(policy, args);
const pauseSwitch = resolvePauseSwitch(policy, args);
const policySummary = buildPolicySummary(policy);
const walletSnapshots = args["skip-wallet-balances"] ? [] : await readPolicyWalletSnapshots(policy).catch((error) => [{
  id: "wallet-reader",
  label: "Wallet Reader",
  status: "error",
  error: error instanceof Error ? error.message : String(error),
  readAt: new Date().toISOString()
}]);

const treasuryBefore = deriveTreasuryState(scenario);
const decision = evaluateTask(policy, treasuryBefore, task);
const treasuryAfter = applyDecision(treasuryBefore, decision);

const broadcastRequested = Boolean(args.broadcast);
let broadcastAllowed = false;
let broadcastExecuted = false;
let broadcastSkippedReason = null;
let liveExecution = null;

if (broadcastRequested) {
  if (mode !== "live") {
    broadcastSkippedReason = "broadcast requested while operatingMode=shadow";
  } else if (pauseSwitch) {
    broadcastSkippedReason = "pause switch enabled";
  } else if (decision.decision !== "execute") {
    broadcastSkippedReason = `decision is ${decision.decision}`;
  } else if (!task.action || task.action.kind !== "native-transfer") {
    broadcastSkippedReason = `action kind ${task.action?.kind ?? "unknown"} is not broadcastable`;
  } else {
    broadcastAllowed = true;
    liveExecution = await broadcastApprovedTask(task, decision);
    broadcastExecuted = true;
  }
} else {
  broadcastSkippedReason = mode === "shadow" ? "shadow mode: no broadcast requested" : "live mode without --broadcast";
}

const receipt = buildReceipt(decision, treasuryBefore, treasuryAfter, {
  project: policy.project,
  policySummary,
  mode,
  pauseSwitch,
  broadcastRequested,
  broadcastAllowed,
  broadcastExecuted,
  broadcastSkippedReason,
  walletSnapshots,
  liveExecution
});

const outPath = path.resolve(root, args.out ?? `receipts/${timestampSlug()}-${task.id}.json`);
writeJson(outPath, receipt);

console.log(`${task.id}: ${decision.decision.toUpperCase()}`);
console.log(`Mode: ${mode}${pauseSwitch ? " (paused)" : ""}`);
console.log(decision.summary);
console.log(`Sources after decision: ${(treasuryAfter.sources ?? []).map((source) => `${source.id}=${Number(source.spendableYieldUsd).toFixed(2)}`).join(", ")}`);
if (walletSnapshots.length > 0) {
  console.log("Wallet snapshots:");
  for (const snapshot of walletSnapshots) {
    const status = snapshot.status === "ok"
      ? `${snapshot.label} [chain ${snapshot.chainId}] = ${snapshot.balanceEth} ${snapshot.asset}`
      : `${snapshot.label} [chain ${snapshot.chainId ?? "?"}] = ERROR (${snapshot.error})`;
    console.log(`- ${status}`);
  }
}
if (broadcastExecuted && receipt.liveExecution?.transactionHash) {
  console.log(`Broadcast tx: ${receipt.liveExecution.transactionHash}`);
} else {
  console.log(`Broadcast status: ${broadcastSkippedReason}`);
}
console.log(`Saved receipt to ${outPath}`);
