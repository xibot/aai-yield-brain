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

export function resolveOperatingMode(policy, args = {}) {
  const requested = String(args.mode ?? policy.operatingMode ?? (args.broadcast ? "live" : "shadow")).toLowerCase();
  return requested === "live" ? "live" : "shadow";
}

export function resolvePauseSwitch(policy, args = {}) {
  if (args.paused === true) {
    return true;
  }
  if (args.unpaused === true) {
    return false;
  }
  return Boolean(policy.pauseSwitch);
}

export function buildPolicySummary(policy) {
  return {
    operatingMode: policy.operatingMode ?? "shadow",
    pauseSwitch: Boolean(policy.pauseSwitch),
    reserveFloorUsd: Number(policy.reserveFloorUsd ?? 0),
    minYieldBufferUsd: Number(policy.minYieldBufferUsd ?? 0),
    dailyInferenceBudgetUsd: Number(policy.dailyInferenceBudgetUsd ?? 0),
    dailyExecutionBudgetUsd: Number(policy.dailyExecutionBudgetUsd ?? 0),
    maxSingleActionUsd: Number(policy.maxSingleActionUsd ?? 0),
    minNetValueUsd: Number(policy.minNetValueUsd ?? 0),
    minValueMultiple: Number(policy.minValueMultiple ?? 0)
  };
}

function normalizeSource(source) {
  return {
    id: source.id,
    type: source.type,
    principalUsd: Number(source.principalUsd ?? 0),
    protectedPrincipalUsd: Number(source.protectedPrincipalUsd ?? source.principalUsd ?? 0),
    accruedYieldUsd: Number(source.accruedYieldUsd ?? 0),
    spendableYieldUsd: Number(source.spendableYieldUsd ?? source.accruedYieldUsd ?? 0),
    spendPriority: Number(source.spendPriority ?? 100),
    note: source.note ?? ""
  };
}

function recomputeTreasuryTotals(treasury) {
  if (!Array.isArray(treasury.sources)) {
    return treasury;
  }

  treasury.principalUsd = Number(
    treasury.sources.reduce((sum, source) => sum + Number(source.principalUsd), 0).toFixed(4)
  );
  treasury.protectedPrincipalUsd = Number(
    treasury.sources.reduce((sum, source) => sum + Number(source.protectedPrincipalUsd), 0).toFixed(4)
  );
  treasury.yieldAccruedUsd = Number(
    treasury.sources.reduce((sum, source) => sum + Number(source.accruedYieldUsd), 0).toFixed(4)
  );
  treasury.yieldAvailableUsd = Number(
    treasury.sources.reduce((sum, source) => sum + Number(source.spendableYieldUsd), 0).toFixed(4)
  );
  return treasury;
}

function spendFromSources(treasury, amountUsd) {
  let remaining = Number(amountUsd);
  if (!Array.isArray(treasury.sources) || remaining <= 0) {
    treasury.yieldAccruedUsd = Number((Number(treasury.yieldAccruedUsd) - remaining).toFixed(4));
    treasury.yieldAvailableUsd = Number((Number(treasury.yieldAvailableUsd) - remaining).toFixed(4));
    return treasury;
  }

  const ordered = [...treasury.sources].sort((a, b) => Number(a.spendPriority) - Number(b.spendPriority));
  for (const source of ordered) {
    if (remaining <= 0) {
      break;
    }
    const available = Number(source.spendableYieldUsd);
    if (available <= 0) {
      continue;
    }
    const take = Math.min(available, remaining);
    source.spendableYieldUsd = Number((available - take).toFixed(4));
    source.accruedYieldUsd = Number((Number(source.accruedYieldUsd) - take).toFixed(4));
    remaining = Number((remaining - take).toFixed(4));
  }

  if (remaining > 0.0001) {
    throw new Error(`Source allocation could not cover ${money(amountUsd)}`);
  }

  return recomputeTreasuryTotals(treasury);
}

