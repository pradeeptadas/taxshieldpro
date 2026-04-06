/* ═══════════════════════════════════════════════════════
   TaxShield Pro — State Registry
   All 50 states + DC. Tax Year 2025/2026.
   ═══════════════════════════════════════════════════════ */

const StateRegistry = (() => {
  "use strict";

  /* ── Federal brackets (shared by all states) ── */
  const FED_MFJ = [[24800,.10],[100500,.12],[211800,.22],[404100,.24],[513100,.32],[768600,.35],[Infinity,.37]];
  const FED_S   = [[12400,.10],[50250,.12],[105900,.22],[202050,.24],[256550,.32],[384300,.35],[Infinity,.37]];
  const FED_MFS = FED_S; // Same as Single for federal

  /* ── Helper: build a state config ── */
  function makeConfig(id, name, opts) {
    const feat = Object.assign({
      hasNoIncomeTax: false,
      flatRate: null,
      decouplesBonusDepreciation: false,
      filmFlowsThrough: false,
      hasCityTax: false
    }, opts.features || {});

    const stateMFJ = opts.stateMFJ || null;
    const stateS   = opts.stateS || opts.stateMFJ || null; // fallback to MFJ if same
    const stateMFS = opts.stateMFS || stateS || null;

    const cityMFJ = opts.cityMFJ || null;
    const cityS   = opts.cityS || null;
    const cityMFS = opts.cityMFS || cityS || null;

    const stateStdMFJ = opts.stateStdMFJ || 0;
    const stateStdS   = opts.stateStdS || 0;
    const stateStdMFS = opts.stateStdMFS || stateStdS;

    return {
      id, name,
      city: opts.city || null,
      taxYear: 2026,
      saltCap: 25000,
      features: feat,
      brackets: {
        MFJ: {
          fed: FED_MFJ, state: stateMFJ, city: cityMFJ,
          fedStd: 32200, stateStd: stateStdMFJ, ebl: 512000, addMedThreshold: 250000
        },
        S: {
          fed: FED_S, state: stateS, city: cityS,
          fedStd: 16100, stateStd: stateStdS, ebl: 256000, addMedThreshold: 200000
        },
        MFS: {
          fed: FED_MFS, state: stateMFS, city: cityMFS,
          fedStd: 16100, stateStd: stateStdMFS, ebl: 256000, eblBoth: 512000, addMedThreshold: 125000
        }
      },
      taxLevels: opts.taxLevels || [
        { key: "fed", label: "Federal" },
        ...(feat.hasNoIncomeTax ? [] : [{ key: "state", label: name }]),
        ...(feat.hasCityTax && opts.city ? [{ key: "city", label: opts.city }] : [])
      ],
      calcStateTax: opts.calcStateTax || null,
      calcCityTax: opts.calcCityTax || null,
      notes: opts.notes || {}
    };
  }

  /* ── Helper: flat tax config (no brackets needed) ── */
  function makeFlat(id, name, rate, stateStdS, stateStdMFJ) {
    return makeConfig(id, name, {
      features: { flatRate: rate },
      stateStdS: stateStdS || 0,
      stateStdMFJ: stateStdMFJ || 0
    });
  }

  /* ── Helper: no-income-tax config ── */
  function makeNoTax(id, name) {
    return makeConfig(id, name, {
      features: { hasNoIncomeTax: true }
    });
  }

  /* ═══════════════════════════════════════════════════════
     STATE CONFIGS
     ═══════════════════════════════════════════════════════ */

  const configs = {};

  /* ── No Income Tax States ── */
  configs.AK = makeNoTax("AK", "Alaska");
  configs.FL = makeNoTax("FL", "Florida");
  configs.NV = makeNoTax("NV", "Nevada");
  configs.NH = makeNoTax("NH", "New Hampshire");
  configs.SD = makeNoTax("SD", "South Dakota");
  configs.TX = makeNoTax("TX", "Texas");
  configs.TN = makeNoTax("TN", "Tennessee");
  configs.WA = makeNoTax("WA", "Washington");
  configs.WY = makeNoTax("WY", "Wyoming");

  /* ── Flat Tax States ── */
  configs.AZ = makeFlat("AZ", "Arizona",       0.025,  14600, 29200);
  configs.CO = makeFlat("CO", "Colorado",       0.044,  15000, 30000);
  configs.GA = makeFlat("GA", "Georgia",        0.0539, 12000, 24000);
  configs.IA = makeFlat("IA", "Iowa",           0.038,  2210,  5450);
  configs.ID = makeFlat("ID", "Idaho",          0.05695,14600, 29200);
  configs.IL = makeFlat("IL", "Illinois",       0.0495, 2625,  5250);
  configs.IN = makeFlat("IN", "Indiana",        0.0305, 0,     0);
  configs.KY = makeFlat("KY", "Kentucky",       0.04,   3160,  6320);
  configs.LA = makeFlat("LA", "Louisiana",      0.03,   12500, 25000);
  configs.MA = makeFlat("MA", "Massachusetts",  0.05,   0,     0);
  configs.MI = makeFlat("MI", "Michigan",       0.0425, 5600,  11200);
  configs.MT = makeFlat("MT", "Montana",        0.059,  14600, 29200);
  configs.NC = makeFlat("NC", "North Carolina", 0.045,  12750, 25500);
  configs.PA = makeFlat("PA", "Pennsylvania",   0.0307, 0,     0);
  configs.UT = makeFlat("UT", "Utah",           0.0465, 0,     0);

  /* ── Progressive Bracket States ── */

  /* New York */
  configs.NY = makeConfig("NY", "New York", {
    city: "New York City",
    features: {
      decouplesBonusDepreciation: true,
      filmFlowsThrough: true,
      hasCityTax: true
    },
    stateMFJ: [[17150,.039],[23600,.044],[27900,.0515],[161550,.054],[323200,.059],[2155350,.0685],[5000000,.0965],[25000000,.103],[Infinity,.109]],
    stateS:   [[8500,.039],[11700,.044],[13900,.0515],[80650,.054],[161600,.059],[1077550,.0685],[2500000,.0965],[12500000,.103],[Infinity,.109]],
    cityMFJ:  [[21600,.03078],[45000,.03762],[90000,.03819],[Infinity,.03876]],
    cityS:    [[10800,.03078],[22500,.03762],[45000,.03819],[Infinity,.03876]],
    stateStdMFJ: 16050, stateStdS: 8000,
    taxLevels: [
      { key: "fed", label: "Federal" },
      { key: "state", label: "New York State" },
      { key: "city", label: "New York City" }
    ],
    notes: {
      decoupling: "NY decouples from federal bonus depreciation (Form IT-398). Box House and Solar losses are added back at the state level and recovered via 5-year MACRS.",
      filmFlowThrough: "Film §181 deductions flow through to NY — no add-back required."
    }
  });

  /* California */
  configs.CA = makeConfig("CA", "California", {
    features: { decouplesBonusDepreciation: true },
    stateMFJ: [[21512,.01],[50998,.02],[80490,.04],[111732,.06],[141212,.08],[721318,.093],[865574,.103],[1000000,.113],[1442628,.123],[Infinity,.133]],
    stateS:   [[10756,.01],[25499,.02],[40245,.04],[55866,.06],[70606,.08],[360659,.093],[432787,.103],[721314,.113],[1000000,.123],[Infinity,.133]],
    stateStdMFJ: 11080, stateStdS: 5540,
    notes: { info: "CA top rate includes 1% Mental Health Services surcharge on income over $1M." }
  });

  /* New Jersey */
  configs.NJ = makeConfig("NJ", "New Jersey", {
    stateMFJ: [[20000,.014],[35000,.0175],[40000,.035],[75000,.05525],[500000,.0637],[1000000,.0897],[Infinity,.1075]],
    stateStdMFJ: 2000, stateStdS: 1000
  });

  /* Connecticut */
  configs.CT = makeConfig("CT", "Connecticut", {
    stateMFJ: [[20000,.03],[100000,.05],[200000,.055],[400000,.06],[500000,.065],[1000000,.069],[Infinity,.0699]],
    stateS:   [[10000,.03],[50000,.05],[100000,.055],[200000,.06],[250000,.065],[500000,.069],[Infinity,.0699]],
    stateStdMFJ: 0, stateStdS: 0
  });

  /* Virginia */
  configs.VA = makeConfig("VA", "Virginia", {
    stateMFJ: [[3000,.02],[5000,.03],[17000,.05],[Infinity,.0575]],
    stateStdMFJ: 16000, stateStdS: 8000
  });

  /* Oregon */
  configs.OR = makeConfig("OR", "Oregon", {
    stateMFJ: [[8100,.0475],[20400,.0675],[250000,.0875],[Infinity,.099]],
    stateS:   [[4050,.0475],[10200,.0675],[125000,.0875],[Infinity,.099]],
    stateStdMFJ: 5495, stateStdS: 2745
  });

  /* Minnesota */
  configs.MN = makeConfig("MN", "Minnesota", {
    stateMFJ: [[46330,.0535],[184040,.068],[321450,.0785],[Infinity,.0985]],
    stateS:   [[31690,.0535],[104090,.068],[183340,.0785],[Infinity,.0985]],
    stateStdMFJ: 29150, stateStdS: 14575
  });

  /* Wisconsin */
  configs.WI = makeConfig("WI", "Wisconsin", {
    stateMFJ: [[19090,.035],[38190,.044],[420420,.053],[Infinity,.0765]],
    stateS:   [[14320,.035],[28640,.044],[315310,.053],[Infinity,.0765]],
    stateStdMFJ: 24440, stateStdS: 13230
  });

  /* Hawaii */
  configs.HI = makeConfig("HI", "Hawaii", {
    stateMFJ: [[4800,.014],[9600,.032],[19200,.055],[28800,.064],[38400,.068],[48000,.072],[72000,.076],[96000,.079],[300000,.0825],[350000,.09],[400000,.10],[Infinity,.11]],
    stateS:   [[2400,.014],[4800,.032],[9600,.055],[14400,.064],[19200,.068],[24000,.072],[36000,.076],[48000,.079],[150000,.0825],[175000,.09],[200000,.10],[Infinity,.11]],
    stateStdMFJ: 4400, stateStdS: 2200
  });

  /* South Carolina */
  configs.SC = makeConfig("SC", "South Carolina", {
    stateMFJ: [[3460,0],[17330,.03],[Infinity,.062]],
    stateStdMFJ: 30000, stateStdS: 15000
  });

  /* Maryland */
  configs.MD = makeConfig("MD", "Maryland", {
    stateMFJ: [[1000,.02],[2000,.03],[3000,.04],[150000,.0475],[175000,.05],[225000,.0525],[300000,.055],[Infinity,.0575]],
    stateS:   [[1000,.02],[2000,.03],[3000,.04],[100000,.0475],[125000,.05],[150000,.0525],[250000,.055],[Infinity,.0575]],
    stateStdMFJ: 4800, stateStdS: 2400,
    notes: { info: "MD counties levy additional 2.25%-3.20% income tax." }
  });

  /* Ohio */
  configs.OH = makeConfig("OH", "Ohio", {
    stateMFJ: [[26050,0],[100000,.0275],[Infinity,.035]],
    stateStdMFJ: 0, stateStdS: 0,
    notes: { info: "Several OH cities levy 2.0%-2.5% municipal income tax." }
  });

  /* Kansas */
  configs.KS = makeConfig("KS", "Kansas", {
    stateMFJ: [[30000,.031],[60000,.0525],[Infinity,.057]],
    stateS:   [[15000,.031],[30000,.0525],[Infinity,.057]],
    stateStdMFJ: 8000, stateStdS: 3500
  });

  /* Maine */
  configs.ME = makeConfig("ME", "Maine", {
    stateMFJ: [[52100,.058],[123250,.0675],[Infinity,.0715]],
    stateS:   [[26050,.058],[61600,.0675],[Infinity,.0715]],
    stateStdMFJ: 29200, stateStdS: 14600
  });

  /* Missouri */
  configs.MO = makeConfig("MO", "Missouri", {
    stateMFJ: [[1253,0],[2506,.02],[3759,.025],[5012,.03],[6265,.035],[7518,.04],[8771,.045],[Infinity,.047]],
    stateStdMFJ: 29200, stateStdS: 14600
  });

  /* Nebraska */
  configs.NE = makeConfig("NE", "Nebraska", {
    stateMFJ: [[7390,.0246],[44350,.0351],[71460,.0501],[Infinity,.0584]],
    stateS:   [[3700,.0246],[22170,.0351],[35730,.0501],[Infinity,.0584]],
    stateStdMFJ: 16000, stateStdS: 8000
  });

  /* New Mexico */
  configs.NM = makeConfig("NM", "New Mexico", {
    stateMFJ: [[8000,.017],[16000,.032],[24000,.047],[315000,.049],[Infinity,.059]],
    stateS:   [[5500,.017],[11000,.032],[16000,.047],[210000,.049],[Infinity,.059]],
    stateStdMFJ: 29200, stateStdS: 14600
  });

  /* Oklahoma */
  configs.OK = makeConfig("OK", "Oklahoma", {
    stateMFJ: [[2000,.0025],[5000,.0075],[7500,.0175],[9800,.0275],[12200,.0375],[Infinity,.0475]],
    stateS:   [[1000,.0025],[2500,.0075],[3750,.0175],[4900,.0275],[7200,.0375],[Infinity,.0475]],
    stateStdMFJ: 12700, stateStdS: 6350
  });

  /* Rhode Island */
  configs.RI = makeConfig("RI", "Rhode Island", {
    stateMFJ: [[77450,.0375],[176050,.0475],[Infinity,.0599]],
    stateStdMFJ: 21100, stateStdS: 10550
  });

  /* Vermont */
  configs.VT = makeConfig("VT", "Vermont", {
    stateMFJ: [[75850,.0335],[183400,.066],[279450,.076],[Infinity,.0875]],
    stateS:   [[45400,.0335],[110050,.066],[229500,.076],[Infinity,.0875]],
    stateStdMFJ: 30000, stateStdS: 15000
  });

  /* West Virginia */
  configs.WV = makeConfig("WV", "West Virginia", {
    stateMFJ: [[10000,.0236],[25000,.0315],[40000,.0354],[60000,.0472],[Infinity,.0482]],
    stateStdMFJ: 0, stateStdS: 0
  });

  /* Arkansas */
  configs.AR = makeConfig("AR", "Arkansas", {
    stateMFJ: [[5100,0],[10300,.02],[Infinity,.039]],
    stateStdMFJ: 4680, stateStdS: 2340
  });

  /* Alabama */
  configs.AL = makeConfig("AL", "Alabama", {
    stateMFJ: [[500,.02],[3000,.04],[Infinity,.05]],
    stateStdMFJ: 7500, stateStdS: 2500,
    notes: { info: "AL allows deduction of federal income tax paid from state taxable income." }
  });

  /* Mississippi */
  configs.MS = makeConfig("MS", "Mississippi", {
    stateMFJ: [[10000,0],[Infinity,.044]],
    stateStdMFJ: 16600, stateStdS: 8300
  });

  /* North Dakota */
  configs.ND = makeConfig("ND", "North Dakota", {
    stateMFJ: [[44725,0],[Infinity,.0195]],
    stateStdMFJ: 29200, stateStdS: 14600
  });

  /* Delaware */
  configs.DE = makeConfig("DE", "Delaware", {
    stateMFJ: [[2000,.022],[5000,.039],[10000,.048],[20000,.052],[25000,.0555],[60000,.066],[Infinity,.066]],
    stateStdMFJ: 6500, stateStdS: 3250
  });

  /* District of Columbia */
  configs.DC = makeConfig("DC", "District of Columbia", {
    stateMFJ: [[10000,.04],[40000,.06],[60000,.065],[250000,.085],[500000,.0925],[1000000,.0975],[Infinity,.1075]],
    stateStdMFJ: 30000, stateStdS: 15000
  });

  /* ── Sort keys for display ── */
  const allIds = Object.keys(configs).sort();

  return {
    configs,
    allIds,
    get(id) { return configs[id] || null; },
    getAll() { return allIds.map(id => ({ id, name: configs[id].name })); }
  };
})();

if (typeof module !== "undefined") module.exports = StateRegistry;
