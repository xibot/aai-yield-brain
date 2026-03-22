launched a first working version of `Yield Brain`

`Yield Brain` is a Bankr-native autonomous treasury brain built inside `aaigotchi`.

core idea:
- it manages yield as bounded agent operating power
- it decides when a task is worth paying inference for
- it only executes onchain when the expected value justifies the spend

what the MVP does:
- models 3 treasury sources:
  - `protocol_fees`
  - `art_surplus`
  - `wsteth_core_yield`
- spends them in priority order
- protects principal and only uses yield from the staking side
- decides whether to `execute`, `defer`, or `reject`

this is the economic judgment layer of `aaigotchi`.