export function deriveTreasuryState(scenario) {
  if (scenario.treasury) {
    return deepClone(scenario.treasury);
  }

  if (!scenario.treasuryModel) {
    throw new Error("Scenario must include either `treasury` or `treasuryModel`");
  }

  const treasury = {
    asOf: scenario.treasuryModel.asOf ?? new Date().toISOString(),
    principalUsd: 0,
    protectedPrincipalUsd: 0,
    yieldAccruedUsd: 0,
    yieldAvailableUsd: 0,
    spentToday: deepClone(
      scenario.treasuryModel.spentToday ?? {
        inferenceUsd: 0,
        executionUsd: 0
      }
    ),
    sources: (scenario.treasuryModel.sources ?? []).map(normalizeSource)
  };

  treasury.sources.sort((a, b) => Number(a.spendPriority) - Number(b.spendPriority));
  return recomputeTreasuryTotals(treasury);
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
  spendFromSources(next, Number(decision.selectedModel.costUsd));

  if (decision.decision === "execute") {
    next.spentToday.executionUsd = Number((Number(next.spentToday.executionUsd) + Number(decision.economics.executionCostUsd)).toFixed(4));
    spendFromSources(next, Number(decision.economics.executionCostUsd));
  }

  return recomputeTreasuryTotals(next);
}

export function calculateSourceDeltas(treasuryBefore, treasuryAfter) {
  const beforeMap = new Map((treasuryBefore.sources ?? []).map((source) => [source.id, source]));
  const afterMap = new Map((treasuryAfter.sources ?? []).map((source) => [source.id, source]));
  const ids = new Set([...beforeMap.keys(), ...afterMap.keys()]);

  return [...ids]
    .map((id) => {
      const before = beforeMap.get(id) ?? { spendableYieldUsd: 0, accruedYieldUsd: 0, spendPriority: 999, type: "unknown" };
      const after = afterMap.get(id) ?? { spendableYieldUsd: 0, accruedYieldUsd: 0, spendPriority: before.spendPriority ?? 999, type: before.type ?? "unknown" };
      return {
        id,
        type: after.type ?? before.type,
        spendPriority: Number(after.spendPriority ?? before.spendPriority ?? 999),
        spendableYieldUsdBefore: Number(before.spendableYieldUsd ?? 0),
        spendableYieldUsdAfter: Number(after.spendableYieldUsd ?? 0),
        spendableYieldUsdDelta: Number((Number(after.spendableYieldUsd ?? 0) - Number(before.spendableYieldUsd ?? 0)).toFixed(4)),
        accruedYieldUsdBefore: Number(before.accruedYieldUsd ?? 0),
        accruedYieldUsdAfter: Number(after.accruedYieldUsd ?? 0),
        accruedYieldUsdDelta: Number((Number(after.accruedYieldUsd ?? 0) - Number(before.accruedYieldUsd ?? 0)).toFixed(4))
      };
    })
    .sort((a, b) => Number(a.spendPriority) - Number(b.spendPriority));
}

export function buildReceipt(decision, treasuryBefore, treasuryAfter, context = {}) {
  const sourceDeltas = calculateSourceDeltas(treasuryBefore, treasuryAfter);
  return {
    receiptId: context.receiptId ?? `${decision.taskId}-${timestampSlug()}`,
    project: context.project ?? null,
    decidedAt: context.decidedAt ?? new Date().toISOString(),
    policySummary: context.policySummary ?? null,
    mode: context.mode ?? "shadow",
    pauseSwitch: Boolean(context.pauseSwitch),
    broadcastRequested: Boolean(context.broadcastRequested),
    broadcastAllowed: Boolean(context.broadcastAllowed),
    broadcastExecuted: Boolean(context.broadcastExecuted),
    broadcastSkippedReason: context.broadcastSkippedReason ?? null,
    walletSnapshots: context.walletSnapshots ?? [],
    taskId: decision.taskId,
    taskType: decision.taskType,
    goal: decision.goal,
    urgency: decision.urgency,
    risk: decision.risk,
    decision: decision.decision,
    summary: decision.summary,
    selectedModel: decision.selectedModel,
    economics: decision.economics,
    budgets: decision.budgets,
    reasons: decision.reasons,
    treasuryDelta: {
      inferenceSpentUsd: Number((Number(treasuryAfter.spentToday.inferenceUsd ?? 0) - Number(treasuryBefore.spentToday.inferenceUsd ?? 0)).toFixed(4)),
      executionSpentUsd: Number((Number(treasuryAfter.spentToday.executionUsd ?? 0) - Number(treasuryBefore.spentToday.executionUsd ?? 0)).toFixed(4)),
      yieldAvailableUsd: Number((Number(treasuryAfter.yieldAvailableUsd ?? 0) - Number(treasuryBefore.yieldAvailableUsd ?? 0)).toFixed(4))
    },
    sourceDeltas,
    treasuryBefore,
    treasuryAfter,
    action: decision.action,
    liveExecution: context.liveExecution ?? null
  };
}
