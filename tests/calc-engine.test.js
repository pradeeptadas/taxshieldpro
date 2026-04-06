/* ═══════════════════════════════════════════════════════
   TaxShield Pro — Calculation Engine Unit Tests
   Reference numbers from TaxSavvyNYC calculator
   ═══════════════════════════════════════════════════════ */

const TaxEngine = require("../js/calc-engine");
const NY_CONFIG = require("../js/states/ny");
const StateRegistry = require("../js/states/registry");

function assert(condition, msg) {
  if (!condition) throw new Error("FAIL: " + msg);
}

function assertClose(actual, expected, label, tolerance = 1) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`FAIL: ${label} — expected ${expected}, got ${actual} (diff: ${actual - expected})`);
  }
}

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
  }
}

// ═══════════════════════════════════════════════════════
// Default scenario: $1.3M MFJ, all strategies ON
// Reference: TaxSavvyNYC with same inputs
// ═══════════════════════════════════════════════════════

const DEFAULT_INPUTS = {
  filingStatus: "MFJ",
  salary: 1300000,
  spouseSalary: 0,
  otherIncome: 0,
  dedType: "ITEMIZED",
  mortgage: 15000,
  propTax: 0,
  stateLocal: 25000,
  charitableCash: 0,
  otherDeductions: 5000,
  bhOn: true,
  bhCash: 130000,
  bhLeverage: 5,
  filmOn: true,
  matPart: true,
  filmCash: 100000,
  filmLeverage: 5,
  solarOn: true,
  solarEquity: 77000,
  solarLeverage: 2.66,
  solarITCRate: 0.36,
  charMaxMode: true,
  charLevLeverage: 6,
  charLevCash: 0,
};

console.log("\n══ Default Scenario: $1.3M MFJ, All Strategies (NY) ══\n");

const r = TaxEngine.calculate(DEFAULT_INPUTS, NY_CONFIG);

// --- Strategy Losses ---
test("Gross Income = $1,300,000", () => {
  assertClose(r.grossIncome, 1300000, "grossIncome");
});

test("Box House Loss = $650,000", () => {
  assertClose(r.bhLoss, 650000, "bhLoss");
});

test("Film §181 Loss = $500,000", () => {
  assertClose(r.filmLoss, 500000, "filmLoss");
});

test("Solar Asset = $204,820", () => {
  assertClose(r.solarAsset, 204820, "solarAsset");
});

test("Solar ITC = $73,735", () => {
  assertClose(r.solarITC, 73735, "solarITC", 2);
});

test("Solar Basis = $167,952", () => {
  assertClose(r.solarBasis, 167952, "solarBasis", 2);
});

test("Solar Loss = $164,320 (adjusted)", () => {
  assertClose(r.solarLoss, 164320, "solarLoss", 2);
});

// --- EBL Allocation ---
test("EBL Film = $500,000", () => {
  assertClose(r.eblFilm, 500000, "eblFilm");
});

test("EBL Solar = $12,000", () => {
  assertClose(r.eblSolar, 12000, "eblSolar", 2);
});

test("EBL Box House = $0", () => {
  assertClose(r.eblBH, 0, "eblBH");
});

test("EBL Total = $512,000", () => {
  assertClose(r.eblTotal, 512000, "eblTotal");
});

test("NOL Carryforward = $802,320", () => {
  assertClose(r.nolCF, 802320, "nolCF", 2);
});

// --- Charitable ---
test("Charitable Cash = $78,800", () => {
  assertClose(r.charCash, 78800, "charCash", 2);
});

test("Charitable Deduction = $472,800", () => {
  assertClose(r.charDonation, 472800, "charDonation", 2);
});

// --- AGI & Taxable Income ---
test("AGI = $788,000", () => {
  assertClose(r.agi, 788000, "agi");
});

test("Fed Taxable Income = $270,200", () => {
  assertClose(r.fedTaxableIncome, 270200, "fedTaxableIncome", 2);
});

test("State Taxable Income = $307,200", () => {
  assertClose(r.stateTaxableIncome, 307200, "stateTaxableIncome", 2);
});

// --- Taxes ---
test("Federal Tax (gross) = $50,066", () => {
  assertClose(r.fedTaxGross, 50066, "fedTaxGross", 2);
});

test("Solar ITC Applied = $50,066 (capped at fed tax)", () => {
  assertClose(r.itcApplied, 50066, "itcApplied", 2);
});

test("Federal Tax (net) = $0", () => {
  assertClose(r.fedTaxNet, 0, "fedTaxNet");
});

