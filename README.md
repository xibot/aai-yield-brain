# Yield Brain

`Yield Brain` is a Bankr-native autonomous treasury brain that turns yield into bounded agent operating power. It is the economic judgment layer inside `aaigotchi`: it manages yield, decides when a task is worth paying inference for, and only executes onchain when the expected value justifies the spend.

This project is a strong candidate for a third Synthesis / Bankr submission because it is about **agent economics**, not just agent action. The core question is simple: an agent should not only know how to act onchain; it should know when thinking and acting are worth paying for.

## Public repos

- primary: `xibot/yield-brain`
- mirror: `aaigotchi/yield-brain`
- gitlab: `aaigotchi/yield-brain`

## Core idea

Yield Brain now includes four product features that make the MVP feel much more real:

- `shadow` / `live` operating modes
- a policy-level pause switch
- real wallet balance snapshots for tracked wallets
- richer decision receipts with controls + source deltas


Inside `aaigotchi`, we separate three concerns:

1. `aaigotchi` is the agent identity and goal layer.
2. `Yield Brain` is the economic judgment layer.
3. `Bankr` is the execution rail.

So the flow becomes:

- a task or opportunity appears
- Yield Brain estimates value, cost, and risk
- Yield Brain chooses the cheapest adequate model tier
- Yield Brain decides `execute`, `defer`, or `reject`
- only approved actions reach Bankr

## Why this matters

Most agent demos assume inference and execution are free.

`Yield Brain` treats both as capital allocation problems:

- model calls cost money
- gas costs money
- bad actions waste treasury
- autonomous agents need discipline, not just capability

The goal is a self-funding agent that lives off bounded operating yield instead of touching protected principal.

## Yield-source model

The treasury is now source-aware instead of flat.

The demo treasury is derived from three explicit sources:

- `protocol_fees`: Bankr-native fee income routed back into the agent treasury
- `art_surplus`: 25% of artist-net `Rare SynETHsis` proceeds routed into ops
- `wsteth_core_yield`: protected staked principal with only the yield side spendable

Yield is spent in priority order, so the system consumes fee income first, art surplus second, and protected staking yield last.

## Safety model

This MVP is intentionally **not** a public prompt-to-wallet surface.

Key guardrails:

- allowlisted task types
- allowlisted assets
- allowlisted recipients
- max single-action spend
- daily inference and execution budgets
- minimum yield buffer
- minimum net value and value-multiple thresholds
- constrained execution surface: native transfer only for live Bankr broadcast in this MVP

That means outside prompts can influence proposals later, but they do not automatically define capability.

## MVP scope

The current MVP supports:

- source-aware treasury derivation
- policy-driven task evaluation
- three model tiers: `cheap`, `planner`, `critic`
- three decisions: `execute`, `defer`, `reject`
- sequential budget depletion across a demo queue
- optional Bankr broadcast for approved native-transfer tasks
- JSON decision receipts for every run

## Repo layout

- `config/policy.example.json`: baseline treasury / policy rails
- `examples/demo-scenario.json`: sample yield sources and tasks
- `scripts/lib.mjs`: decision engine and treasury math
- `scripts/derive-treasury.mjs`: derive the current treasury from explicit sources
- `scripts/bankr.mjs`: Bankr config + broadcast adapter
- `scripts/run-demo.mjs`: queue demo that produces a full report
- `scripts/run-task.mjs`: evaluate one task and optionally broadcast it

## Quick start

No dependencies are required for the local demo beyond Node.js 18+.

```bash
cd /home/ubuntu/aai-yield-brain
npm run treasury
npm run balances
npm run demo
npm run demo:proof
```

That will derive the treasury, read live wallet balances for the tracked wallets, and then evaluate the sample task queue into `outputs/` or `proof/demo-report.json`.

## Demo scenario

The sample scenario demonstrates four different outcomes:

1. a low-value ops task that gets rejected
2. an art-funding task that gets executed
3. a risky treasury rotation that gets rejected by economics
4. a larger low-urgency funding task that gets deferred to protect the yield buffer

This is the behavior we want: `aaigotchi` should not spend just because it can.

## Operating controls

The policy now supports two operating controls:

- `operatingMode`: `shadow` or `live`
- `pauseSwitch`: when `true`, all broadcasts are blocked even in `live` mode

`shadow` mode is the safe default. It evaluates tasks, updates simulated treasury state, and produces receipts without sending any transaction.

Use live evaluation without broadcasting:

```bash
node scripts/run-task.mjs --task-id yb-002 --mode live
```

Only request broadcast when you explicitly want a live action and the pause switch is off:

```bash
node scripts/run-task.mjs --task-id yb-002 --mode live --broadcast
```

## Live Bankr path

For live Bankr execution, create an `.env` from `.env.example` or rely on the VM's installed Bankr config.

```bash
cd /home/ubuntu/aai-yield-brain
cp .env.example .env
```

Then evaluate a single task:

```bash
node scripts/run-task.mjs --task-id yb-002
```

And, only if the decision is `execute`, broadcast it through Bankr:

```bash
node scripts/run-task.mjs --task-id yb-002 --broadcast
```

Current live constraint:

- only `native-transfer` tasks are broadcastable in this MVP
- swap-like tasks can still be evaluated and logged, but not broadcast yet
- live broadcasts are blocked automatically when `pauseSwitch` is enabled

## Tracked wallets

The repo now tracks live native balances for:

- `Revenue Wallet` on Ethereum mainnet
- `Treasury Test Wallet` on Base

Snapshots are attached to reports and task receipts, and can also be read directly:

```bash
npm run balances
```

## What comes next

The natural next steps are:

1. add live yield-source readers for `wstETH`, protocol fees, or agent revenue
2. add swap execution for approved treasury rebalances
3. add rolling treasury state instead of demo snapshots
4. connect `Yield Brain` directly to `Rare SynETHsis` and future `aaigotchi` operations

That would complete the trilogy:

- `aaigotchi-wallet-agency` = agency
- `Rare SynETHsis` = culture
- `Yield Brain` = sustainability
