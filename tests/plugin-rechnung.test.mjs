// Prüft die Rechnung des WordPress-Rechners (Plugin robingut-rechner).
// Der Rechner zeigt dieselben Zahlen wie der Partner (Provision ist dort eingerechnet).
//
//   node tests/plugin-rechnung.test.mjs

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
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
  assert.equal(R.pruefeVerbrauch(99999), "ok");
});

// Übergabe 08.11.2026: „Ab 100.000 kWh Jahresverbrauch erstellen wir ein individuelles Angebot.“
pruefe("ab 100.000 kWh gibt es ein individuelles Angebot", () => {
  assert.equal(R.pruefeVerbrauch(100000), "grossverbrauch");
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

console.log("Straßen-Dropdown");

pruefe("Pfeil runter springt vom Feld auf den ersten Vorschlag und läuft im Kreis", () => {
  assert.equal(R.naechsterVorschlag(-1, 3, "ArrowDown"), 0);
  assert.equal(R.naechsterVorschlag(0, 3, "ArrowDown"), 1);
  assert.equal(R.naechsterVorschlag(2, 3, "ArrowDown"), 0);
});

pruefe("Pfeil hoch springt vom Feld auf den letzten Vorschlag", () => {
  assert.equal(R.naechsterVorschlag(-1, 3, "ArrowUp"), 2);
  assert.equal(R.naechsterVorschlag(0, 3, "ArrowUp"), 2);
  assert.equal(R.naechsterVorschlag(2, 3, "ArrowUp"), 1);
});

pruefe("ohne Vorschläge oder mit anderer Taste bleibt nichts gewählt bzw. unverändert", () => {
  assert.equal(R.naechsterVorschlag(-1, 0, "ArrowDown"), -1);
  assert.equal(R.naechsterVorschlag(1, 3, "a"), 1);
  assert.equal(R.naechsterVorschlag(5, 3, "ArrowDown"), 0);
  assert.equal(R.naechsterVorschlag(5, 3, "ArrowUp"), 2);
});

console.log("Anfragen");

pruefe("Rechner schickt Zugangsdaten nur an die eigene Seite (Passwortschutz per Basic Auth)", () => {
  const quelle = readFileSync(new URL("../wordpress/robingut-rechner/assets/rechner.js", import.meta.url), "utf8");
  assert.match(quelle, /credentials: "same-origin"/);
  assert.doesNotMatch(quelle, /credentials: "(omit|include)"/);
});

console.log("Rollen und Erzeugerrechnung");

pruefe("Rolle nur aus der Liste, sonst Strom beziehen", () => {
  assert.deepEqual(R.ROLLEN, ["beziehen", "einspeisen", "beides"]);
  assert.equal(R.rolleAusWert("einspeisen"), "einspeisen");
  assert.equal(R.rolleAusWert("beides"), "beides");
  for (const roh of ["", "EINSPEISEN", "admin", null, undefined, 3, ["beides"]]) {
    assert.equal(R.rolleAusWert(roh), "beziehen", String(roh));
  }
});

pruefe("Anlagenleistung mit Komma oder Tausenderpunkt", () => {
  assert.equal(R.kwpAusEingabe("100"), 100);
  assert.equal(R.kwpAusEingabe("9,8"), 9.8);
  assert.equal(R.kwpAusEingabe("1.000"), 1000);
  assert.equal(R.kwpAusEingabe(" 250 "), 250);
  for (const roh of ["", "abc", "-5", "0", "1,234", "9.8", "1e3", null, undefined]) {
    assert.equal(R.kwpAusEingabe(roh), null, String(roh));
  }
});

pruefe("Anlage: Grenzen für Leistung und Überschuss", () => {
  assert.equal(R.pruefeAnlage(100, 66500), "ok");
  assert.equal(R.pruefeAnlage(1, 100), "ok");
  assert.equal(R.pruefeAnlage(1000, 66500), "ok");
  assert.equal(R.pruefeAnlage(null, 66500), "kwp-ungueltig");
  assert.equal(R.pruefeAnlage(0.5, 500), "kwp-zu-klein");
  assert.equal(R.pruefeAnlage(1000.1, 66500), "grossanlage");
  assert.equal(R.pruefeAnlage(100, null), "ueberschuss-ungueltig");
  assert.equal(R.pruefeAnlage(100, 99), "ueberschuss-zu-klein");
  assert.equal(R.pruefeAnlage(100, 10000001), "ueberschuss-zu-gross");
});

pruefe("Wunschpreis nur 7 bis 11 ct in halben Cent", () => {
  assert.equal(R.WUNSCHPREIS_VORBELEGUNG, 10);
  assert.equal(R.wunschpreisAusWert("10"), 10);
  assert.equal(R.wunschpreisAusWert("7"), 7);
  assert.equal(R.wunschpreisAusWert("11"), 11);
  assert.equal(R.wunschpreisAusWert("8.5"), 8.5);
  for (const roh of ["6.5", "11.5", "8.3", "", "abc", null, "NaN", "Infinity"]) {
    assert.equal(R.wunschpreisAusWert(roh), null, String(roh));
  }
});

// Antwort unserer REST-Route /erzeuger (Werte von WSE für 100 kWp / 66.500 kWh, abgerufen 09.11.2026)
const ERZEUGER_100 = { individuell: false, grund_monat: 95.38, vermarktung_ct: 0.2, einrichtung: 390 };

pruefe("Erzeugerkosten: nur vollständige, plausible Werte", () => {
  assert.deepEqual(R.pruefeErzeugerKosten(ERZEUGER_100), { individuell: false, grundMonat: 95.38, vermarktungCt: 0.2, einrichtung: 390 });
  assert.deepEqual(R.pruefeErzeugerKosten({ individuell: true }), { individuell: true });
  for (const kaputt of [null, "x", {}, { ...ERZEUGER_100, grund_monat: "95" }, { ...ERZEUGER_100, grund_monat: -1 },
    { ...ERZEUGER_100, grund_monat: 2001 }, { ...ERZEUGER_100, vermarktung_ct: 5.1 }, { ...ERZEUGER_100, einrichtung: NaN },
    { ...ERZEUGER_100, einrichtung: 10001 }, { ...ERZEUGER_100, individuell: "nein" },
    { ...ERZEUGER_100, grund_monat: 0 }, { ...ERZEUGER_100, grund_monat: 0.99 }, { ...ERZEUGER_100, einrichtung: 0 },
    { ...ERZEUGER_100, vermarktung_ct: 0 }]) {
    assert.equal(R.pruefeErzeugerKosten(kaputt), null, JSON.stringify(kaputt));
  }
});

const PV_U20 = { art: "pv", foerderung: false, kwp: 100 };

pruefe("Rechenbeispiel Landwirte: 100 kWp, 66.500 kWh, 10 ct", () => {
  const e = R.berechneErzeuger(66500, 10, R.pruefeErzeugerKosten(ERZEUGER_100), PV_U20);
  nahe(e.erloes, 6650);
  nahe(e.grundJahr, 1144.56);
  nahe(e.vermarktung, 133);
  nahe(e.bleibt, 5372.44);
  nahe(e.anschluss, 2992.5);
  assert.equal(e.einrichtung, 390);
  assert.equal(R.euro(e.bleibt), "5.372 €");
  assert.equal(R.euro(e.anschluss), "2.993 €");
});

pruefe("Erzeugerrechnung ohne Kosten oder mit ungültigen Werten liefert nichts", () => {
  assert.equal(R.berechneErzeuger(66500, 10, null, PV_U20), null);
  assert.equal(R.berechneErzeuger(66500, null, R.pruefeErzeugerKosten(ERZEUGER_100), PV_U20), null);
  assert.equal(R.berechneErzeuger(null, 10, R.pruefeErzeugerKosten(ERZEUGER_100), PV_U20), null);
  assert.equal(R.berechneErzeuger(66500, 10, { individuell: true }, PV_U20), null);
});

// Anschlussvergütung gibt es nur für ausgeförderte Solaranlagen bis 100 kW (§§ 21, 23b EEG);
// sonst wäre der „höchstens“-Vergleich falsch und schönte das Ergebnis.
pruefe("Vergleich mit der Anschlussvergütung nur für ausgeförderte PV bis 100 kWp", () => {
  const kosten = R.pruefeErzeugerKosten(ERZEUGER_100);
  nahe(R.berechneErzeuger(66500, 10, kosten, PV_U20).anschluss, 2992.5);
  nahe(R.berechneErzeuger(5000, 10, kosten, { art: "pv", foerderung: false, kwp: 9.8 }).anschluss, 225);
  for (const anlage of [{ ...PV_U20, art: "wind" }, { ...PV_U20, art: "wasser" }, { ...PV_U20, art: "biogas" },
    { ...PV_U20, foerderung: true }, { ...PV_U20, kwp: 100.1 }, { ...PV_U20, art: "x" }, undefined]) {
    assert.equal(R.berechneErzeuger(66500, 10, kosten, anlage).anschluss, null, JSON.stringify(anlage));
  }
});

pruefe("Fernwirktechnik ab 25 kW", () => {
  assert.equal(R.brauchtFernwirktechnik(24.9), false);
  assert.equal(R.brauchtFernwirktechnik(25), true);
});

pruefe("Anlagenarten: Biogas läuft beim Partner als BHKW", () => {
  assert.deepEqual(Object.keys(R.ANLAGENARTEN), ["pv", "wind", "wasser", "biogas"]);
  assert.equal(R.ANLAGENARTEN.biogas.partner, "chp");
  assert.equal(R.ANLAGENARTEN.wasser.partner, "water");
});

pruefe("Rechner zeigt keine Mailadresse von ROBIN GUT", () => {
  const quelle = readFileSync(new URL("../wordpress/robingut-rechner/assets/rechner.js", import.meta.url), "utf8");
  assert.doesNotMatch(quelle, /@robingut-strom\.de|@robin-gut\.org/);
});

console.log("Anzeige");

pruefe("Euro und Cent deutsch formatiert", () => {
  assert.equal(R.euro(101.8326875), "102 €");
  assert.equal(R.euro(1221.99225, 2), "1.221,99 €");
  assert.equal(R.cent(38.16449), "38,16 ct");
});

console.log(`\n${bestanden} Prüfungen bestanden`);
