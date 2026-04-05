/* ═══════════════════════════════════════════════════════
   TaxShield Pro — Calculation Engine
   Pure functions, zero DOM dependency.
   Import a state config (e.g. states/ny.js) and pass it in.
   ═══════════════════════════════════════════════════════ */

const TaxEngine = (() => {
  "use strict";

  /* ── Progressive bracket tax ── */
  function bracketTax(income, brackets) {
    let tax = 0, prev = 0;
    for (const [limit, rate] of brackets) {
      const taxable = Math.max(Math.min(income, limit) - prev, 0);
      tax += taxable * rate;
      prev = limit;
      if (income <= limit) break;
    }
    return tax;
  }

  /* ── Find marginal rate ── */
  function marginalRate(income, brackets) {
    for (const [limit, rate] of brackets) {
      if (income <= limit) return rate;
    }
    return brackets[brackets.length - 1][1];
  }

  /* ── FICA (employee side) ── */
  function calcFICA(gross, addMedThreshold) {
    const ss = Math.min(gross, 176100) * 0.062;
    const med = gross * 0.0145;
    const addMed = Math.max(gross - addMedThreshold, 0) * 0.009;
    return { ss, med, addMed, total: ss + med + addMed };
  }

  /* ── Build bracket detail rows (for display) ── */
  function bracketDetail(income, brackets) {
    const rows = [];
    let prev = 0, cumTax = 0;
    for (const [limit, rate] of brackets) {
      const lo = prev;
      const hi = limit === Infinity ? null : limit;
      const taxable = Math.max(Math.min(income, limit) - prev, 0);
      const tax = taxable * rate;
      cumTax += tax;
      const active = income > lo && (limit === Infinity || income <= limit || taxable > 0);
      rows.push({ lo, hi, rate, taxable, tax, cumTax, active: income > lo });
      prev = limit;
      if (income <= limit) break;
    }
    return rows;
  }

  /* ── MACRS 5-year half-year convention ── */
  const MACRS_RATES = [0.20, 0.32, 0.192, 0.1152, 0.1152, 0.0576];

  function macrsSchedule(basis, margNYS, margNYC, discountRate = 0.05) {
    let npv = 0;
    const rows = MACRS_RATES.map((r, i) => {
      const dep = basis * r;
      const savings = dep * (margNYS + margNYC);
      const pv = savings / Math.pow(1 + discountRate, i);
      npv += pv;
      return { year: i + 1, rate: r, depreciation: dep, savings, pv };
    });
    return { rows, npv, totalDep: basis, totalSavings: rows.reduce((s, r) => s + r.savings, 0) };
  }

  /* ═══════════════════════════════════════════════════
     Main calculation — takes flat inputs + state config
     ═══════════════════════════════════════════════════ */
  function calculate(inputs, stateConfig) {
    const fs = inputs.filingStatus || "MFJ";
    const b = stateConfig.brackets[fs];
    if (!b) throw new Error(`Unknown filing status: ${fs}`);

    const salary = inputs.salary || 0;
    const spouseSalary = (fs === "MFS") ? (inputs.spouseSalary || 0) : 0;
    const otherIncome = inputs.otherIncome || 0;
    const grossIncome = salary + spouseSalary + otherIncome;

    /* ── Deductions ── */
    const mortgage = inputs.mortgage || 0;
    const propTax = inputs.propTax || 0;
    const stateLocal = inputs.stateLocal || 0;
    const charitableCash = inputs.charitableCash || 0;
    const otherDeductions = inputs.otherDeductions || 0;
    const saltCap = stateConfig.saltCap || 25000;
    const saltUsed = Math.min(propTax + stateLocal, saltCap);
    const itemized = saltUsed + mortgage + charitableCash + otherDeductions;
    const fedDeduction = Math.max(itemized, b.fedStd);
    const usingStandard = fedDeduction === b.fedStd;

    /* ── NYS deduction ── */
    const nysItemizedMinusSalt = Math.max(itemized - saltUsed, 0) + propTax; // prop tax deductible at state level
    const nysDeduction = Math.max(nysItemizedMinusSalt, b.nysStd);

    /* ── Investment strategies ── */
    const bhCash = inputs.bhCash || 0;
    const bhLeverage = inputs.bhLeverage || 3;
    const bhLoss = bhCash * bhLeverage;

    const filmCash = inputs.filmCash || 0;
    const filmLeverage = inputs.filmLeverage || 3;
    const filmLoss = filmCash * filmLeverage;

    const solarEquity = inputs.solarEquity || 0;
    const solarLeverage = inputs.solarLeverage || 5;
    const solarITCRate = inputs.solarITCRate || 0.30;
    const solarAsset = solarEquity * solarLeverage;
    const solarITC = solarAsset * solarITCRate;
    const solarBasis = solarAsset - solarITC * 0.5;
    const solarLoss = solarBasis; // 100% bonus depreciation federal

    const charLevCash = inputs.charLevCash || 0;
    const charLevLeverage = inputs.charLevLeverage || 3;
    const charMaxMode = inputs.charMaxMode || false;
    let charDonation = charLevCash * charLevLeverage;

    /* ── AGI before strategies ── */
    const agiGross = grossIncome;

    /* ── Charitable 60% AGI limit ── */
    const charLimit = agiGross * 0.60;
    if (charMaxMode && charLevCash > 0) {
      charDonation = charLimit;
    }
    const charUsed = Math.min(charDonation, charLimit);
    const charExcessCF = Math.max(charDonation - charLimit, 0);

    /* ── EBL allocation (Film → Solar → BH) ── */
    const mfsBoth = (fs === "MFS") && inputs.mfsBothSpouses;
    const eblCap = mfsBoth ? (b.eblBoth || b.ebl * 2) : b.ebl;
    const totalLoss = bhLoss + filmLoss + solarLoss;
    const eblFilm = Math.min(filmLoss, eblCap);
    const eblSolar = Math.min(solarLoss, Math.max(eblCap - eblFilm, 0));
    const eblBH = Math.min(bhLoss, Math.max(eblCap - eblFilm - eblSolar, 0));
    const eblTotal = eblFilm + eblSolar + eblBH;
    const nolCF = Math.max(totalLoss - eblCap, 0);

    /* ── Federal taxable income ── */
    const agi = agiGross - eblTotal - charUsed;
    const fedTaxableIncome = Math.max(agi - fedDeduction, 0);
    const fedTaxGross = bracketTax(fedTaxableIncome, b.fed);

    /* ── Solar ITC applied ── */
    const itcApplied = Math.min(solarITC, fedTaxGross);
    const itcCarryforward = Math.max(solarITC - fedTaxGross, 0);
    const fedTaxNet = fedTaxGross - itcApplied;

    /* ── NY State ── */
    const nyAddBack = eblBH + eblSolar; // NY decouples bonus depreciation
    const filmThru = eblFilm; // Film flows through to NY
    const nysTaxableIncome = Math.max(agi + nyAddBack - nysDeduction, 0);

    /* ── NYC ── */
    const nycTaxableIncome = nysTaxableIncome; // same base

    /* ── State/city tax ── */
    const nysTax = stateConfig.calcStateTax
      ? stateConfig.calcStateTax(nysTaxableIncome, b)
      : bracketTax(nysTaxableIncome, b.nys);
    const nycTax = stateConfig.calcCityTax
      ? stateConfig.calcCityTax(nycTaxableIncome, b)
      : (b.nyc ? bracketTax(nycTaxableIncome, b.nyc) : 0);

    /* ── FICA ── */
    const fica = calcFICA(salary, b.addMedThreshold);
    const spouseFica = (fs === "MFS" && spouseSalary > 0)
      ? calcFICA(spouseSalary, b.addMedThreshold)
      : { ss: 0, med: 0, addMed: 0, total: 0 };

    /* ── Totals ── */
    const totalTax = fedTaxNet + nysTax + nycTax + fica.total + spouseFica.total;

    /* ── Baseline (no strategies) ── */
    const baseAGI = agiGross;
    const baseFedTaxable = Math.max(baseAGI - Math.max(itemized, b.fedStd), 0);
    const baseFedTax = bracketTax(baseFedTaxable, b.fed);
    const baseNYSTaxable = Math.max(baseAGI - nysDeduction, 0);
    const baseNYSTax = bracketTax(baseNYSTaxable, b.nys || []);
    const baseNYCTax = b.nyc ? bracketTax(baseNYSTaxable, b.nyc) : 0;
    const baseTotalTax = baseFedTax + baseNYSTax + baseNYCTax + fica.total + spouseFica.total;
    const yr1Savings = baseTotalTax - totalTax;

    /* ── Year 2 (NOL + recapture) ── */
    const yr2Salary = inputs.yr2Salary || salary;
    const yr2SpouseSalary = (fs === "MFS") ? (inputs.yr2SpouseSalary || spouseSalary) : 0;
    const yr2OtherIncome = inputs.yr2OtherIncome || 0;
    const solarRecaptureRate = inputs.solarRecaptureRate || 0.30;
    const solarRecapture = solarLoss * solarRecaptureRate;
    const yr2Gross = yr2Salary + yr2SpouseSalary + yr2OtherIncome + solarRecapture;
    const yr2NOLApplied = Math.min(nolCF, yr2Gross);
    const yr2NOLRemaining = nolCF - yr2NOLApplied;
    const yr2AGI = yr2Gross - yr2NOLApplied;
    const yr2FedTaxable = Math.max(yr2AGI - fedDeduction, 0);
    const yr2FedTax = bracketTax(yr2FedTaxable, b.fed);
    const yr2ITCApplied = Math.min(itcCarryforward, yr2FedTax);
    const yr2FedTaxNet = yr2FedTax - yr2ITCApplied;
    const yr2NYSTaxable = Math.max(yr2AGI - nysDeduction, 0);
    const yr2NYSTax = bracketTax(yr2NYSTaxable, b.nys || []);
    const yr2NYCTax = b.nyc ? bracketTax(yr2NYSTaxable, b.nyc) : 0;
    const yr2FICA = calcFICA(yr2Salary, b.addMedThreshold);
    const yr2SpouseFICA = (fs === "MFS" && yr2SpouseSalary > 0)
      ? calcFICA(yr2SpouseSalary, b.addMedThreshold)
      : { ss: 0, med: 0, addMed: 0, total: 0 };
    const yr2TotalTax = yr2FedTaxNet + yr2NYSTax + yr2NYCTax + yr2FICA.total + yr2SpouseFICA.total;

    /* Year 2 baseline (no strategies, no recapture, no NOL) */
    const yr2BaseGross = yr2Salary + yr2SpouseSalary + yr2OtherIncome;
    const yr2BaseFedTaxable = Math.max(yr2BaseGross - fedDeduction, 0);
    const yr2BaseFedTax = bracketTax(yr2BaseFedTaxable, b.fed);
    const yr2BaseNYSTaxable = Math.max(yr2BaseGross - nysDeduction, 0);
    const yr2BaseNYSTax = bracketTax(yr2BaseNYSTaxable, b.nys || []);
    const yr2BaseNYCTax = b.nyc ? bracketTax(yr2BaseNYSTaxable, b.nyc) : 0;
    const yr2BaseTotalTax = yr2BaseFedTax + yr2BaseNYSTax + yr2BaseNYCTax + yr2FICA.total + yr2SpouseFICA.total;
    const yr2Savings = yr2BaseTotalTax - yr2TotalTax;

    /* ── MACRS schedule ── */
    const macrsBasis = nyAddBack; // BH + Solar portions added back by NY
    const margNYS = marginalRate(nysTaxableIncome, b.nys || []);
    const margNYC = b.nyc ? marginalRate(nycTaxableIncome, b.nyc) : 0;
    const macrs = macrsBasis > 0
      ? macrsSchedule(macrsBasis, margNYS, margNYC)
      : { rows: [], npv: 0, totalDep: 0, totalSavings: 0 };

    /* ── Combined 2-year ── */
    const combined2YrSavings = yr1Savings + yr2Savings;
    const totalCashInvested = bhCash + filmCash + solarEquity + charLevCash;
    const roi = totalCashInvested > 0 ? combined2YrSavings / totalCashInvested : 0;

    return {
      // Inputs echo
      filingStatus: fs, grossIncome, salary, spouseSalary, otherIncome,

      // Deductions
      saltUsed, itemized, fedDeduction, usingStandard, nysDeduction,

      // Strategies
      bhLoss, filmLoss, solarAsset, solarITC, solarBasis, solarLoss,
      charDonation: charUsed, charExcessCF,

      // EBL
      eblCap, eblFilm, eblSolar, eblBH, eblTotal, nolCF,

      // Federal
      agi, fedTaxableIncome, fedTaxGross, itcApplied, itcCarryforward, fedTaxNet,

      // NY State
      nyAddBack, filmThru, nysTaxableIncome, nysTax,

      // NYC
      nycTaxableIncome, nycTax,

      // FICA
      fica, spouseFica,

      // Total
      totalTax, baseTotalTax, yr1Savings,

      // Year 2
      solarRecapture, yr2Gross, yr2NOLApplied, yr2NOLRemaining, yr2AGI,
      yr2FedTaxable, yr2FedTax, yr2FedTaxNet, yr2ITCApplied,
      yr2NYSTaxable, yr2NYSTax, yr2NYCTax, yr2FICA, yr2SpouseFICA,
      yr2TotalTax, yr2BaseTotalTax, yr2Savings,

      // MACRS
      macrs, macrsBasis, margNYS, margNYC,

      // Combined
      combined2YrSavings, totalCashInvested, roi,

      // Bracket detail (for tables)
      fedBrackets: b.fed, nysBrackets: b.nys, nycBrackets: b.nyc,
      fedStd: b.fedStd, nysStd: b.nysStd
    };
  }

  /* ── Public API ── */
  return {
    calculate,
    bracketTax,
    bracketDetail,
    marginalRate,
    calcFICA,
    macrsSchedule,
    MACRS_RATES
  };
})();

if (typeof module !== "undefined") module.exports = TaxEngine;
