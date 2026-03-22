import path from "node:path";
import { broadcastApprovedTask } from "./bankr.mjs";
import {
  applyDecision,
  buildReceipt,
  deriveTreasuryState,
  evaluateTask,
  parseArgs,
  projectRoot,
  readJson,
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

const treasuryBefore = deriveTreasuryState(scenario);
const decision = evaluateTask(policy, treasuryBefore, task);
const treasuryAfter = applyDecision(treasuryBefore, decision);
const receipt = buildReceipt(decision, treasuryBefore, treasuryAfter);

if (args.broadcast) {
  receipt.liveExecution = await broadcastApprovedTask(task, decision);
}

const outPath = path.resolve(root, args.out ?? `receipts/${timestampSlug()}-${task.id}.json`);
writeJson(outPath, receipt);

console.log(`${task.id}: ${decision.decision.toUpperCase()}`);
console.log(decision.summary);
console.log(`Sources after decision: ${(treasuryAfter.sources ?? []).map((source) => `${source.id}=${Number(source.spendableYieldUsd).toFixed(2)}`).join(", ")}`);
if (receipt.liveExecution?.transactionHash) {
  console.log(`Broadcast tx: ${receipt.liveExecution.transactionHash}`);
}
console.log(`Saved receipt to ${outPath}`);
