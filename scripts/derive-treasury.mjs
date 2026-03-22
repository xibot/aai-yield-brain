import path from "node:path";
import { deriveTreasuryState, parseArgs, projectRoot, readJson, writeJson } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const root = projectRoot();
const scenarioPath = path.resolve(root, args.scenario ?? "examples/demo-scenario.json");
const outPath = args.out ? path.resolve(root, args.out) : null;

const scenario = readJson(scenarioPath);
const treasury = deriveTreasuryState(scenario);

if (outPath) {
  writeJson(outPath, treasury);
  console.log(`Saved treasury snapshot to ${outPath}`);
} else {
  console.log(JSON.stringify(treasury, null, 2));
}
