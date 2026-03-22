# Yield Brain

## One-line description

Yield Brain is a Bankr-native autonomous treasury brain that turns yield into bounded agent operating power.

## Description

Yield Brain is the economic judgment layer inside `aaigotchi`. It manages yield, decides when a task is worth paying inference for, and only executes onchain when the expected value justifies the spend.

Instead of treating model calls and transactions as free, Yield Brain treats both as capital allocation problems. It estimates task value, reasoning cost, execution cost, and treasury impact before deciding whether to `execute`, `defer`, or `reject`.

## Problem statement

Most agent systems focus on whether an agent *can* act. Very few focus on whether it *should* spend to think and act.

That gap matters in production:

- inference has cost
- gas has cost
- low-value actions burn treasury
- protected capital should not be casually exposed
- autonomous agents need economic discipline, not just capability

Yield Brain addresses that gap by making treasury management an explicit decision layer.

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
- one bad treasury rotation rejected on economics
- one larger funding task deferred to preserve the yield buffer

The proof report also shows source consumption happening in the intended order: fee income is consumed first, while art surplus and staking yield remain untouched when earlier sources are sufficient.

## Why it fits Synthesis / Bankr

Yield Brain is built around the exact question Bankr makes interesting: how should an autonomous agent allocate scarce operating power?

Bankr remains the execution heart, but Yield Brain adds a real economic layer above it: the agent decides whether a task is worth the model cost and execution cost before any transaction is sent.

## Public repos

- primary: `https://github.com/xibot/yield-brain`
- mirror: `https://github.com/aaigotchi/yield-brain`
- gitlab: `https://gitlab.com/aaigotchi/yield-brain`
