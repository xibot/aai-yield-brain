import fs from "node:fs";
import path from "node:path";

export function projectRoot() {
  return process.cwd();
}

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function timestampSlug(date = new Date()) {
  return date.toISOString().replaceAll(":", "-");
}

export function normalizeAddress(value) {
  return typeof value === "string" ? value.toLowerCase() : value;
}

export function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function money(value) {
  return `$${Number(value).toFixed(2)}`;
}

export function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const part = argv[i];
    if (!part.startsWith("--")) {
      continue;
    }
    const key = part.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

export function resolveModelTier(policy, task) {
  const totalPlannedSpendUsd = Number(task.maxSpendUsd) + Number(task.expectedGasUsd);
  let minConfidence = 0.46;

  if (task.risk === "high" || totalPlannedSpendUsd >= Number(policy.maxSingleActionUsd) * 0.75) {
    minConfidence = 0.9;
  } else if (
    task.risk === "medium" ||
    task.urgency === "high" ||
    totalPlannedSpendUsd >= Number(policy.maxSingleActionUsd) * 0.35
  ) {
    minConfidence = 0.74;
  }

  const sorted = [...policy.modelTiers].sort((a, b) => Number(a.costUsd) - Number(b.costUsd));
  return sorted.find((tier) => Number(tier.confidence) >= minConfidence) ?? sorted[sorted.length - 1];
}

function isRecipientAllowed(policy, recipient) {
  return policy.allowRecipients.some(
    (entry) => normalizeAddress(entry.address) === normalizeAddress(recipient)
  );
}

function isAssetAllowed(policy, asset) {
  return policy.allowAssets.includes(asset);
}

function isTaskTypeAllowed(policy, taskType) {
  return policy.allowTaskTypes.includes(taskType);
}

