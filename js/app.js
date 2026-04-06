/* ═══════════════════════════════════════════════════════
   TaxShield Pro — App Controller
   DOM wiring, theme, premium gate, trial timer, I/O
   ═══════════════════════════════════════════════════════ */

const App = (() => {
  "use strict";

  /* ── State ── */
  let currentResult = null;
  let isPremium = false;
  const TRIAL_KEY = "tsp_trial_start";
  const TRIAL_MS = 24 * 60 * 60 * 1000; // 1 day

  /* ══════════════════════════════
     Theme
     ══════════════════════════════ */
  function initTheme() {
    const saved = localStorage.getItem("tsp_theme");
    if (saved) {
      document.documentElement.setAttribute("data-theme", saved);
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      document.documentElement.setAttribute("data-theme", "dark");
    }
    const btn = document.getElementById("themeToggle");
    if (btn) btn.addEventListener("click", toggleTheme);
    updateThemeIcon();
  }

  function toggleTheme() {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const next = isDark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("tsp_theme", next);
    updateThemeIcon();
  }

  function updateThemeIcon() {
    const btn = document.getElementById("themeToggle");
    if (!btn) return;
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    btn.textContent = isDark ? "☀️" : "🌙";
  }

  /* ══════════════════════════════
     Number formatting helpers
     ══════════════════════════════ */
  function fmt(n) {
    if (n == null || isNaN(n)) return "$0";
    const neg = n < 0;
    const abs = Math.abs(Math.round(n));
    const s = abs.toLocaleString("en-US");
    return neg ? `($${s})` : `$${s}`;
  }

  function pct(n) {
    return (n * 100).toFixed(2) + "%";
  }

  function V(id) {
    const el = document.getElementById(id);
    if (!el) return 0;
    return parseFloat(el.value.replace(/[,$\s]/g, "")) || 0;
  }

  function initNumInputs() {
    document.querySelectorAll(".num-input").forEach(el => {
      el.addEventListener("focus", () => {
        el.value = el.value.replace(/[,$\s]/g, "");
      });
      el.addEventListener("blur", () => {
        const n = parseFloat(el.value.replace(/[,$\s]/g, "")) || 0;
        el.value = n.toLocaleString("en-US");
      });
      // Format initial values
      const n = parseFloat(el.value.replace(/[,$\s]/g, "")) || 0;
      if (n > 0) el.value = n.toLocaleString("en-US");
    });
  }

  /* ══════════════════════════════
     Premium / Trial
     ══════════════════════════════ */
  function initTrial() {
    const start = localStorage.getItem(TRIAL_KEY);
    if (start) {
      const elapsed = Date.now() - parseInt(start, 10);
      isPremium = elapsed < TRIAL_MS;
    }
    updatePremiumUI();
    updateTrialBanner();
  }

  function startTrial() {
    localStorage.setItem(TRIAL_KEY, Date.now().toString());
    isPremium = true;
    updatePremiumUI();
    updateTrialBanner();
  }

  function updatePremiumUI() {
    document.querySelectorAll(".premium-only").forEach(el => {
      el.style.display = isPremium ? "" : "none";
    });
    document.querySelectorAll(".free-only").forEach(el => {
      el.style.display = isPremium ? "none" : "";
    });
    document.querySelectorAll(".premium-overlay .blurred").forEach(el => {
      el.classList.toggle("blurred", !isPremium);
    });
    const gate = document.getElementById("premiumGate");
    if (gate) gate.style.display = isPremium ? "none" : "";
  }

  function updateTrialBanner() {
    const banner = document.getElementById("trialBanner");
    if (!banner) return;
    const start = localStorage.getItem(TRIAL_KEY);
    if (!start || !isPremium) {
      banner.style.display = "none";
      return;
    }
    banner.style.display = "";
    const tick = () => {
      const remaining = TRIAL_MS - (Date.now() - parseInt(start, 10));
      if (remaining <= 0) {
        isPremium = false;
        banner.style.display = "none";
        updatePremiumUI();
        return;
      }
      const h = Math.floor(remaining / 3600000);
      const m = Math.floor((remaining % 3600000) / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      const timerEl = banner.querySelector(".timer");
      if (timerEl) timerEl.textContent = `${h}h ${m}m ${s}s`;
      requestAnimationFrame(tick);
    };
    tick();
  }

  /* ══════════════════════════════
     Filing Status
     ══════════════════════════════ */
  function initFilingStatus() {
    const sel = document.getElementById("filingStatus");
    if (!sel) return;

    const updateFilingUI = () => {
      const fs = sel.value;
      const isMFS = fs === "MFS";
      const spouseRow = document.getElementById("spouseRow");
      const yr2SpouseRow = document.getElementById("yr2SpouseRow");
      const mfsModeRow = document.getElementById("mfsModeRow");
      const eblInput = document.getElementById("eblDisplay");

      if (spouseRow) spouseRow.style.display = isMFS ? "" : "none";
      if (yr2SpouseRow) yr2SpouseRow.style.display = isMFS ? "" : "none";
      if (mfsModeRow) mfsModeRow.style.display = isMFS ? "" : "none";

      if (eblInput) {
        const b = NY_CONFIG.brackets[fs];
        if (isMFS) {
          const both = document.getElementById("mfsBoth")?.checked;
          const eblVal = both ? (b.eblBoth || b.ebl * 2) : b.ebl;
          eblInput.textContent = "$" + eblVal.toLocaleString() + (both ? " (both)" : " (one)");
        } else {
          eblInput.textContent = "$" + (b ? b.ebl.toLocaleString() : "512,000");
        }
      }
      recalculate();
    };

    sel.addEventListener("change", updateFilingUI);

    // MFS both/one toggle
    const mfsBothEl = document.getElementById("mfsBoth");
    if (mfsBothEl) mfsBothEl.addEventListener("change", updateFilingUI);
  }

  /* ══════════════════════════════
     Recalculate
     ══════════════════════════════ */
  function initDeductionType() {
    const sel = document.getElementById("dedType");
    if (!sel) return;
    sel.addEventListener("change", () => {
      const fields = document.getElementById("itemizedFields");
      if (fields) fields.style.display = sel.value === "STANDARD" ? "none" : "";
      recalculate();
    });
  }

  function recalculate() {
    const selVal = (id) => { const el = document.getElementById(id); return el ? el.value : null; };
    const stratOn = !!document.getElementById("strategyMaster")?.checked;

    // Update strategy toggles UI based on master toggle
    const stratToggles = document.getElementById("strategyToggles");
    if (stratToggles) stratToggles.style.opacity = stratOn ? "1" : "0.4";
    const detBtn = document.getElementById("strategyDetailToggle");
    if (detBtn) detBtn.style.display = stratOn ? "" : "none";
    const detPanel = document.getElementById("strategyDetails");
    if (detPanel && !stratOn) detPanel.style.display = "none";
    const dedEl = document.getElementById("dedType");
    if (dedEl) {
      if (!stratOn) dedEl.value = "STANDARD";
      dedEl.disabled = !stratOn;
    }

    const inputs = {
      filingStatus: selVal("filingStatus") || "MFJ",
      mfsBothSpouses: document.getElementById("mfsBoth")?.checked || false,
      salary: V("salary"),
      spouseSalary: V("spouseSalary"),
      otherIncome: V("otherIncome"),
      // Deductions — force standard when strategy mode is off
      dedType: stratOn ? (selVal("dedType") || "ITEMIZED") : "STANDARD",
      mortgage: V("mortgage"),
      propTax: V("propTax"),
      stateLocal: V("stateLocal"),
      charitableCash: 0, // charitable now in strategy section
      otherDeductions: V("otherDeductions"),
      // Premium strategies — master toggle gates everything
      bhOn: isPremium && stratOn ? !!document.getElementById("bhOn")?.checked : false,
      bhCash: isPremium && stratOn ? V("bhCash") : 0,
      bhLeverage: isPremium && stratOn ? V("bhLeverage") || 5 : 0,
      filmOn: isPremium && stratOn ? !!document.getElementById("filmOn")?.checked : false,
      matPart: isPremium && stratOn ? !!document.getElementById("matPart")?.checked : false,
      filmCash: isPremium && stratOn ? V("filmCash") : 0,
      filmLeverage: isPremium && stratOn ? V("filmLeverage") || 5 : 0,
      solarOn: isPremium && stratOn ? !!document.getElementById("solarOn")?.checked : false,
      solarEquity: isPremium && stratOn ? V("solarEquity") : 0,
      solarLeverage: isPremium && stratOn ? V("solarLeverage") || 5 : 0,
      solarITCRate: isPremium && stratOn ? (V("solarITCRate") / 100 || 0.30) : 0,
      charMaxMode: isPremium && stratOn ? selVal("charMode") === "MAX" : false,
      charLevCash: isPremium && stratOn ? V("charLevCash") : 0,
      charLevLeverage: isPremium && stratOn ? V("charLevLeverage") || 6 : 0,
      yr2Salary: V("yr2Salary") || V("salary"),
      yr2SpouseSalary: V("yr2SpouseSalary") || V("spouseSalary"),
      yr2OtherIncome: V("yr2OtherIncome"),
      solarRecaptureRate: V("solarRecaptureRate") / 100 || 0.30
    };

    try {
      currentResult = TaxEngine.calculate(inputs, NY_CONFIG);
      renderResults(currentResult);
    } catch (e) {
      console.error("Calculation error:", e);
    }
  }

  /* ══════════════════════════════
     Render Results
     ══════════════════════════════ */
  function renderResults(r) {
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    /* Income summary */
    set("outGross", fmt(r.grossIncome));
    set("outAGI", fmt(r.agi));
    set("outFedDeduction", fmt(r.fedDeduction));
    set("outFedTaxable", fmt(r.fedTaxableIncome));

    /* Strategies */
    set("outBHLoss", fmt(r.bhLoss));
    set("outFilmLoss", fmt(r.filmLoss));
    set("outSolarAsset", fmt(r.solarAsset));
    set("outSolarITC", fmt(r.solarITC));
    set("outSolarBasis", fmt(r.solarBasis));
    set("outSolarLoss", fmt(r.solarLoss));
    set("outCharCash", fmt(r.charCash));
    set("outCharDonation", fmt(r.charDonation));

    /* EBL */
    set("outEBLFilm", fmt(r.eblFilm));
    set("outEBLSolar", fmt(r.eblSolar));
    set("outEBLBH", fmt(r.eblBH));
    set("outEBLTotal", fmt(r.eblTotal));
    set("outNOLCF", fmt(r.nolCF));

    /* Taxes */
    set("outFedTaxGross", fmt(r.fedTaxGross));
    set("outITCApplied", fmt(r.itcApplied));
    set("outFedTaxNet", fmt(r.fedTaxNet));
    set("outNYAddBack", fmt(r.nyAddBack));
    set("outNYSTaxable", fmt(r.nysTaxableIncome));
    set("outNYSTax", fmt(r.nysTax));
    set("outNYCTax", fmt(r.nycTax));
    set("outFICA", fmt(r.fica.total));
    set("outTotalTax", fmt(r.totalTax));

    /* Savings */
    set("outBaseTax", fmt(r.baseTotalTax));
    set("outYr1Savings", fmt(r.yr1Savings));

    /* Year 2 */
    set("outYr2Gross", fmt(r.yr2Gross));
    set("outSolarRecapture", fmt(r.solarRecapture));
    set("outYr2NOL", fmt(r.yr2NOLApplied));
    set("outYr2AGI", fmt(r.yr2AGI));
    set("outYr2Tax", fmt(r.yr2TotalTax));
    set("outYr2BaseTax", fmt(r.yr2BaseTotalTax));
    set("outYr2Savings", fmt(r.yr2Savings));

    /* Combined */
    set("outCombinedSavings", fmt(r.combined2YrSavings));
    set("outTotalCash", fmt(r.totalCashInvested));
    set("outROI", (r.roi * 100).toFixed(0) + "%");

    /* Bracket tables */
    renderBracketTable("fedBracketBody", r.fedTaxableIncome, r.fedBrackets);
    renderBracketTable("nysBracketBody", r.nysTaxableIncome, r.nysBrackets);
    if (r.nycBrackets) renderBracketTable("nycBracketBody", r.nycTaxableIncome, r.nycBrackets);

    /* MACRS table */
    renderMACRS(r);
  }

  function renderBracketTable(tbodyId, income, brackets) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody || !brackets) return;
    const rows = TaxEngine.bracketDetail(income, brackets);
    tbody.innerHTML = rows.map(r => {
      const cls = r.active && r.taxable > 0 ? ' class="active-bracket"' : '';
      const hi = r.hi === null ? "No limit" : "$" + r.hi.toLocaleString();
      return `<tr${cls}>
        <td>$${r.lo.toLocaleString()}</td><td>${hi}</td>
        <td>${(r.rate * 100).toFixed(2)}%</td>
        <td>${fmt(r.taxable)}</td><td>${fmt(r.tax)}</td><td>${fmt(r.cumTax)}</td>
      </tr>`;
    }).join("");
  }

  function renderMACRS(r) {
    const tbody = document.getElementById("macrsBody");
    if (!tbody) return;
    if (!r.macrs || r.macrs.rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--muted)">No NY add-back — no MACRS recovery needed</td></tr>';
      return;
    }
    tbody.innerHTML = r.macrs.rows.map(row =>
      `<tr><td>Year ${row.year}</td><td>${(row.rate * 100).toFixed(2)}%</td>
       <td>${fmt(row.depreciation)}</td><td>${fmt(row.savings)}</td><td>${fmt(row.pv)}</td></tr>`
    ).join("") +
    `<tr style="font-weight:700;border-top:2px solid var(--primary)">
       <td>Total</td><td></td><td>${fmt(r.macrs.totalDep)}</td>
       <td>${fmt(r.macrs.totalSavings)}</td><td>NPV: ${fmt(r.macrs.npv)}</td>
     </tr>`;
  }

  /* ══════════════════════════════
     Excel Export (Premium)
     ══════════════════════════════ */
  function exportExcel() {
    if (!isPremium || !currentResult) return;
    if (typeof XLSX === "undefined") {
      alert("Excel export library loading… please try again.");
      return;
    }
    const r = currentResult;
    const wb = XLSX.utils.book_new();

    // Summary sheet
    const summaryData = [
      ["TaxShield Pro — Tax Summary", "", "", ""],
      ["Filing Status", r.filingStatus],
      ["Gross Income", r.grossIncome],
      [""],
      ["Year 1 Tax (with strategies)", r.totalTax],
      ["Year 1 Tax (without strategies)", r.baseTotalTax],
      ["Year 1 Savings", r.yr1Savings],
      [""],
      ["Year 2 Tax (with NOL)", r.yr2TotalTax],
      ["Year 2 Tax (baseline)", r.yr2BaseTotalTax],
      ["Year 2 Savings", r.yr2Savings],
      [""],
      ["Combined 2-Year Savings", r.combined2YrSavings],
      ["Total Cash Invested", r.totalCashInvested],
      ["ROI", r.roi]
    ];
    const ws = XLSX.utils.aoa_to_sheet(summaryData);
    ws["!cols"] = [{ wch: 30 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws, "Tax Summary");

    // Strategies sheet
    const stratData = [
      ["Strategy", "Cash", "Leverage", "Loss/Credit"],
      ["Box House", r.totalCashInvested > 0 ? V("bhCash") : 0, V("bhLeverage") || 3, r.bhLoss],
      ["Film §181", V("filmCash"), V("filmLeverage") || 3, r.filmLoss],
      ["Solar ITC", V("solarEquity"), V("solarLeverage") || 5, r.solarITC],
      ["Leveraged Charitable", V("charLevCash"), V("charLevLeverage") || 3, r.charDonation],
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(stratData);
    XLSX.utils.book_append_sheet(wb, ws2, "Strategies");

    XLSX.writeFile(wb, "TaxShieldPro_Report.xlsx");
  }

  /* ══════════════════════════════
     Email Gate
     ══════════════════════════════ */
  function initEmailGate() {
    const form = document.getElementById("emailForm");
    if (!form) return;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = document.getElementById("emailInput")?.value;
      if (email && email.includes("@")) {
        // In production, send to backend
        console.log("Email captured:", email);
        startTrial();
        const gate = document.getElementById("premiumGate");
        if (gate) gate.style.display = "none";
        alert("Premium unlocked for 24 hours! Enjoy full access.");
        recalculate();
      }
    });
  }

  /* ══════════════════════════════
     Init
     ══════════════════════════════ */
  function init() {
    initTheme();
    initTrial();
    initNumInputs();
    initFilingStatus();
    initDeductionType();
    initEmailGate();

    // Wire all inputs to recalculate
    document.querySelectorAll("input, select").forEach(el => {
      el.addEventListener("change", recalculate);
      el.addEventListener("input", () => {
        clearTimeout(el._debounce);
        el._debounce = setTimeout(recalculate, 300);
      });
    });

    // Strategy details toggle
    const detailBtn = document.getElementById("strategyDetailToggle");
    const detailPanel = document.getElementById("strategyDetails");
    if (detailBtn && detailPanel) {
      detailBtn.addEventListener("click", () => {
        const open = detailPanel.style.display !== "none";
        detailPanel.style.display = open ? "none" : "";
        detailBtn.textContent = open ? "Details ▾" : "Details ▴";
      });
    }


    // Export button
    const exportBtn = document.getElementById("exportExcel");
    if (exportBtn) exportBtn.addEventListener("click", exportExcel);

    // Start trial button
    document.querySelectorAll(".start-trial-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const gate = document.getElementById("premiumGate") || document.getElementById("emailForm");
        if (gate) gate.scrollIntoView({ behavior: "smooth" });
      });
    });

    // Initial calculation
    recalculate();
  }

  return { init, recalculate, startTrial, exportExcel, fmt, isPremium: () => isPremium };
})();

document.addEventListener("DOMContentLoaded", App.init);
