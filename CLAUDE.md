# TaxShield Pro

NYC income tax calculator for high-income W-2 earners. Live at https://pradeeptadas.github.io/taxshieldpro/

## Architecture

- `js/calc-engine.js` — Pure calculation engine (zero DOM). All tax math lives here.
- `js/states/ny.js` — NY bracket data & config
- `js/app.js` — UI wiring. Reads inputs, calls TaxEngine, updates DOM.
- `pages/calculator.html` — 2-column layout (left=inputs, right=results)
- `css/styles.css` — Styling, toggle switches, dark mode
- `tests/calc-engine.test.js` — 41 unit tests against TaxSavvyNYC reference

## Calculation Order (CRITICAL — do not change)

1. Gross income
2. Strategy losses (BH, Film, Solar)
3. EBL allocation (Film → Solar → BH)
4. Charitable 60% cap uses **post-EBL AGI** (`grossIncome - eblTotal`)
5. Deductions (itemized includes charitable)
6. AGI = `grossIncome - eblTotal` (charitable NOT subtracted from AGI)
7. Taxes
8. Base tax uses **standard deductions only** (`b.fedStd`, `b.stateStd`)
9. State deduction uses `b.stateStd` when dedType is STANDARD (no itemized bleed-through)

## Known Pitfalls — NEVER reintroduce

- Charitable cap must use post-EBL AGI, not gross income
- Charitable must NOT be subtracted from AGI
- Base tax: always uses standard deductions
- UI forces dedType=STANDARD when strategy mode is off
- State deduction: do NOT add back propTax
- EBL must be computed BEFORE charitable

## Current Model (post-2026-audit — do NOT revert to older behavior)

- **Solar loss** = `solarBasis * (1 - solarNonDeprFraction)`, default full basis
  (the old `+632 -4264` magic-number formula was removed deliberately).
- **SALT cap** = OBBBA 2026 phase-down in calc-engine (nominal $40,400 / $20,200 MFS,
  −30% of MAGI over $505k, floor $10k). NOT a flat $25k. `stateConfig.saltCap` is unused.
- **Per-strategy state treatment**: each of BH/Film/Solar is FLOW or MACRS, defaulting
  from `stateConfig.stateTreatment` (derived from `decouplesBonusDepreciation` /
  `filmFlowsThrough`), overridable via the UI "State Treatment" buttons.
- **MACRS basis** = the FULL depreciable loss of each MACRS-treated strategy
  (`macrsBHBasis`/`macrsSolarBasis`/`macrsFilmBasis`), NOT the EBL-deducted slice.
  `stateAddBack` (year-1 federal-deduction reversal = EBL slice) is a separate concept.
- **Decoupled NOL**: MACRS-treated strategies' NOL is excluded from state Year-2
  income (`nolStateFlow` = flow-through strategies only) to avoid double-counting
  with the MACRS recovery.
- **Solar recapture** = §50(a) ITC clawback, a Year-2 TAX on the credit
  (`solarITC * rate`), default rate 0. NOT added to income.
- **Federal** Single/MFS 37% bracket starts at $640,600; SS wage base $184,500.
- **MA** has a 4% surtax over $1,107,750 (flat-rate path adds it via `surtaxRate`).
- **Year-2 federal NOL** capped at 80% of taxable income (§172).

## Reference Numbers ($1.3M MFJ, all strategies, NY)

AGI $788,000 | Total Tax $68,406 | Base Tax $564,231 | Yr1 Savings $495,825

(Total/Base reflect the 2026 SS wage base of $184,500; savings delta is unchanged.)

## Testing — run before every push

```bash
/usr/local/bin/node tests/calc-engine.test.js
```

## Reference Calculator

TaxSavvyNYC at `/Users/pradeepta/Projects/taxsavvynyc/index.html` is the source of truth.

## Deployment

Push to `main` auto-deploys via GitHub Pages. gh CLI at `/tmp/gh/gh_2.89.0_macOS_arm64/bin/gh`.
