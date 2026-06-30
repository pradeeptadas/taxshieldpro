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
  // Social Security wage base: 2026 = $184,500 (SSA contribution & benefit base).
  const SS_WAGE_BASE = 184500;
  function calcFICA(gross, addMedThreshold) {
    const ss = Math.min(gross, SS_WAGE_BASE) * 0.062;
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

  /* ── MACRS half-year-convention rate tables (GDS) ── */
  const MACRS_TABLES = {
    3:  [0.3333, 0.4445, 0.1481, 0.0741],
    5:  [0.20, 0.32, 0.192, 0.1152, 0.1152, 0.0576],
    7:  [0.1429, 0.2449, 0.1749, 0.1249, 0.0893, 0.0892, 0.0893, 0.0446],
    15: [0.05, 0.095, 0.0855, 0.0770, 0.0693, 0.0623, 0.0590, 0.0590,
         0.0591, 0.0590, 0.0591, 0.0590, 0.0591, 0.0590, 0.0591, 0.0295]
  };
  const MACRS_RATES = MACRS_TABLES[5]; // back-compat default

  function macrsSchedule(basis, margState, margCity, period = 5, discountRate = 0.05) {
    const rates = MACRS_TABLES[period] || MACRS_TABLES[5];
    let npv = 0;
    const rows = rates.map((r, i) => {
      const dep = basis * r;
      const savings = dep * (margState + margCity);
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

    const feat = stateConfig.features || {};
    const salary = inputs.salary || 0;
    const spouseSalary = (fs === "MFS") ? (inputs.spouseSalary || 0) : 0;
    const otherIncome = inputs.otherIncome || 0;
    const grossIncome = salary + spouseSalary + otherIncome;

    /* ── Investment strategies (with on/off toggles) ── */
    const bhOn = inputs.bhOn !== false;
    const bhCash = bhOn ? (inputs.bhCash || 0) : 0;
    const bhLeverage = inputs.bhLeverage || 3;
    const bhLoss = bhCash * bhLeverage;

    const filmOn = inputs.filmOn !== false;
    const matPart = inputs.matPart !== false;
    const filmCash = (filmOn && matPart) ? (inputs.filmCash || 0) : 0;
    const filmLeverage = inputs.filmLeverage || 3;
    const filmLoss = filmCash * filmLeverage;

    const solarOn = inputs.solarOn !== false;
    const solarEquity = solarOn ? (inputs.solarEquity || 0) : 0;
    const solarLeverage = inputs.solarLeverage || 5;
    const solarITCRate = inputs.solarITCRate || 0.30;
    const solarAsset = solarEquity * solarLeverage;
    const solarITC = solarAsset * solarITCRate;
    const solarBasis = solarAsset - solarITC * 0.5; // §50(c): basis reduced by 50% of ITC
    // Year-1 depreciable loss = depreciable basis × bonus-depreciation fraction.
    // Default assumes 100% bonus depreciation on the full (post-ITC) basis.
    const solarNonDeprFraction = inputs.solarNonDeprFraction || 0;
    const solarLoss = Math.max(solarBasis * (1 - solarNonDeprFraction), 0);

    /* ── AGI before strategies ── */
    const agiGross = grossIncome;

    /* ── EBL allocation (Film → Solar → BH) — must come before charitable ── */
    const mfsBoth = (fs === "MFS") && inputs.mfsBothSpouses;
    const eblCap = mfsBoth ? (b.eblBoth || b.ebl * 2) : b.ebl;
    const totalLoss = bhLoss + filmLoss + solarLoss;
    const eblDed = Math.min(totalLoss, eblCap);
    const eblFilm = Math.min(filmLoss, eblDed);
    const eblSolar = Math.min(solarLoss, Math.max(eblDed - eblFilm, 0));
    const eblBH = Math.max(eblDed - eblFilm - eblSolar, 0);
    const eblTotal = eblFilm + eblSolar + eblBH;
    const nolCF = Math.max(totalLoss - eblCap, 0);

    /* Per-strategy NOL carryforward = each strategy's loss beyond its EBL-deducted slice.
       Used to keep decoupled (MACRS) strategies' losses out of state year-2 income. */
    const nolFilm  = Math.max(filmLoss  - eblFilm,  0);
    const nolSolar = Math.max(solarLoss - eblSolar, 0);
    const nolBH    = Math.max(bhLoss    - eblBH,    0);

    /* ── Charitable: Max mode uses post-EBL AGI for 60% cap ── */
    const charMaxMode = inputs.charMaxMode || false;
    const charLevLeverage = inputs.charLevLeverage || 3;
    const agiBeforeChar = agiGross - eblTotal;
    const charLimit = agiBeforeChar * 0.60;
    let charCash = 0;
    let charDonation = 0;
    if (charMaxMode) {
      charDonation = charLimit;
      charCash = charLevLeverage > 0 ? charDonation / charLevLeverage : 0;
    } else {
      charCash = inputs.charLevCash || 0;
      charDonation = charCash * charLevLeverage;
    }
    const charUsed = Math.min(charDonation, charLimit);
    const charExcessCF = Math.max(charDonation - charLimit, 0);

    /* ── Deductions ── */
    const dedType = inputs.dedType || "ITEMIZED";
    const mortgage = inputs.mortgage || 0;
    const propTax = inputs.propTax || 0;
    const stateLocal = inputs.stateLocal || 0;
    const charitableCash = inputs.charitableCash || 0;
    const otherDeductions = inputs.otherDeductions || 0;
    // OBBBA SALT cap with high-income phase-down (2026):
    //   nominal $40,400 ($20,200 MFS), reduced 30% of MAGI over $505,000
    //   ($252,500 MFS), floored at $10,000 ($5,000 MFS).
    const saltMagi = Math.max(agiGross - eblTotal, 0);
    const saltNominal   = fs === "MFS" ? 20200  : 40400;
    const saltThreshold = fs === "MFS" ? 252500 : 505000;
    const saltFloor     = fs === "MFS" ? 5000   : 10000;
    const saltCap = Math.max(saltFloor, saltNominal - 0.30 * Math.max(saltMagi - saltThreshold, 0));
    const saltUsed = Math.min(propTax + stateLocal, saltCap);
    const itemized = saltUsed + mortgage + charitableCash + charUsed + otherDeductions;
    const fedDeduction = (dedType === "STANDARD") ? b.fedStd : itemized;
    const usingStandard = dedType === "STANDARD";

    /* ── State deduction ── */
    const stateStd = b.stateStd || 0;
    const stateItemizedMinusSalt = usingStandard ? 0 : Math.max(itemized - saltUsed, 0);
    const stateDeduction = Math.max(stateItemizedMinusSalt, stateStd);

    /* ── Federal taxable income ── */
    const agi = agiGross - eblTotal;
    const fedTaxableIncome = Math.max(agi - fedDeduction, 0);
    const fedTaxGross = bracketTax(fedTaxableIncome, b.fed);

    /* ── Solar ITC applied ── */
    const itcApplied = Math.min(solarITC, fedTaxGross);
    const itcCarryforward = Math.max(solarITC - fedTaxGross, 0);
    const fedTaxNet = fedTaxGross - itcApplied;

    /* ── Per-strategy state treatment ──
       FLOW  = "Bonus Depr": state conforms, full deduction flows through year 1.
       MACRS = state decouples, loss added back year 1 & recovered via MACRS.
       NONE  = "Not Allowed": loss added back year 1, no recovery at all.
       Inputs override the state's defaults; state defaults derive from features. */
    const st = stateConfig.stateTreatment || {};
    const defTreat = (key, flowDefault) =>
      inputs[key] || st[key === "bhTreatment" ? "bh" : key === "solarTreatment" ? "solar" : "film"] || flowDefault;
    const treatBH    = feat.hasNoIncomeTax ? "FLOW" : defTreat("bhTreatment",    feat.decouplesBonusDepreciation ? "MACRS" : "FLOW");
    const treatSolar = feat.hasNoIncomeTax ? "FLOW" : defTreat("solarTreatment", feat.decouplesBonusDepreciation ? "MACRS" : "FLOW");
    const treatFilm  = feat.hasNoIncomeTax ? "FLOW" : defTreat("filmTreatment",  feat.filmFlowsThrough ? "FLOW" : (feat.decouplesBonusDepreciation ? "MACRS" : "FLOW"));

    /* ── State tax: add back the EBL portion of each decoupled (MACRS or NONE) strategy ── */
    const addBackBH    = treatBH    !== "FLOW" ? eblBH    : 0;
    const addBackSolar = treatSolar !== "FLOW" ? eblSolar : 0;
    const addBackFilm  = treatFilm  !== "FLOW" ? eblFilm  : 0;
    const stateAddBack = addBackBH + addBackSolar + addBackFilm;
    const stateTaxableIncome = Math.max(agi + stateAddBack - stateDeduction, 0);

    /* ── City tax ── */
    const cityTaxableIncome = stateTaxableIncome; // same base

    /* ── State tax helper (flat rate / brackets + optional millionaire surtax) ── */
    const stateTaxFor = (taxable) => {
      if (feat.hasNoIncomeTax) return 0;
      let t = 0;
      if (stateConfig.calcStateTax) {
        t = stateConfig.calcStateTax(taxable, b);
      } else if (feat.flatRate) {
        t = taxable * feat.flatRate;
      } else if (b.state) {
        t = bracketTax(taxable, b.state);
      }
      // e.g. Massachusetts 4% surtax on income over ~$1.1M
      if (feat.surtaxRate && feat.surtaxThreshold) {
        t += Math.max(taxable - feat.surtaxThreshold, 0) * feat.surtaxRate;
      }
      return t;
    };

    /* ── State/city tax calculation ── */
    const stateTax = stateTaxFor(stateTaxableIncome);

    const cityTaxOn = inputs.cityTaxOn !== false; // default true for backward compat
    let cityTax = 0;
    if (cityTaxOn) {
      if (stateConfig.calcCityTax) {
        cityTax = stateConfig.calcCityTax(cityTaxableIncome, b);
      } else if (b.city) {
        cityTax = bracketTax(cityTaxableIncome, b.city);
      }
    }

    /* ── FICA ── */
    const fica = calcFICA(salary, b.addMedThreshold);
    const spouseFica = (fs === "MFS" && spouseSalary > 0)
      ? calcFICA(spouseSalary, b.addMedThreshold)
      : { ss: 0, med: 0, addMed: 0, total: 0 };

    /* ── Totals ── */
    const totalTax = fedTaxNet + stateTax + cityTax + fica.total + spouseFica.total;

    /* ── Baseline (no strategies) — standard deductions ── */
    const baseAGI = agiGross;
    const baseFedTaxable = Math.max(baseAGI - b.fedStd, 0);
    const baseFedTax = bracketTax(baseFedTaxable, b.fed);
    const baseStateTaxable = Math.max(baseAGI - stateStd, 0);
    const baseStateTax = stateTaxFor(baseStateTaxable);
    const baseCityTax = (cityTaxOn && b.city) ? bracketTax(baseStateTaxable, b.city) : 0;
    const baseTotalTax = baseFedTax + baseStateTax + baseCityTax + fica.total + spouseFica.total;
    const yr1Savings = baseTotalTax - totalTax;

    /* ── Year 2 (NOL carryforward + solar ITC recapture) ── */
    const yr2Salary = inputs.yr2Salary || salary;
    const yr2SpouseSalary = (fs === "MFS") ? (inputs.yr2SpouseSalary || spouseSalary) : 0;
    const yr2OtherIncome = inputs.yr2OtherIncome || 0;
    const yr2Gross = yr2Salary + yr2SpouseSalary + yr2OtherIncome;
    const yr2FedDed = b.fedStd;   // Year 2 uses standard deductions
    const yr2StateDed = stateStd;

    /* Federal NOL carryforward, limited to 80% of taxable income (§172(a)) */
    const yr2FedTaxableBeforeNOL = Math.max(yr2Gross - yr2FedDed, 0);
    const yr2NOLApplied = Math.min(nolCF, 0.80 * yr2FedTaxableBeforeNOL);
    const yr2NOLRemaining = nolCF - yr2NOLApplied;
    const yr2AGI = yr2Gross - yr2NOLApplied;
    const yr2FedTaxable = Math.max(yr2AGI - yr2FedDed, 0);
    const yr2FedTax = bracketTax(yr2FedTaxable, b.fed);
    const yr2ITCApplied = Math.min(itcCarryforward, yr2FedTax);

    /* Solar ITC recapture (§50(a)) — a year-2 increase in TAX on the credit (only on
       early disposition), NOT additional income. Rate defaults to 0 (asset held). */
    const solarRecaptureRate = inputs.solarRecaptureRate || 0;
    const solarRecaptureTax = solarOn ? solarITC * solarRecaptureRate : 0;
    const solarRecapture = solarRecaptureTax; // alias kept for UI/back-compat
    const yr2FedTaxNet = Math.max(yr2FedTax - yr2ITCApplied, 0) + solarRecaptureTax;

    /* State year 2: decoupled (MACRS) strategies do NOT get the NOL benefit at the
       state level — the state recovers them via MACRS instead. Only flow-through
       strategies' NOL reduces state income (no double-count with the MACRS schedule). */
    const nolStateFlow =
      (treatBH    === "FLOW" ? nolBH    : 0) +
      (treatSolar === "FLOW" ? nolSolar : 0) +
      (treatFilm  === "FLOW" ? nolFilm  : 0);
    const yr2StateTaxableBeforeNOL = Math.max(yr2Gross - yr2StateDed, 0);
    const yr2StateNOLApplied = Math.min(nolStateFlow, yr2StateTaxableBeforeNOL);
    const yr2StateTaxable = Math.max(yr2Gross - yr2StateNOLApplied - yr2StateDed, 0);
    const yr2StateTax = stateTaxFor(yr2StateTaxable);
    const yr2CityTax = (cityTaxOn && b.city) ? bracketTax(yr2StateTaxable, b.city) : 0;
    const yr2FICA = calcFICA(yr2Salary, b.addMedThreshold);
    const yr2SpouseFICA = (fs === "MFS" && yr2SpouseSalary > 0)
      ? calcFICA(yr2SpouseSalary, b.addMedThreshold)
      : { ss: 0, med: 0, addMed: 0, total: 0 };
    const yr2TotalTax = yr2FedTaxNet + yr2StateTax + yr2CityTax + yr2FICA.total + yr2SpouseFICA.total;

    /* Year 2 baseline (no strategies, no recapture, no NOL) — standard deductions */
    const yr2BaseGross = yr2Salary + yr2SpouseSalary + yr2OtherIncome;
    const yr2BaseFedTaxable = Math.max(yr2BaseGross - b.fedStd, 0);
    const yr2BaseFedTax = bracketTax(yr2BaseFedTaxable, b.fed);
    const yr2BaseStateTaxable = Math.max(yr2BaseGross - stateStd, 0);
    const yr2BaseStateTax = stateTaxFor(yr2BaseStateTaxable);
    const yr2BaseCityTax = (cityTaxOn && b.city) ? bracketTax(yr2BaseStateTaxable, b.city) : 0;
    const yr2BaseTotalTax = yr2BaseFedTax + yr2BaseStateTax + yr2BaseCityTax + yr2FICA.total + yr2SpouseFICA.total;
    const yr2Savings = yr2BaseTotalTax - yr2TotalTax;

    /* ── MACRS schedule (per-strategy + combined) ──
       Basis = the FULL depreciable loss of each MACRS-treated strategy (the asset
       the state depreciates), not just the EBL-deducted slice. The state recovers
       this over 6 years; the matching NOL is excluded from state year-2 income above. */
    const macrsBHBasis    = treatBH    === "MACRS" ? bhLoss    : 0;
    const macrsSolarBasis = treatSolar === "MACRS" ? solarLoss : 0;
    const macrsFilmBasis  = treatFilm  === "MACRS" ? filmLoss  : 0;
    const macrsBasis = macrsBHBasis + macrsSolarBasis + macrsFilmBasis;
    // Per-strategy recovery period (years). Solar is 5-year property by default.
    const macrsBHYears    = inputs.macrsBHYears    || 5;
    const macrsSolarYears = inputs.macrsSolarYears || 5;
    const macrsFilmYears  = inputs.macrsFilmYears  || 5;
    const margState = b.state ? marginalRate(stateTaxableIncome, b.state) : (feat.flatRate || 0);
    const margCity = (cityTaxOn && b.city) ? marginalRate(cityTaxableIncome, b.city) : 0;
    const emptyMacrs = { rows: [], npv: 0, totalDep: 0, totalSavings: 0 };
    const mkMacrs = (basis, period) => basis > 0 ? macrsSchedule(basis, margState, margCity, period) : emptyMacrs;
    const macrsBH    = mkMacrs(macrsBHBasis,    macrsBHYears);
    const macrsSolar = mkMacrs(macrsSolarBasis, macrsSolarYears);
    const macrsFilm  = mkMacrs(macrsFilmBasis,  macrsFilmYears);
    // Combined uses solar's period as a representative for the multi-year recovery row.
    const macrs = mkMacrs(macrsBasis, macrsSolarYears);

    /* ── Combined 2-year ── */
    const combined2YrSavings = yr1Savings + yr2Savings;
    const totalCashInvested = bhCash + filmCash + solarEquity + charCash;
    const roi = totalCashInvested > 0 ? combined2YrSavings / totalCashInvested : 0;

    return {
      // Inputs echo
      filingStatus: fs, grossIncome, salary, spouseSalary, otherIncome,

      // Deductions
      saltUsed, itemized, fedDeduction, usingStandard, stateDeduction,

      // Strategies
      bhOn, bhLoss, filmOn, matPart, filmLoss,
      solarOn, solarAsset, solarITC, solarBasis, solarLoss,
      charMaxMode, charCash, charDonation: charUsed, charExcessCF,

      // EBL
      eblCap, eblFilm, eblSolar, eblBH, eblTotal, nolCF,

      // Federal
      agi, fedTaxableIncome, fedTaxGross, itcApplied, itcCarryforward, fedTaxNet,

      // State
      stateAddBack, stateTaxableIncome, stateTax,
      treatBH, treatSolar, treatFilm, addBackBH, addBackSolar, addBackFilm,

      // City
      cityTaxableIncome, cityTax,

      // FICA
      fica, spouseFica,

      // Total
      totalTax, baseTotalTax, yr1Savings,

      // Year 2
      solarRecapture, solarRecaptureTax, yr2Gross, yr2NOLApplied, yr2NOLRemaining, yr2AGI,
      yr2FedTaxable, yr2FedTax, yr2FedTaxNet, yr2ITCApplied, yr2StateNOLApplied,
      yr2StateTaxable, yr2StateTax, yr2CityTax, yr2FICA, yr2SpouseFICA,
      yr2TotalTax, yr2BaseTotalTax, yr2Savings,

      // MACRS
      macrs, macrsBH, macrsSolar, macrsFilm, macrsBasis, margState, margCity,
      macrsBHBasis, macrsSolarBasis, macrsFilmBasis,
      macrsBHYears, macrsSolarYears, macrsFilmYears,

      // Combined
      combined2YrSavings, totalCashInvested, roi,

      // Bracket detail (for tables)
      fedBrackets: b.fed, stateBrackets: b.state, cityBrackets: b.city,
      fedStd: b.fedStd, stateStd: stateStd
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