test("State Tax = $16,985", () => {
  assertClose(r.stateTax, 16985, "stateTax", 2);
});

test("City Tax = $11,682", () => {
  assertClose(r.cityTax, 11682, "cityTax", 2);
});

test("FICA = $39,218", () => {
  assertClose(r.fica.total, 39218, "fica", 2);
});

test("Total Tax (Year 1) = $67,885", () => {
  assertClose(r.totalTax, 67885, "totalTax", 2);
});

// --- Savings ---
test("Base Tax (no strategies) = $563,710", () => {
  assertClose(r.baseTotalTax, 563710, "baseTotalTax", 2);
});

test("Year 1 Savings = $495,825", () => {
  assertClose(r.yr1Savings, 495825, "yr1Savings", 2);
});

// --- Cash Outlay ---
test("Total Cash Invested = $385,800", () => {
  assertClose(r.totalCashInvested, 385800, "totalCashInvested", 2);
});

// ═══════════════════════════════════════════════════════
// Strategies OFF — should equal base tax
// ═══════════════════════════════════════════════════════

console.log("\n══ No Strategies (all OFF, NY) ══\n");

const noStratInputs = {
  ...DEFAULT_INPUTS,
  bhOn: false,
  filmOn: false,
  solarOn: false,
  charMaxMode: false,
  dedType: "STANDARD",
};

const ns = TaxEngine.calculate(noStratInputs, NY_CONFIG);

test("AGI = $1,300,000 (no strategies)", () => {
  assertClose(ns.agi, 1300000, "agi");
});

test("Total Tax = base tax = $563,710 (no strategies)", () => {
  assertClose(ns.totalTax, 563710, "totalTax", 2);
});

test("Year 1 Savings = $0 (no strategies)", () => {
  assertClose(ns.yr1Savings, 0, "yr1Savings", 2);
});

// ═══════════════════════════════════════════════════════
// Single filer — $500K salary, no strategies
// ═══════════════════════════════════════════════════════

console.log("\n══ Single Filer $500K, No Strategies (NY) ══\n");

const singleInputs = {
  filingStatus: "S",
  salary: 500000,
  otherIncome: 0,
  dedType: "STANDARD",
  mortgage: 0,
  propTax: 0,
  stateLocal: 0,
  charitableCash: 0,
  otherDeductions: 0,
  bhOn: false,
  filmOn: false,
  solarOn: false,
  charMaxMode: false,
};

const s = TaxEngine.calculate(singleInputs, NY_CONFIG);

test("Single AGI = $500,000", () => {
  assertClose(s.agi, 500000, "agi");
});

test("Single uses standard deduction", () => {
  assert(s.usingStandard === true, "should use standard deduction");
});

test("Single FICA SS capped at $176,100 wage base", () => {
  assertClose(s.fica.ss, 176100 * 0.062, "fica.ss", 1);
});

// ═══════════════════════════════════════════════════════
// Pure bracket math validation
// ═══════════════════════════════════════════════════════

console.log("\n══ Bracket Math ══\n");

test("Federal bracket tax on $100,000 (MFJ)", () => {
  const brackets = NY_CONFIG.brackets.MFJ.fed;
  const tax = TaxEngine.bracketTax(100000, brackets);
  // 10% on 24800 + 12% on (100000 - 24800) = 2480 + 9024 = 11504
  assertClose(tax, 11504, "bracketTax 100k", 2);
});

test("FICA on $200,000 (under all thresholds)", () => {
  const fica = TaxEngine.calcFICA(200000, 250000);
  assertClose(fica.ss, 10918.2, "ss", 1); // min(200000, 176100) * 0.062
  assertClose(fica.med, 2900, "med", 1); // 200000 * 0.0145
  assertClose(fica.addMed, 0, "addMed"); // under threshold
});

test("FICA Additional Medicare on $300,000 (MFJ threshold $250K)", () => {
  const fica = TaxEngine.calcFICA(300000, 250000);
  assertClose(fica.addMed, 450, "addMed", 1); // (300000-250000) * 0.009
});

// ═══════════════════════════════════════════════════════
// Edge cases
// ═══════════════════════════════════════════════════════

console.log("\n══ Edge Cases ══\n");

test("Zero income produces zero tax", () => {
  const z = TaxEngine.calculate({ salary: 0, filingStatus: "MFJ", bhOn: false, filmOn: false, solarOn: false, charMaxMode: false, dedType: "STANDARD" }, NY_CONFIG);
  assertClose(z.totalTax, 0, "totalTax");
  assertClose(z.agi, 0, "agi");
});

