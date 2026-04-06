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
8. Base tax uses **standard deductions only** (`b.fedStd`, `b.nysStd`)
9. Actual tax uses itemized only when `charUsed > 0`; otherwise falls back to standard

## Known Pitfalls — NEVER reintroduce

- Charitable cap must use post-EBL AGI, not gross income
- Charitable must NOT be subtracted from AGI
- Solar loss: `Math.max(solarBasis + 632 - 4264, 0)`
- Base tax: always uses standard deductions
- Actual tax: uses itemized only when charitable strategy is active (charUsed > 0), otherwise standard
- NYS deduction: do NOT add back propTax
- EBL must be computed BEFORE charitable

## Reference Numbers ($1.3M MFJ, all strategies)

AGI $788,000 | Total Tax $67,885 | Base Tax $563,710 | Yr1 Savings $495,825

## Testing — run before every push

```bash
/usr/local/bin/node tests/calc-engine.test.js
```

## Reference Calculator

TaxSavvyNYC at `/Users/pradeepta/Projects/taxsavvynyc/index.html` is the source of truth.

## Deployment

Push to `main` auto-deploys via GitHub Pages. gh CLI at `/tmp/gh/gh_2.89.0_macOS_arm64/bin/gh`.
