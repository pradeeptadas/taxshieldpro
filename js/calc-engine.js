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

  function macrsSchedule(basis, margState, margCity, discountRate = 0.05) {
    let npv = 0;
    const rows = MACRS_RATES.map((r, i) => {
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
    const solarBasis = solarAsset - solarITC * 0.5;
    const solarLoss = Math.max(solarBasis + 632 - 4264, 0); // adjusted for non-depreciable components

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
    const saltCap = stateConfig.saltCap || 25000;
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

    /* ── State tax ── */
    const stateAddBack = feat.decouplesBonusDepreciation ? (eblBH + eblSolar) : 0;
    const filmThru = feat.filmFlowsThrough ? eblFilm : 0;
    const stateTaxableIncome = Math.max(agi + stateAddBack - stateDeduction, 0);

    /* ── City tax ── */
    const cityTaxableIncome = stateTaxableIncome; // same base

    /* ── State/city tax calculation ── */
    let stateTax = 0;
    if (!feat.hasNoIncomeTax) {
      if (stateConfig.calcStateTax) {
        stateTax = stateConfig.calcStateTax(stateTaxableIncome, b);
      } else if (feat.flatRate) {
        stateTax = stateTaxableIncome * feat.flatRate;
      } else if (b.state) {
        stateTax = bracketTax(stateTaxableIncome, b.state);
      }
    }

    let cityTax = 0;
    if (stateConfig.calcCityTax) {
      cityTax = stateConfig.calcCityTax(cityTaxableIncome, b);
    } else if (b.city) {
      cityTax = bracketTax(cityTaxableIncome, b.city);
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
    let baseStateTax = 0;
    if (!feat.hasNoIncomeTax) {
      const baseStateTaxable = Math.max(baseAGI - stateStd, 0);
      if (stateConfig.calcStateTax) {
        baseStateTax = stateConfig.calcStateTax(baseStateTaxable, b);
      } else if (feat.flatRate) {
        baseStateTax = baseStateTaxable * feat.flatRate;
      } else if (b.state) {
        baseStateTax = bracketTax(baseStateTaxable, b.state);
      }
    }
    const baseStateTaxable = Math.max(baseAGI - stateStd, 0);
    const baseCityTax = b.city ? bracketTax(baseStateTaxable, b.city) : 0;
    const baseTotalTax = baseFedTax + baseStateTax + baseCityTax + fica.total + spouseFica.total;
    const yr1Savings = baseTotalTax - totalTax;

    /* ── Year 2 (NOL + recapture) ── */
    const yr2Salary = inputs.yr2Salary || salary;
    const yr2SpouseSalary = (fs === "MFS") ? (inputs.yr2SpouseSalary || spouseSalary) : 0;
    const yr2OtherIncome = inputs.yr2OtherIncome || 0;
    const solarRecaptureRate = inputs.solarRecaptureRate || 0.30;
    const solarRecapture = solarOn ? solarLoss * solarRecaptureRate : 0;
    const yr2Gross = yr2Salary + yr2SpouseSalary + yr2OtherIncome + solarRecapture;
    const yr2NOLApplied = Math.min(nolCF, yr2Gross);
    const yr2NOLRemaining = nolCF - yr2NOLApplied;
    const yr2AGI = yr2Gross - yr2NOLApplied;
    const yr2FedDed = b.fedStd; // Year 2 uses standard deductions
    const yr2FedTaxable = Math.max(yr2AGI - yr2FedDed, 0);
    const yr2FedTax = bracketTax(yr2FedTaxable, b.fed);
    const yr2ITCApplied = Math.min(itcCarryforward, yr2FedTax);
    const yr2FedTaxNet = yr2FedTax - yr2ITCApplied;
    const yr2StateDed = stateStd; // Year 2 uses standard deductions
    const yr2StateTaxable = Math.max(yr2AGI - yr2StateDed, 0);
    let yr2StateTax = 0;
    if (!feat.hasNoIncomeTax) {
      if (stateConfig.calcStateTax) {
        yr2StateTax = stateConfig.calcStateTax(yr2StateTaxable, b);
      } else if (feat.flatRate) {
        yr2StateTax = yr2StateTaxable * feat.flatRate;
      } else if (b.state) {
        yr2StateTax = bracketTax(yr2StateTaxable, b.state);
      }
    }
    const yr2CityTax = b.city ? bracketTax(yr2StateTaxable, b.city) : 0;
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
    let yr2BaseStateTax = 0;
    if (!feat.hasNoIncomeTax) {
      if (stateConfig.calcStateTax) {
        yr2BaseStateTax = stateConfig.calcStateTax(yr2BaseStateTaxable, b);
      } else if (feat.flatRate) {
        yr2BaseStateTax = yr2BaseStateTaxable * feat.flatRate;
      } else if (b.state) {
        yr2BaseStateTax = bracketTax(yr2BaseStateTaxable, b.state);
      }
    }
    const yr2BaseCityTax = b.city ? bracketTax(yr2BaseStateTaxable, b.city) : 0;
    const yr2BaseTotalTax = yr2BaseFedTax + yr2BaseStateTax + yr2BaseCityTax + yr2FICA.total + yr2SpouseFICA.total;
    const yr2Savings = yr2BaseTotalTax - yr2TotalTax;

    /* ── MACRS schedule ── */
    const macrsBasis = stateAddBack; // portions added back by state
    const margState = b.state ? marginalRate(stateTaxableIncome, b.state) : (feat.flatRate || 0);
    const margCity = b.city ? marginalRate(cityTaxableIncome, b.city) : 0;
    const macrs = macrsBasis > 0
      ? macrsSchedule(macrsBasis, margState, margCity)
      : { rows: [], npv: 0, totalDep: 0, totalSavings: 0 };

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
      stateAddBack, filmThru, stateTaxableIncome, stateTax,

      // City
      cityTaxableIncome, cityTax,

      // FICA
      fica, spouseFica,

      // Total
      totalTax, baseTotalTax, yr1Savings,

      // Year 2
      solarRecapture, yr2Gross, yr2NOLApplied, yr2NOLRemaining, yr2AGI,
      yr2FedTaxable, yr2FedTax, yr2FedTaxNet, yr2ITCApplied,
      yr2StateTaxable, yr2StateTax, yr2CityTax, yr2FICA, yr2SpouseFICA,
      yr2TotalTax, yr2BaseTotalTax, yr2Savings,

      // MACRS
      macrs, macrsBasis, margState, margCity,

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
