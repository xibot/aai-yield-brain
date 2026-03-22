# Yield Brain

## One-line description

Yield Brain is a Bankr-native autonomous treasury brain that turns yield into bounded agent operating power.

## Description

Yield Brain is the economic judgment layer inside `aaigotchi`. It manages yield, decides when a task is worth paying inference for, and only executes onchain when the expected value justifies the spend.

Instead of treating model calls and transactions as free, Yield Brain treats both as capital allocation problems. It evaluates the value of a task, the cost of reasoning about it, the execution cost, and the effect on the treasury before deciding whether to `execute`, `defer`, or `reject`.

## Problem statement

Most agent systems focus on whether an agent *can* act, not whether it *should* spend to think and act. In practice, autonomous agents need treasury discipline:

- inference has cost
- gas has cost
- low-value actions waste budget
- protected capital should not be casually exposed

That leaves a gap for agent systems that are genuinely self-sustaining. Yield Brain addresses that gap by turning treasury management into an explicit decision layer.

## What makes it different

Yield Brain is source-aware.

It models three treasury sources with different operating roles:

1. `protocol_fees`
2. `art_surplus`
3. `wsteth_core_yield`

It spends them in priority order:

1. protocol fee income first
2. art surplus second
3. protected staking yield last

Protected `wstETH` principal is never spendable. Only the yield side is available.

## MVP scope

The current MVP ships:

- explicit yield-source treasury derivation
- policy-driven task evaluation
- three model tiers: `cheap`, `planner`, `critic`
- three decisions: `execute`, `defer`, `reject`
- optional Bankr broadcast for approved native-transfer tasks
- JSON proof receipts and treasury snapshots

## Demo result

The working demo shows:

- one low-value task rejected
- one art-funding task executed
- one bad swap rejected on economics
- one attractive task deferred to preserve the yield buffer

The proof report also shows source consumption happening in the intended order.

## Why it fits Synthesis / Bankr

Yield Brain is built around the exact question Bankr makes interesting: how should an autonomous agent allocate scarce operating power?

It uses Bankr as the execution heart, but adds a real economic layer above it: the agent decides whether a task is worth the model cost and execution cost before any transaction is sent.