test("Film OFF with matPart ON produces zero film loss", () => {
  const f = TaxEngine.calculate({ ...DEFAULT_INPUTS, filmOn: false }, NY_CONFIG);
  assertClose(f.filmLoss, 0, "filmLoss");
});

test("Film ON with matPart OFF produces zero film loss", () => {
  const f = TaxEngine.calculate({ ...DEFAULT_INPUTS, matPart: false }, NY_CONFIG);
  assertClose(f.filmLoss, 0, "filmLoss");
});

test("Solar OFF produces zero solar loss and ITC", () => {
  const sol = TaxEngine.calculate({ ...DEFAULT_INPUTS, solarOn: false }, NY_CONFIG);
  assertClose(sol.solarLoss, 0, "solarLoss");
  assertClose(sol.solarITC, 0, "solarITC");
});

test("Charitable custom mode with $0 cash = $0 donation", () => {
  const c = TaxEngine.calculate({ ...DEFAULT_INPUTS, charMaxMode: false, charLevCash: 0 }, NY_CONFIG);
  assertClose(c.charDonation, 0, "charDonation");
});

// ═══════════════════════════════════════════════════════
// Year 2 — All Strategies ON
// ═══════════════════════════════════════════════════════

console.log("\n══ Year 2 — All Strategies ON (NY) ══\n");

test("Year 2 solar recapture > 0 when solar ON", () => {
  assert(r.solarRecapture > 0, `solarRecapture should be > 0, got ${r.solarRecapture}`);
});

test("Year 2 NOL applied > 0 when strategies ON", () => {
  assert(r.yr2NOLApplied > 0, `yr2NOLApplied should be > 0, got ${r.yr2NOLApplied}`);
});

test("Year 2 total tax < base tax when strategies ON", () => {
  assert(r.yr2TotalTax < r.yr2BaseTotalTax, `yr2TotalTax ${r.yr2TotalTax} should be < yr2BaseTotalTax ${r.yr2BaseTotalTax}`);
});

test("Year 2 savings > 0 when strategies ON", () => {
  assert(r.yr2Savings > 0, `yr2Savings should be > 0, got ${r.yr2Savings}`);
});

// ═══════════════════════════════════════════════════════
// Year 2 — All Strategies OFF
// ═══════════════════════════════════════════════════════

console.log("\n══ Year 2 — All Strategies OFF (NY) ══\n");

test("Year 2 solar recapture = 0 when solar OFF", () => {
  assertClose(ns.solarRecapture, 0, "solarRecapture");
});

test("Year 2 NOL = 0 when no strategies", () => {
  assertClose(ns.nolCF, 0, "nolCF");
  assertClose(ns.yr2NOLApplied, 0, "yr2NOLApplied");
});

test("Year 2 savings = $0 when no strategies", () => {
  assertClose(ns.yr2Savings, 0, "yr2Savings", 2);
});

test("Year 2 total tax = Year 2 base tax when no strategies", () => {
  assertClose(ns.yr2TotalTax, ns.yr2BaseTotalTax, "yr2TotalTax vs yr2BaseTotalTax", 2);
});

test("Total cash invested = $0 when no strategies", () => {
  assertClose(ns.totalCashInvested, 0, "totalCashInvested");
});

test("Combined 2-year savings = $0 when no strategies", () => {
  assertClose(ns.combined2YrSavings, 0, "combined2YrSavings", 2);
});

// ═══════════════════════════════════════════════════════
// Cross-State Tests
// ═══════════════════════════════════════════════════════

console.log("\n══ Cross-State: No Income Tax (Florida) ══\n");

const FL_CONFIG = StateRegistry.get("FL");
const flInputs = { ...noStratInputs };
const fl = TaxEngine.calculate(flInputs, FL_CONFIG);

test("FL: no state tax", () => {
  assertClose(fl.stateTax, 0, "stateTax");
});

test("FL: no city tax", () => {
  assertClose(fl.cityTax, 0, "cityTax");
});

test("FL: total tax = federal + FICA only", () => {
  assertClose(fl.totalTax, fl.fedTaxNet + fl.fica.total, "totalTax", 2);
});

test("FL: total tax < NY total tax (same income)", () => {
  assert(fl.totalTax < ns.totalTax, `FL ${fl.totalTax} should be < NY ${ns.totalTax}`);
});

console.log("\n══ Cross-State: Flat Tax (Illinois 4.95%) ══\n");

