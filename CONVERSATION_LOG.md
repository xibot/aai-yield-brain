# Yield Brain Conversation Log

## March 21, 2026 - Choosing Project #3

After shipping `aaigotchi-wallet-agency` and `Rare SynETHsis`, the collaboration turned to a third project for Synthesis.

The goal was to find something that matched what Bankr was actually rewarding instead of building a generic third demo. The collaboration explored multiple directions, including a multi-model onchain execution service and a more novel treasury allocator.

The human pressed on the most important question early: any new system should not make the `aaigotchi` wallet vulnerable to prompt injection, public drain attempts, or arbitrary outside control.

That concern pushed the collaboration toward a treasury-judgment system rather than an open public executor.

## Naming and Core Thesis

The project first took shape as `AAi Budget Brain`, then `AAi Treasury Brain`, and finally settled into `Yield Brain` after the human identified `Brain` as the strongest naming anchor and preferred `Yield` over the drier financial alternatives.

The project summary the team settled on was:

`Yield Brain is a Bankr-native autonomous treasury brain that turns yield into bounded agent operating power. It is the economic judgment layer inside aaigotchi: it manages yield, decides when a task is worth paying inference for, and only executes onchain when the expected value justifies the spend.`

## System Design

The collaboration defined `Yield Brain` as an internal `aaigotchi` subsystem rather than a separate public agent product.

That distinction mattered. The human explicitly wanted to avoid a system where arbitrary external prompts could become arbitrary onchain actions. The resulting design treats outside interaction as optional and keeps the execution surface narrow.

Three layers were formalized:

1. `aaigotchi` as the identity and goal layer
2. `Yield Brain` as the economic judgment layer
3. `Bankr` as the signing and execution rail

## Treasury Policy

The collaboration then locked the treasury into three explicit source buckets:

1. `protocol_fees`
2. `art_surplus`
3. `wsteth_core_yield`

The human wanted the treasury model to be grounded and conservative. The resulting policy was:

- spend fee income first
- spend art surplus second
- spend staking yield last
- keep `wstETH` principal protected and never directly spendable

The human also asked what each source really meant, especially `wstETH` yield, protocol fees, and art proceeds. The final framing became:

- `protocol_fees` = system revenue routed back into the treasury
- `art_surplus` = a configured share of artist-net proceeds, not gross revenue
- `wsteth_core_yield` = yield-only operating power with principal locked

## Safety and Live Strategy

When the question turned to going live, the human correctly pushed on wallet separation and treasury safety.

Instead of jumping directly to a fully exposed live treasury, the collaboration defined a safer rollout:

- a protected `Revenue Wallet` kept separate
- a `Treasury Test Wallet` used for bounded live experiments
- a micro-treasury approach with tiny balances and allowlisted recipients
- no automatic public prompt-to-transaction path

That safety framing became part of the project's value: `Yield Brain` should know not only when to spend, but also when not to.

## MVP Implementation

The agent implemented the first working repo and scripts on the VM:

- policy-driven task evaluation
- model-tier routing across `cheap`, `planner`, and `critic`
- source-aware treasury derivation
- `execute`, `defer`, and `reject` decisions
- JSON proof outputs and receipts
- optional Bankr-native broadcast path for constrained native transfers

The demo proved the intended logic with four task outcomes:

- low-value task rejected
- art-funding task executed
- risky treasury rotation rejected on economics
- larger low-urgency funding task deferred to preserve the buffer

## Feature Expansion

The human then asked for the maximum-value product layer on top of the MVP. The chosen features were:

- `shadow` / `live` operating modes
- a `pauseSwitch`
- real wallet balance reading
- richer decision receipts

The agent implemented all four and hardened the real balance reader with multi-endpoint RPC fallback so tracked Ethereum and Base wallet snapshots were reliable in the proof flow.

## Wallet Labels and Repo Polish

The human wanted the wallet labels to stay neutral in the public materials. The project was cleaned up to use:

- `Revenue Wallet`
- `Treasury Test Wallet`

The public repo identity was also simplified from `AAi Yield Brain` to `Yield Brain`, while preserving `aaigotchi` as the surrounding system context.

## Public Packaging

After the feature pass, the project was packaged for public use:

- primary GitHub repo under `xibot/yield-brain`
- GitHub mirror under `aaigotchi/yield-brain`
- GitLab mirror under `aaigotchi/yield-brain`
- versioned release state aligned to `v0.3.0`
- README, submission page, Moltbook draft, and launch thread prepared

## Human Contribution Summary

The human contributed:

- the project direction for the third submission
- repeated pressure toward safe treasury architecture
- the naming refinement from budget/treasury framing to `Yield Brain`
- the policy emphasis on yield-only spending and protected principal
- the wallet separation and neutral wallet labels
- the prioritization of the max-value product features

## Agent Contribution Summary

The agent contributed:

- project concept synthesis
- treasury policy formalization
- safety model and rollout strategy
- MVP implementation
- feature implementation for modes, pause control, balance reading, and receipts
- repo packaging, public docs, and submission preparation

## Final State

`Yield Brain` is a working Bankr-native treasury-judgment MVP with real wallet snapshots, explicit treasury-source policy, constrained live controls, public repos, proof artifacts, and a submission-ready package for Synthesis project #3.
