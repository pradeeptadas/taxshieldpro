/* ═══════════════════════════════════════════════════════
   TaxShield Pro — New York State + NYC Config
   Tax Year 2026
   ═══════════════════════════════════════════════════════ */

const NY_CONFIG = {
  id: "NY",
  name: "New York",
  city: "New York City",
  taxYear: 2026,
  saltCap: 25000,

  features: {
    hasNoIncomeTax: false,
    flatRate: null,
    decouplesBonusDepreciation: true,
    filmFlowsThrough: true,
    hasCityTax: true
  },

  brackets: {
    MFJ: {
      fed: [[24800,.10],[100500,.12],[211800,.22],[404100,.24],[513100,.32],[768600,.35],[Infinity,.37]],
      state: [[17150,.039],[23600,.044],[27900,.0515],[161550,.054],[323200,.059],[2155350,.0685],[5000000,.0965],[25000000,.103],[Infinity,.109]],
      city: [[21600,.03078],[45000,.03762],[90000,.03819],[Infinity,.03876]],
      fedStd: 32200, stateStd: 16050, ebl: 512000, addMedThreshold: 250000
    },
    S: {
      fed: [[12400,.10],[50250,.12],[105900,.22],[202050,.24],[256550,.32],[384300,.35],[Infinity,.37]],
      state: [[8500,.039],[11700,.044],[13900,.0515],[80650,.054],[161600,.059],[1077550,.0685],[2500000,.0965],[12500000,.103],[Infinity,.109]],
      city: [[10800,.03078],[22500,.03762],[45000,.03819],[Infinity,.03876]],
      fedStd: 16100, stateStd: 8000, ebl: 256000, addMedThreshold: 200000
    },
    MFS: {
      fed: [[12400,.10],[50250,.12],[105900,.22],[202050,.24],[256550,.32],[384300,.35],[Infinity,.37]],
      state: [[8500,.039],[11700,.044],[13900,.0515],[80650,.054],[161600,.059],[1077550,.0685],[2500000,.0965],[12500000,.103],[Infinity,.109]],
      city: [[10800,.03078],[22500,.03762],[45000,.03819],[Infinity,.03876]],
      fedStd: 16100, stateStd: 8000, ebl: 256000, eblBoth: 512000, addMedThreshold: 125000
    }
  },

  taxLevels: [
    { key: "fed", label: "Federal" },
    { key: "state", label: "New York State" },
    { key: "city", label: "New York City" }
  ],

  notes: {
    decoupling: "NY decouples from federal bonus depreciation (Form IT-398). Box House and Solar losses are added back at the state level and recovered via 5-year MACRS.",
    filmFlowThrough: "Film §181 deductions flow through to NY — no add-back required.",
    eblNote: "EBL limit: $512K MFJ / $256K per person (Single & MFS). MFS both spouses combined = $512K. Excess becomes NOL carryforward."
  }
};

if (typeof module !== "undefined") module.exports = NY_CONFIG;