const IL_CONFIG = StateRegistry.get("IL");
const ilInputs = { ...noStratInputs };
const il = TaxEngine.calculate(ilInputs, IL_CONFIG);

test("IL: state tax uses flat rate", () => {
  // IL: flat 4.95%, std deduction $5,250 MFJ
  const ilStd = IL_CONFIG.brackets.MFJ.stateStd;
  const expectedStateTaxable = Math.max(1300000 - ilStd, 0);
  const expectedStateTax = expectedStateTaxable * 0.0495;
  assertClose(il.stateTax, expectedStateTax, "stateTax", 2);
});

test("IL: no city tax", () => {
  assertClose(il.cityTax, 0, "cityTax");
});

console.log("\n══ Cross-State: California (progressive) ══\n");

const CA_CONFIG = StateRegistry.get("CA");
const caInputs = { ...noStratInputs };
const ca = TaxEngine.calculate(caInputs, CA_CONFIG);

test("CA: state tax > 0", () => {
  assert(ca.stateTax > 0, `CA stateTax should be > 0, got ${ca.stateTax}`);
});

test("CA: no city tax", () => {
  assertClose(ca.cityTax, 0, "cityTax");
});

test("CA: decouples bonus depreciation", () => {
  assert(CA_CONFIG.features.decouplesBonusDepreciation === true, "CA should decouple bonus depreciation");
});

console.log("\n══ Cross-State: Texas (no income tax) ══\n");

const TX_CONFIG = StateRegistry.get("TX");
const tx = TaxEngine.calculate(noStratInputs, TX_CONFIG);

test("TX: no state tax", () => {
  assertClose(tx.stateTax, 0, "stateTax");
});

test("TX: same fed tax as FL (same income, no strategies)", () => {
  assertClose(tx.fedTaxNet, fl.fedTaxNet, "fedTaxNet", 2);
});

console.log("\n══ Cross-State: NY with strategies ══\n");

const nyStrat = TaxEngine.calculate(DEFAULT_INPUTS, NY_CONFIG);

test("NY: state add-back > 0 (decouples bonus depreciation)", () => {
  assert(nyStrat.stateAddBack > 0, `stateAddBack should be > 0, got ${nyStrat.stateAddBack}`);
});

test("NY: MACRS basis = state add-back", () => {
  assertClose(nyStrat.macrsBasis, nyStrat.stateAddBack, "macrsBasis", 2);
});

console.log("\n══ Cross-State: FL with strategies ══\n");

const flStrat = TaxEngine.calculate(DEFAULT_INPUTS, FL_CONFIG);

test("FL: no state add-back (no decoupling)", () => {
  assertClose(flStrat.stateAddBack, 0, "stateAddBack");
});

test("FL: no state tax even with strategies", () => {
  assertClose(flStrat.stateTax, 0, "stateTax");
});

console.log("\n══ State Registry ══\n");

test("Registry has 51 entries (50 states + DC)", () => {
  assertClose(StateRegistry.allIds.length, 51, "allIds.length");
});

test("Registry get() returns null for invalid state", () => {
  assert(StateRegistry.get("XX") === null, "should return null for XX");
});

test("All registry configs have required fields", () => {
  for (const id of StateRegistry.allIds) {
    const cfg = StateRegistry.get(id);
    assert(cfg.id === id, `${id}: id mismatch`);
    assert(cfg.name, `${id}: missing name`);
    assert(cfg.brackets, `${id}: missing brackets`);
    assert(cfg.brackets.MFJ, `${id}: missing MFJ brackets`);
    assert(cfg.brackets.S, `${id}: missing S brackets`);
    assert(cfg.features !== undefined, `${id}: missing features`);
  }
});

test("All states produce valid tax with $500K MFJ no strategies", () => {
  const baseInputs = {
    filingStatus: "MFJ", salary: 500000, dedType: "STANDARD",
    bhOn: false, filmOn: false, solarOn: false, charMaxMode: false
  };
  for (const id of StateRegistry.allIds) {
    const cfg = StateRegistry.get(id);
    const result = TaxEngine.calculate(baseInputs, cfg);
    assert(!isNaN(result.totalTax), `${id}: totalTax is NaN`);
    assert(result.totalTax >= 0, `${id}: totalTax is negative: ${result.totalTax}`);
    assert(result.fedTaxNet >= 0, `${id}: fedTaxNet is negative`);
    assert(result.stateTax >= 0, `${id}: stateTax is negative`);
  }
});

// ═══════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════

console.log(`\n══ Results: ${passed} passed, ${failed} failed ══\n`);
process.exit(failed > 0 ? 1 : 0);
