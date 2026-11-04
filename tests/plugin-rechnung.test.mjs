// Prüft die Rechnung des WordPress-Rechners (Plugin robingut-rechner).
// Der Rechner zeigt dieselben Zahlen wie der Partner (Provision ist dort eingerechnet).
//
//   node tests/plugin-rechnung.test.mjs

import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const R = require("../wordpress/robingut-rechner/assets/rechnung.js");

const nahe = (ist, soll, toleranz = 1e-6) =>
  assert.ok(Math.abs(ist - soll) < toleranz, `${ist} statt ${soll}`);

let bestanden = 0;
function pruefe(name, fn) {
  try {
    fn();
    bestanden += 1;
    console.log(`  ok  ${name}`);
  } catch (fehler) {
    console.error(`  FEHLER  ${name}\n        ${fehler.message}`);
    process.exitCode = 1;
  }
}

// Antwort der Partner-API für 41747 / 2.500 kWh vom 04.11.2026 (Auszug, brutto)
const VIERSEN = {
  energy_price: 38.16449,
  transaction_fee: 1.19,
  base_price: 238.13,
  monthly_base_price: 19.84,
  annual_total: 1221.99225,
  annual_consumption_kwh: 2500,
  city: "Viersen",
};

console.log("Preise aus der API");

pruefe("gültige Antwort wird übernommen", () => {
  const p = R.pruefePreise(VIERSEN, 2500);
  nahe(p.arbeitspreisCt, 38.16449);
  nahe(p.gebuehrCt, 1.19);
  nahe(p.grundMonat, 19.84);
  nahe(p.jahr, 1221.99225);
  assert.equal(p.stadt, "Viersen");
});

pruefe("fehlende, falsche oder unplausible Felder werden abgelehnt", () => {
  const faelle = [
    null, undefined, "x", [], {},
    { ...VIERSEN, annual_total: "1221" },
    { ...VIERSEN, annual_total: NaN },
    { ...VIERSEN, annual_total: Infinity },
    { ...VIERSEN, annual_total: 0 },
    { ...VIERSEN, energy_price: 0 },
    { ...VIERSEN, energy_price: 14 },
    { ...VIERSEN, energy_price: 81 },
    { ...VIERSEN, energy_price: 500 },
    { ...VIERSEN, monthly_base_price: 0.01 },
    { ...VIERSEN, monthly_base_price: 19.9 },
    { ...VIERSEN, transaction_fee: -1 },
    { ...VIERSEN, transaction_fee: 20 },
    { ...VIERSEN, monthly_base_price: -5 },
    { ...VIERSEN, monthly_base_price: 500 },
    { ...VIERSEN, base_price: 6000 },
    { requires_district_selection: true, city: "Erkelenz" },
    { requires_city_selection: true, orte: ["Bickendorf"] },
    { ...VIERSEN, requires_city_selection: true },
  ];
  for (const fall of faelle) assert.equal(R.pruefePreise(fall, 2500), null, JSON.stringify(fall));
});

pruefe("Antwort zu einem anderen Verbrauch wird abgelehnt", () => {
  assert.equal(R.pruefePreise(VIERSEN, 3500), null);
  assert.equal(R.pruefePreise({ ...VIERSEN, annual_consumption_kwh: undefined }, 2500), null);
});

pruefe("Jahressumme muss zu den Einzelpreisen passen", () => {
  // Arbeitspreis und Gebühr je kWh plus Jahresgrundpreis; weicht die Summe stärker ab,
  // hat sich die Bedeutung der Felder geändert und der Rechner zeigt lieber nichts.
  assert.equal(R.pruefePreise({ ...VIERSEN, annual_total: 1400 }, 2500), null);
  assert.equal(R.pruefePreise({ ...VIERSEN, annual_total: 1000 }, 2500), null);
  assert.notEqual(R.pruefePreise({ ...VIERSEN, annual_total: 1222.5 }, 2500), null);
});

pruefe("Toleranz: 0,5 % der Summe oder mindestens 2 €", () => {
  assert.notEqual(R.pruefePreise({ ...VIERSEN, annual_total: 1221.99225 + 6.0 }, 2500), null);
  assert.equal(R.pruefePreise({ ...VIERSEN, annual_total: 1221.99225 + 6.5 }, 2500), null);
  const klein = { energy_price: 38, transaction_fee: 1, base_price: 60, monthly_base_price: 5, annual_consumption_kwh: 500, city: "X" };
  assert.notEqual(R.pruefePreise({ ...klein, annual_total: 256.9 }, 500), null);
  assert.equal(R.pruefePreise({ ...klein, annual_total: 257.5 }, 500), null);
});

