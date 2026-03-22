# AAi Yield Brain

`AAi Yield Brain` is a Bankr-native autonomous treasury brain that turns yield into bounded agent operating power. It is the economic judgment layer inside `aaigotchi`: it manages yield, decides when a task is worth paying inference for, and only executes onchain when the expected value justifies the spend.

This project is a strong candidate for a third Synthesis / Bankr submission because it is about **agent economics**, not just agent action. The core question is simple: an agent should not only know how to act onchain; it should know when thinking and acting are worth paying for.

## Core idea

Inside `aaigotchi`, we separate three concerns:

1. `aaigotchi` is the agent identity and goal layer.
2. `AAi Yield Brain` is the economic judgment layer.
3. `Bankr` is the execution rail.

So the flow becomes:

- a task or opportunity appears
- Yield Brain estimates value, cost, and risk
- Yield Brain chooses the cheapest adequate model tier
- Yield Brain decides `execute`, `defer`, or `reject`
- only approved actions reach Bankr

## Why this matters

Most agent demos assume inference and execution are free.

`AAi Yield Brain` treats both as capital allocation problems:

- model calls cost money
- gas costs money
- bad actions waste treasury
- autonomous agents need discipline, not just capability

The goal is a self-funding agent that lives off bounded operating yield instead of touching protected principal.

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

- treasury snapshot input
- policy-driven task evaluation
- three model tiers: `cheap`, `planner`, `critic`
- three decisions: `execute`, `defer`, `reject`
- sequential budget depletion across a demo queue
- optional Bankr broadcast for approved native-transfer tasks
- JSON decision receipts for every run

## Repo layout

- `config/policy.example.json`: baseline treasury / policy rails
- `examples/demo-scenario.json`: sample treasury state and tasks
- `scripts/lib.mjs`: decision engine and budget math
- `scripts/bankr.mjs`: Bankr config + broadcast adapter
- `scripts/run-demo.mjs`: queue demo that produces a full report
- `scripts/run-task.mjs`: evaluate one task and optionally broadcast it

## Quick start

No dependencies are required for the local demo beyond Node.js 18+.

```bash
cd /home/ubuntu/aai-yield-brain
npm run demo
npm run demo:proof
```

That will evaluate the sample task queue and write a full report to `outputs/` or `proof/demo-report.json`.

## Demo scenario

The sample scenario demonstrates four different outcomes:

1. a low-value ops task that gets rejected
2. an art-funding task that gets executed
3. a risky treasury rotation that gets rejected by economics
4. a larger low-urgency funding task that gets deferred to protect the yield buffer

This is the behavior we want: `aaigotchi` should not spend just because it can.

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

## What comes next

The natural next steps are:

1. add real yield source accounting (`wstETH`, protocol fees, or agent revenue)
2. add swap execution for approved treasury rebalances
3. add rolling treasury state instead of demo snapshots
4. connect `AAi Yield Brain` directly to `Rare SynETHsis` and future `aaigotchi` operations

That would complete the trilogy:

- `aaigotchi-wallet-agency` = agency
- `Rare SynETHsis` = culture
- `AAi Yield Brain` = sustainability