export function evaluateTask(policy, treasury, task) {
  const selectedModel = resolveModelTier(policy, task);
  const inferenceCostUsd = Number(selectedModel.costUsd);
  const executionCostUsd = Number(task.maxSpendUsd) + Number(task.expectedGasUsd);
  const totalCostUsd = inferenceCostUsd + executionCostUsd;
  const remainingInferenceBudgetUsd = Number(policy.dailyInferenceBudgetUsd) - Number(treasury.spentToday.inferenceUsd);
  const remainingExecutionBudgetUsd = Number(policy.dailyExecutionBudgetUsd) - Number(treasury.spentToday.executionUsd);
  const yieldAvailableUsd = Number(treasury.yieldAvailableUsd);
  const netValueUsd = Number(task.estimatedValueUsd) - totalCostUsd;
  const valueMultiple = totalCostUsd > 0 ? Number(task.estimatedValueUsd) / totalCostUsd : Number.POSITIVE_INFINITY;
  const reasons = [];
  let decision = "execute";

  if (!isTaskTypeAllowed(policy, task.taskType)) {
    decision = "reject";
    reasons.push(`task type ${task.taskType} is outside the policy allowlist`);
  }

  if (task.action?.asset && !isAssetAllowed(policy, task.action.asset)) {
    decision = "reject";
    reasons.push(`asset ${task.action.asset} is outside the policy allowlist`);
  }

  if (
    task.action?.recipient &&
    normalizeAddress(task.action.recipient) !== normalizeAddress("0x0000000000000000000000000000000000000000") &&
    !isRecipientAllowed(policy, task.action.recipient)
  ) {
    decision = "reject";
    reasons.push(`recipient ${task.action.recipient} is not allowlisted`);
  }

  if (Number(task.maxSpendUsd) > Number(policy.maxSingleActionUsd)) {
    decision = "reject";
    reasons.push(`task spend ${money(task.maxSpendUsd)} breaches the single-action cap`);
  }

  if (remainingInferenceBudgetUsd < inferenceCostUsd) {
    decision = "reject";
    reasons.push(`remaining inference budget ${money(remainingInferenceBudgetUsd)} cannot cover ${money(inferenceCostUsd)}`);
  }

  if (remainingExecutionBudgetUsd < executionCostUsd) {
    decision = "reject";
    reasons.push(`remaining execution budget ${money(remainingExecutionBudgetUsd)} cannot cover ${money(executionCostUsd)}`);
  }

  if (yieldAvailableUsd < totalCostUsd) {
    decision = "reject";
    reasons.push(`available yield ${money(yieldAvailableUsd)} cannot cover total projected cost ${money(totalCostUsd)}`);
  }

  if (decision === "execute" && netValueUsd < Number(policy.minNetValueUsd)) {
    decision = "reject";
    reasons.push(`net value ${money(netValueUsd)} is below the minimum target ${money(policy.minNetValueUsd)}`);
  }

  if (decision === "execute" && valueMultiple < Number(policy.minValueMultiple)) {
    decision = "reject";
    reasons.push(`value multiple ${valueMultiple.toFixed(2)}x is below the threshold ${Number(policy.minValueMultiple).toFixed(2)}x`);
  }

  if (decision === "execute" && yieldAvailableUsd - totalCostUsd < Number(policy.minYieldBufferUsd)) {
    decision = "defer";
    reasons.push(`executing now would leave only ${money(yieldAvailableUsd - totalCostUsd)} in yield, below the buffer target ${money(policy.minYieldBufferUsd)}`);
  }

  if (reasons.length === 0) {
    reasons.push("task clears policy, budget, and value thresholds");
  }

  const summary =
    decision === "execute"
      ? `Execute using ${selectedModel.label}: ${money(task.estimatedValueUsd)} expected value on ${money(totalCostUsd)} total cost.`
      : decision === "defer"
        ? `Defer after ${selectedModel.label}: the task is attractive, but it would compress the yield buffer too far.`
        : `Reject after ${selectedModel.label}: ${reasons[0]}.`;

  return {
    taskId: task.id,
    taskType: task.taskType,
    goal: task.goal,
    urgency: task.urgency,
    risk: task.risk,
    decision,
    summary,
    selectedModel: {
      id: selectedModel.id,
      label: selectedModel.label,
      costUsd: inferenceCostUsd,
      confidence: Number(selectedModel.confidence)
    },
    economics: {
      expectedValueUsd: Number(task.estimatedValueUsd),
      maxSpendUsd: Number(task.maxSpendUsd),
      expectedGasUsd: Number(task.expectedGasUsd),
      inferenceCostUsd,
      executionCostUsd,
      totalCostUsd,
      netValueUsd,
      valueMultiple: Number(valueMultiple.toFixed(4))
    },
    budgets: {
      remainingInferenceBudgetUsd: Number(remainingInferenceBudgetUsd.toFixed(4)),
      remainingExecutionBudgetUsd: Number(remainingExecutionBudgetUsd.toFixed(4)),
      yieldAvailableUsd: Number(yieldAvailableUsd.toFixed(4)),
      minYieldBufferUsd: Number(policy.minYieldBufferUsd)
    },
    reasons,
    action: task.action ?? null
  };
}

export function applyDecision(treasury, decision) {
  const next = deepClone(treasury);
  next.spentToday.inferenceUsd = Number((Number(next.spentToday.inferenceUsd) + Number(decision.selectedModel.costUsd)).toFixed(4));
  next.yieldAvailableUsd = Number((Number(next.yieldAvailableUsd) - Number(decision.selectedModel.costUsd)).toFixed(4));

  if (decision.decision === "execute") {
    next.spentToday.executionUsd = Number((Number(next.spentToday.executionUsd) + Number(decision.economics.executionCostUsd)).toFixed(4));
    next.yieldAvailableUsd = Number((Number(next.yieldAvailableUsd) - Number(decision.economics.executionCostUsd)).toFixed(4));
  }

  return next;
}

export function buildReceipt(decision, treasuryBefore, treasuryAfter) {
  return {
    decidedAt: new Date().toISOString(),
    taskId: decision.taskId,
    taskType: decision.taskType,
    decision: decision.decision,
    summary: decision.summary,
    selectedModel: decision.selectedModel,
    economics: decision.economics,
    reasons: decision.reasons,
    treasuryBefore,
    treasuryAfter,
    action: decision.action
  };
}