pruefe("nur echtes true löst eine Auswahl aus", () => {
  assert.notEqual(R.pruefePreise({ ...VIERSEN, requires_district_selection: false }, 2500), null);
  assert.equal(R.pruefePreise({ ...VIERSEN, requires_district_selection: 1 }, 2500), null);
});

pruefe("Stadt ist nur Text und gekürzt", () => {
  assert.equal(R.pruefePreise({ ...VIERSEN, city: 42 }, 2500).stadt, "");
  assert.equal(R.pruefePreise({ ...VIERSEN, city: "x".repeat(300) }, 2500).stadt.length, 100);
});

console.log("Eingaben");

pruefe("Grenzen und Lesekopf als Konstanten", () => {
  assert.equal(R.VERBRAUCH_MIN, 500);
  assert.equal(R.VERBRAUCH_MAX, 100000);
  assert.equal(R.LESEKOPF_MIETE_MONAT, 3.9);
  assert.equal(R.LESEKOPF_KAUF, 89);
});

pruefe("Verbrauch wird wie im Entwurf gelesen", () => {
  assert.equal(R.kwhAusEingabe("2500"), 2500);
  assert.equal(R.kwhAusEingabe("3.500"), 3500);
  assert.equal(R.kwhAusEingabe(" 2 500 "), 2500);
  for (const roh of ["", "abc", "2,5", "-2500", "0", "2500.5", "1.50", null, undefined]) {
    assert.equal(R.kwhAusEingabe(roh), null, String(roh));
  }
});

pruefe("Verbrauch außerhalb der Grenzen", () => {
  assert.equal(R.pruefeVerbrauch(null), "verbrauch-ungueltig");
  assert.equal(R.pruefeVerbrauch(499), "zu-klein");
  assert.equal(R.pruefeVerbrauch(100001), "grossverbrauch");
  assert.equal(R.pruefeVerbrauch(500), "ok");
  assert.equal(R.pruefeVerbrauch(100000), "ok");
});

pruefe("Abschlag in Euro mit Komma oder Punkt", () => {
  assert.equal(R.betragAusEingabe("95"), 95);
  assert.equal(R.betragAusEingabe("89,50"), 89.5);
  assert.equal(R.betragAusEingabe("89.5"), 89.5);
  assert.equal(R.betragAusEingabe(" 120 €"), 120);
  for (const roh of ["", "abc", "-5", "0", "1e3", "5000", null]) {
    assert.equal(R.betragAusEingabe(roh), null, String(roh));
  }
});

console.log("Rechnung");

const P = R.pruefePreise(VIERSEN, 2500);

pruefe("Monat ist die Jahressumme des Partners geteilt durch 12", () => {
  const r = R.berechne(P, null);
  assert.equal(r.status, "ok");
  nahe(r.monat, 1221.99225 / 12);
  nahe(r.jahr, 1221.99225);
});

pruefe("ohne gültige Preise keine Zahl", () => {
  const r = R.berechne(null, null);
  assert.equal(r.status, "preise-fehlen");
  assert.equal(r.monat, undefined);
});

pruefe("Ersparnis rechnet die Lesekopf-Miete mit ein", () => {
  const r = R.berechne(P, 110);
  assert.equal(r.vergleich.art, "ersparnis");
  nahe(r.vergleich.jahr, 110 * 12 - (1221.99225 + 12 * 3.9));
});

pruefe("etwa gleich unter 12 € im Jahr Unterschied, mit Lesekopf", () => {
  const mitLesekopf = (1221.99225 + 12 * 3.9) / 12;
  assert.equal(R.berechne(P, mitLesekopf).vergleich.art, "gleich");
  assert.equal(R.berechne(P, mitLesekopf + 0.99).vergleich.art, "gleich");
  assert.equal(R.berechne(P, mitLesekopf + 1.01).vergleich.art, "ersparnis");
  assert.equal(R.berechne(P, mitLesekopf - 1.01).vergleich.art, "mehrkosten");
  assert.equal(R.berechne(P, 102).vergleich.art, "mehrkosten");
});

pruefe("Mehrkosten werden ehrlich ausgewiesen", () => {
  const r = R.berechne(P, 80);
  assert.equal(r.vergleich.art, "mehrkosten");
  assert.ok(r.vergleich.jahr < 0);
});

pruefe("ohne Abschlag kein Vergleich", () => {
  assert.equal(R.berechne(P, null).vergleich, null);
});

console.log("Anzeige");

pruefe("Euro und Cent deutsch formatiert", () => {
  assert.equal(R.euro(101.8326875), "102 €");
  assert.equal(R.euro(1221.99225, 2), "1.221,99 €");
  assert.equal(R.cent(38.16449), "38,16 ct");
});

console.log(`\n${bestanden} Prüfungen bestanden`);
