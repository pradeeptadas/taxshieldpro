/* ═══════════════════════════════════════════════════════
   TaxShield Pro — Calculation Engine Unit Tests
   Reference numbers from TaxSavvyNYC calculator
   ═══════════════════════════════════════════════════════ */

const TaxEngine = require("../js/calc-engine");
const NY_CONFIG = require("../js/states/ny");

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

console.log("\n══ Default Scenario: $1.3M MFJ, All Strategies ══\n");

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

test("NYS Taxable Income = $307,200", () => {
  assertClose(r.nysTaxableIncome, 307200, "nysTaxableIncome", 2);
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

test("NYS Tax = $16,985", () => {
  assertClose(r.nysTax, 16985, "nysTax", 2);
});

test("NYC Tax = $11,682", () => {
  assertClose(r.nycTax, 11682, "nycTax", 2);
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

console.log("\n══ No Strategies (all OFF) ══\n");

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

test("Total Tax close to base tax (~$563,710)", () => {
  assertClose(ns.totalTax, 563710, "totalTax", 500);
});

test("Year 1 Savings ~= $0", () => {
  assertClose(ns.yr1Savings, 0, "yr1Savings", 500);
});

// ═══════════════════════════════════════════════════════
// Single filer — $500K salary, no strategies
// ═══════════════════════════════════════════════════════

console.log("\n══ Single Filer $500K, No Strategies ══\n");

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
// Summary
// ═══════════════════════════════════════════════════════

console.log(`\n══ Results: ${passed} passed, ${failed} failed ══\n`);
process.exit(failed > 0 ? 1 : 0);
