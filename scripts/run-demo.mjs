import path from "node:path";
import {
  applyDecision,
  buildReceipt,
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
const outPath = path.resolve(root, args.out ?? `outputs/demo-${timestampSlug()}.json`);

const policy = readJson(policyPath);
const scenario = readJson(scenarioPath);
let treasury = JSON.parse(JSON.stringify(scenario.treasury));

const decisions = [];
for (const task of scenario.tasks) {
  const treasuryBefore = JSON.parse(JSON.stringify(treasury));
  const decision = evaluateTask(policy, treasury, task);
  const treasuryAfter = applyDecision(treasury, decision);
  decisions.push(buildReceipt(decision, treasuryBefore, treasuryAfter));
  treasury = treasuryAfter;
}

const report = {
  project: policy.project,
  generatedAt: new Date().toISOString(),
  policyPath,
  scenarioPath,
  openingTreasury: scenario.treasury,
  closingTreasury: treasury,
  totals: {
    tasks: decisions.length,
    executed: decisions.filter((entry) => entry.decision === "execute").length,
    deferred: decisions.filter((entry) => entry.decision === "defer").length,
    rejected: decisions.filter((entry) => entry.decision === "reject").length
  },
  decisions
};

writeJson(outPath, report);

console.log(`AAi Yield Brain demo complete: ${report.totals.executed} execute / ${report.totals.deferred} defer / ${report.totals.rejected} reject`);
console.log(`Opening yield available: $${Number(report.openingTreasury.yieldAvailableUsd).toFixed(2)}`);
console.log(`Closing yield available: $${Number(report.closingTreasury.yieldAvailableUsd).toFixed(2)}`);
for (const entry of report.decisions) {
  console.log(`- ${entry.taskId}: ${entry.decision.toUpperCase()} :: ${entry.summary}`);
}
console.log(`Saved report to ${outPath}`);
