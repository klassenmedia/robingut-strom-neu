// Prüft den Preisrechner des schlanken Entwurfs direkt am ausgelieferten Modul.
//
//   node tests/schlank-rechner.test.mjs

import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";

import {
  berechne,
  anzeige,
  grundpreisAusStaffel,
  COMMUNITY_ANTEIL,
  E_COMMUNITY_CT,
  WSE_GEBUEHR_CT,
  LESEKOPF_MIETE_MONAT,
  REFERENZ_PLZ,
  GROSSVERBRAUCH_KWH,
  VERBRAUCH_MIN,
  ISTPREIS_MIN,
  ISTPREIS_MAX,
  ISTGRUNDPREIS_PLAUSIBEL,
} from "../schlank/rechner.js";
import { PREISE } from "../schlank/preise.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "schlank", "index.html"), "utf8");
const rechnerJs = readFileSync(join(ROOT, "schlank", "rechner.js"), "utf8");
const PLZ_MUSTER = /^[0-9]{5}$/;
const nahe = (ist, soll, toleranz = 1e-9) =>
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

console.log("Rechenlogik");

pruefe("Vorgaben entsprechen dem geprüften Rechner", () => {
  assert.equal(COMMUNITY_ANTEIL, 50);
  assert.equal(E_COMMUNITY_CT, 9.5);
  assert.equal(WSE_GEBUEHR_CT, 1.19, "1,00 ct netto plus 19 % USt");
  assert.equal(LESEKOPF_MIETE_MONAT, 3.9);
  assert.equal(REFERENZ_PLZ, "41747");
});

pruefe("Arbeitspreis und Grundpreis wie im alten Rechner (Viersen, 2.500 kWh)", () => {
  const r = berechne("41747", 2500, 35, 12);
  const e = PREISE["41747"];
  const community = e.fBrutto + 9.5 + 1.19;
  const rest = e.fBrutto + e.eReststromBrutto;
  nahe(r.preisCommunityCt, community);
  nahe(r.preisRestCt, rest);
  nahe(r.arbeitspreisCt, 0.5 * community + 0.5 * rest);
  nahe(r.arbeitspreisCt, 29.44964, 1e-4);
  assert.equal(r.grundpreisMonat, 18.03);
});

pruefe("Jahreskosten enthalten Arbeitspreis, Grundpreis und Lesekopf-Miete", () => {
  const r = berechne("41747", 2500, 35, 12);
  nahe(r.gesamtJahr, (r.arbeitspreisCt / 100) * 2500 + 18.03 * 12 + 3.9 * 12);
});

// Regression aus dem Review: Vergleich nur über Arbeitspreise zeigte 139 € Ersparnis
pruefe("Ersparnis vergleicht kompletten heutigen mit komplettem neuen Tarif", () => {
  const r = berechne("41747", 2500, 35, 12);
  nahe(r.vergleich.heuteJahr, 0.35 * 2500 + 12 * 12);
  nahe(r.vergleich.ersparnisJahr, r.vergleich.heuteJahr - r.gesamtJahr);
  assert.ok(r.vergleich.ersparnisJahr < 25, `zu hoch: ${r.vergleich.ersparnisJahr}`);
});

pruefe("Mischpreis ohne Grundpreis wird als Mehrkosten erkannt", () => {
  const r = berechne("41747", 2500, 35, 0);
  assert.ok(r.vergleich.ersparnisJahr < -70, `${r.vergleich.ersparnisJahr}`);
});

pruefe("ohne heutigen Grundpreis gibt es keinen Vergleich", () => {
  for (const leer of ["", "  ", null, undefined, "abc", "-5"]) {
    const r = berechne("41747", 2500, 35, leer);
    assert.equal(r.vergleich, null, `bei ${JSON.stringify(leer)}`);
    assert.ok(isFinite(r.gesamtJahr));
  }
});

pruefe("ohne gültigen heutigen Preis gibt es keinen Vergleich", () => {
  for (const leer of ["", "0", "0,", "-3", "abc", "1e5", "35,5,5"]) {
    assert.equal(berechne("41747", 2500, leer, 12).vergleich, null, `bei ${JSON.stringify(leer)}`);
  }
});

pruefe("ein Grundpreis von 0 ist eine gültige Angabe", () => {
  assert.notEqual(berechne("41747", 2500, 35, "0").vergleich, null);
});

pruefe("Preis unter 1 wird als Euro gelesen und gemeldet", () => {
  const r = berechne("41747", 2500, "0,35", 12);
  assert.equal(r.vergleich.istpreisCt, 35);
  assert.equal(r.vergleich.istpreisHinweis, "euro");
});

pruefe("Preis außerhalb 10–80 ct wird geklemmt und gemeldet", () => {
  const unten = berechne("41747", 2500, "9", 12).vergleich;
  assert.equal(unten.istpreisCt, ISTPREIS_MIN);
  assert.equal(unten.istpreisHinweis, "min");
  const oben = berechne("41747", 2500, "90", 12).vergleich;
  assert.equal(oben.istpreisCt, ISTPREIS_MAX);
  assert.equal(oben.istpreisHinweis, "max");
  assert.equal(berechne("41747", 2500, "35", 12).vergleich.istpreisHinweis, null);
});

// Review-Fund: Jahres-Grundpreis (z. B. 96 €) ergab über 1.000 € Fantasie-Ersparnis
pruefe("unplausibler Grundpreis ergibt keinen Vergleich", () => {
  assert.equal(ISTGRUNDPREIS_PLAUSIBEL, 30);
  for (const jahresbetrag of ["96", "150", "30,01"]) {
    const r = berechne("41747", 2500, 35, jahresbetrag);
    assert.equal(r.vergleich, null, jahresbetrag);
    assert.equal(r.grundpreisUnplausibel, true);
  }
  assert.notEqual(berechne("41747", 2500, 35, "30").vergleich, null);
});

pruefe("Randwerte gelten nicht als angepasst", () => {
  assert.equal(berechne("41747", "500", 35, 12).verbrauchAngehoben, false);
  assert.equal(berechne("41747", 2500, "10", 12).vergleich.istpreisHinweis, null);
  assert.equal(berechne("41747", 2500, "80", 12).vergleich.istpreisHinweis, null);
  assert.equal(berechne("41747", 2500, "1", 12).vergleich.istpreisHinweis, "min");
});

pruefe("angehobener Verbrauch wird auch im Vergleich verwendet", () => {
  assert.equal(berechne("41747", "100", 35, 12).vergleich.ersparnisJahr,
    berechne("41747", "500", 35, 12).vergleich.ersparnisJahr);
});

for (const roh of ["1.0000", "0.500"]) {
  pruefe(`Verbrauch "${roh}" mit falscher Tausendergruppe gilt als ungültig`, () => {
    assert.equal(berechne("41747", roh, 35, 12).status, "verbrauch-ungueltig");
  });
}

pruefe("deutsche Schreibweise wird verstanden", () => {
  assert.deepEqual(berechne("30627", "3.500", "35,5", "12,50"), berechne("30627", 3500, 35.5, 12.5));
  assert.deepEqual(berechne("30627", "3 500", " 35 ", " 12 "), berechne("30627", 3500, 35, 12));
  assert.deepEqual(berechne("30627", "12.000", "35", "12"), berechne("30627", 12000, 35, 12));
});

for (const roh of ["3,500", "1,5", "1.5", "1e5", "0x10", "abc", "-3500", "0", "-0", "", "2.500.0", "12.00"]) {
  pruefe(`Verbrauch "${roh}" gilt als ungültig`, () => {
    const r = berechne("30627", roh, 35, 12);
    assert.equal(r.status, "verbrauch-ungueltig");
    assert.equal(r.arbeitspreisCt, null);
    assert.equal(r.vergleich, null);
  });
}

pruefe("Verbrauch unter 500 kWh wird angehoben und gemeldet", () => {
  const r = berechne("30627", "100", 35, 12);
  assert.equal(r.verbrauchKwh, VERBRAUCH_MIN);
  assert.equal(r.verbrauchAngehoben, true);
  assert.equal(berechne("30627", "2500", 35, 12).verbrauchAngehoben, false);
});

pruefe("über 100.000 kWh gibt es keine Beträge, nur den Hinweis", () => {
  assert.equal(berechne("30627", GROSSVERBRAUCH_KWH, 35, 12).status, "ok");
  const r = berechne("30627", GROSSVERBRAUCH_KWH + 1, 35, 12);
  assert.equal(r.status, "grossverbrauch");
  assert.equal(r.gesamtJahr, null);
  assert.equal(berechne("30627", "9999999", 35, 12).status, "grossverbrauch");
});

pruefe("bekannte Postleitzahl wird erkannt", () => {
  const r = berechne("30627", 3500, 35, 12);
  assert.equal(r.quelle, "treffer");
  assert.equal(r.stadt, "Hannover");
  assert.equal(berechne("  30627 ", 3500, 35, 12).quelle, "treffer");
});

pruefe("unbekannte und leere Postleitzahl rechnen mit der Referenz", () => {
  assert.equal(berechne("99999", 3500, 35, 12).quelle, "referenz");
  assert.equal(berechne("", 3500, 35, 12).quelle, "leer");
  assert.equal(berechne("99999", 3500, 35, 12).stadt, PREISE[REFERENZ_PLZ].stadt);
});

for (const plz of ["1234", "123456", "3O627", "30627a", "toString", "valueOf", "constructor", "__proto__", "hasOwnProperty"]) {
  pruefe(`"${plz}" gilt nicht als Treffer`, () => {
    const r = berechne(plz, 3500, 35, 12);
    assert.notEqual(r.quelle, "treffer");
    assert.ok(isFinite(r.gesamtJahr));
  });
}

pruefe("geerbte Einträge der Datenquelle zählen nicht", () => {
  const geerbt = Object.create({ 12345: PREISE["30627"] });
  geerbt[REFERENZ_PLZ] = PREISE[REFERENZ_PLZ];
  assert.notEqual(berechne("12345", 3500, 35, 12, geerbt).quelle, "treffer");
});

pruefe("keine NaN-Ausgaben bei unsinnigen Eingaben", () => {
  const faelle = [["", "", "", ""], ["abc", "abc", "abc", "abc"], [null, undefined, NaN, NaN],
    ["30627", "2500", "Infinity", "Infinity"], ["30627", "2500", "1e999", "1e999"], [{}, [], {}, []]];
  for (const fall of faelle) {
    const r = berechne(...fall);
    for (const wert of [r.arbeitspreisCt, r.gesamtJahr, r.vergleich?.ersparnisJahr]) {
      assert.ok(wert == null || isFinite(wert), `nicht endlich bei ${JSON.stringify(fall)}`);
    }
  }
});

pruefe("Grundpreis folgt der Staffel", () => {
  const staffel = PREISE["30627"].grundpreisStaffel;
  assert.equal(berechne("30627", staffel[0][0], 35, 12).grundpreisMonat, staffel[0][1]);
  assert.equal(berechne("30627", staffel[1][0] - 1, 35, 12).grundpreisMonat, staffel[0][1]);
  assert.equal(berechne("30627", staffel[1][0], 35, 12).grundpreisMonat, staffel[1][1]);
  assert.equal(grundpreisAusStaffel([[0, 10], [1000, null], [2000, 30]], 1500), 10);
  assert.equal(grundpreisAusStaffel([[0, 10], [1000, null], [2000, 30]], 2500), 30);
});

pruefe("Preisdaten sind vollständig und gleich dem geprüften Datensatz", () => {
  for (const [plz, e] of Object.entries(PREISE)) {
    assert.match(plz, PLZ_MUSTER);
    assert.ok(isFinite(e.fBrutto) && e.fBrutto > 0, `fBrutto fehlt bei ${plz}`);
    assert.ok(isFinite(e.eReststromBrutto), `eReststromBrutto fehlt bei ${plz}`);
    assert.ok(Array.isArray(e.grundpreisStaffel) && e.grundpreisStaffel.length);
  }
  const original = JSON.parse(readFileSync(join(ROOT, "build", "preise.json"), "utf8"));
  assert.deepEqual(JSON.parse(JSON.stringify(PREISE)), original);
});

console.log("\nAnzeige");

pruefe("Referenzfall mit Grundpreis zeigt Preis, Monatskosten und kleine Ersparnis", () => {
  const t = anzeige(berechne("41747", 2500, 35, 12));
  assert.equal(t["r-preis"], "29,45 ct");
  assert.equal(t["r-monat"], "83,28 €");
  assert.equal(t["r-ersparnis-label"], "Ersparnis im Jahr");
  assert.equal(t["r-ersparnis"], "20 €");
  assert.equal(t["r-community"], "28,25 ct/kWh");
  assert.equal(t["r-rest"], "30,65 ct/kWh");
  assert.equal(t["r-grundpreis"], "18,03 €");
  assert.equal(t["r-lesekopf"], "3,90 €");
});

pruefe("Mehrkosten stehen ohne Vorzeichen und ohne doppeltes 'mehr'", () => {
  const t = anzeige(berechne("41747", 2500, 35, 0));
  assert.equal(t["r-ersparnis-label"], "Mehrkosten im Jahr");
  assert.match(t["r-ersparnis"], /^\d[\d.]* €$/);
});

pruefe("nur unter 1 € Unterschied heißt 'etwa gleich'", () => {
  const r = berechne("41747", 2500, 35, 12);
  for (const [differenz, text] of [[-0.4, "etwa gleich"], [0.9, "etwa gleich"], [1.5, "2 €"], [-1.5, "2 €"]]) {
    r.vergleich.ersparnisJahr = differenz;
    assert.equal(anzeige(r)["r-ersparnis"], text, `bei ${differenz}`);
  }
  r.vergleich.ersparnisJahr = -0.4;
  assert.equal(anzeige(r)["r-ersparnis-label"], "Unterschied im Jahr");
});

pruefe("ohne Vergleich steht ein Strich und eine Bitte im Status", () => {
  const t = anzeige(berechne("41747", 2500, 35, ""));
  assert.equal(t["r-ersparnis"], "–");
  assert.equal(t["r-ersparnis-label"], "Ersparnis im Jahr");
  assert.match(t["r-status"], /Grundpreis/);
});

pruefe("ungültiger Verbrauch und Großverbrauch zeigen nur Striche", () => {
  for (const r of [berechne("41747", "abc", 35, 12), berechne("41747", 200000, 35, 12)]) {
    const t = anzeige(r);
    for (const id of ["r-preis", "r-monat", "r-ersparnis", "r-community", "r-rest", "r-grundpreis", "r-lesekopf"]) {
      assert.equal(t[id], "–", `${id} bei ${r.status}`);
    }
  }
  assert.match(anzeige(berechne("41747", 200000, 35, 12))["r-status"], /individuelles Angebot/);
  assert.match(anzeige(berechne("41747", "abc", 35, 12))["r-status"], /Verbrauch/);
});

pruefe("Status unterscheidet Treffer und Beispielregion", () => {
  assert.match(anzeige(berechne("30627", 2500, 35, 12))["r-status"], /Hannover/);
  const referenz = anzeige(berechne("99999", 2500, 35, 12))["r-status"];
  assert.match(referenz, /noch keine Regionaldaten/);
  assert.doesNotMatch(referenz, /Netzentgelte(n)? für Viersen/);
  assert.match(anzeige(berechne("", 2500, 35, 12))["r-status"], /Postleitzahl/);
});

pruefe("angepasste Werte werden im Status genannt", () => {
  assert.match(anzeige(berechne("30627", "100", 35, 12))["r-status"], /500 kWh/);
  assert.match(anzeige(berechne("30627", 2500, "0,35", 12))["r-status"], /Euro/);
  assert.match(anzeige(berechne("30627", 2500, "9", 12))["r-status"], /10 ct/);
  assert.match(anzeige(berechne("30627", 2500, "90", 12))["r-status"], /80 ct/);
  assert.match(anzeige(berechne("30627", 2500, 35, "96"))["r-status"], /Jahresbetrag/);
  assert.match(anzeige(berechne("30627", 2500, "0,355", 12))["r-status"], /35,5 ct/);
  assert.equal(anzeige(berechne("30627", 2500, 35, "96"))["r-ersparnis"], "–");
});

pruefe("Anzeige liefert für jede Ausgabe-ID im Markup einen Text", () => {
  const t = anzeige(berechne("41747", 2500, 35, 12));
  for (const id of Object.keys(t)) assert.match(html, new RegExp(`id="${id}"`), `#${id} fehlt im Markup`);
  for (const id of ["r-preis", "r-monat", "r-ersparnis", "r-ersparnis-label", "r-community", "r-rest", "r-grundpreis", "r-lesekopf", "r-status"]) {
    assert.equal(typeof t[id], "string", `${id} fehlt in anzeige()`);
  }
});

console.log("\nAnbindung an die Seite");

// Minimale Seite: Elemente mit value/textContent und Ereignissen, ohne Abhängigkeit
function bauSeite() {
  const elemente = {};
  const element = (id) => (elemente[id] ??= {
    id, value: "", textContent: "", handler: {},
    addEventListener(typ, fn) { this.handler[typ] = fn; },
  });
  ["r-form", "r-plz", "r-verbrauch", "r-istpreis", "r-istgrundpreis"].forEach(element);
  return { elemente, document: { getElementById: (id) => element(id) } };
}

const seite = bauSeite();
seite.elemente["r-verbrauch"].value = "2500";
seite.elemente["r-istpreis"].value = "35";
globalThis.document = seite.document;
await import("../schlank/rechner.js?seite");

pruefe("Rechner füllt die Ausgaben beim Laden", () => {
  assert.equal(seite.elemente["r-preis"].textContent, "29,45 ct");
  assert.equal(seite.elemente["r-ersparnis"].textContent, "–");
});

pruefe("Rechner reagiert auf Eingaben", () => {
  seite.elemente["r-istgrundpreis"].value = "12";
  seite.elemente["r-form"].handler.input();
  assert.equal(seite.elemente["r-ersparnis"].textContent, "20 €");
  assert.equal(seite.elemente["r-monat"].textContent, "83,28 €");
});

pruefe("Absenden lädt die Seite nicht neu", () => {
  let verhindert = false;
  seite.elemente["r-form"].handler.submit({ preventDefault: () => { verhindert = true; } });
  assert.equal(verhindert, true);
});

console.log("\nAusgelieferte Seite");

pruefe("Rechner schreibt nur per textContent und lädt nichts nach", () => {
  assert.equal(/innerHTML|outerHTML|insertAdjacentHTML|document\.write|fetch\(|XMLHttpRequest|eval\(|new Function/.test(rechnerJs), false);
});

pruefe("Eingabefelder sind vorhanden und begrenzt", () => {
  assert.match(html, /id="r-form"/);
  assert.match(html, /id="r-plz"[^>]*maxlength="5"/);
  assert.match(html, /id="r-verbrauch"[^>]*maxlength="\d+"/);
  assert.match(html, /id="r-istpreis"[^>]*maxlength="\d+"/);
  assert.match(html, /id="r-istgrundpreis"[^>]*maxlength="\d+"/);
});

pruefe("nur eigene Skripte: Rechner und Anfrage-Link", () => {
  const skripte = html.match(/<script\b[^>]*>/g) || [];
  const ausfuehrbar = skripte.filter((tag) => !/type="application\/ld\+json"/.test(tag));
  assert.equal(ausfuehrbar.length, 2, ausfuehrbar.join(" "));
  assert.match(ausfuehrbar[0], /^<script type="module" src="rechner\.js\?v=\d+">$/);
  assert.match(ausfuehrbar[1], /^<script type="module" src="anfrage\.js\?v=\d+">$/);
});

pruefe("Markup und Stylesheet laden nichts Fremdes und tragen keine Handler", () => {
  const css = readFileSync(join(ROOT, "schlank", "style.css"), "utf8");
  assert.doesNotMatch(html, /\son[a-z]+\s*=/i, "Inline-Handler im Markup");
  assert.doesNotMatch(html, /<foreignObject|javascript:/i);
  assert.doesNotMatch(html, /<(image|use)\b[^>]*href="(?!#)/i, "SVG lädt Fremdes");
  assert.doesNotMatch(css, /@import/);
  for (const ziel of css.match(/url\(([^)]*)\)/g) || []) {
    assert.match(ziel, /^url\("?(fonts\/|#)/, `fremde Quelle im CSS: ${ziel}`);
  }
});

pruefe("CSP hat genau die erwarteten Direktiven", () => {
  const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
  assert.deepEqual(csp.split(";").map((d) => d.trim()).filter(Boolean).sort(), [
    "base-uri 'none'", "default-src 'none'", "font-src 'self'", "form-action 'none'",
    "img-src 'self'", "script-src 'self'", "style-src 'self'",
  ]);
});

pruefe("Labels sagen, was gemeint ist", () => {
  assert.match(html, /<label for="r-istpreis">Heutiger Arbeitspreis \(ct\/kWh\)<\/label>/);
  assert.match(html, /<label for="r-istgrundpreis">Heutiger Grundpreis \(€\/Monat\)<\/label>/);
  assert.match(html, /stehen auf deiner Stromrechnung/);
  assert.match(html, /gegenüber deinem heutigen Tarif, mit Grundpreis und Lesekopf/);
  assert.match(html, /Arbeitspreis, Grundpreis und Lesekopf-Miete/);
});

pruefe("Cache-Version von Skript und Preisdaten ist gleich", () => {
  const seite = html.match(/src="rechner\.js\?v=(\d+)"/)[1];
  const modul = rechnerJs.match(/from "\.\/preise\.js\?v=(\d+)"/)[1];
  assert.equal(seite, modul);
});

pruefe("kein Link auf den Detailrechner, solange dort die alte Ersparnis rechnet", () => {
  assert.doesNotMatch(html, /sslip\.io|robingut-potenzialrechner/);
});

pruefe("Hinweistext nennt Schätzung, Datenstand und Lesekopf sichtbar", () => {
  const hinweis = html.match(/<p class="calc-disc">([\s\S]*?)<\/p>/)[1].replace(/<[^>]+>/g, "");
  assert.match(hinweis, /Unverbindliche Schätzung/);
  assert.match(hinweis, /Stand Juli 2026/);
  assert.match(hinweis, /Lesekopf für 3,90/);
});

pruefe("jeder Link führt auf einen Anker, eine eigene Datei oder https", () => {
  const anker = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  const links = [...html.matchAll(/<a\b[^>]*\bhref=(["'])(.*?)\1/g)].map((m) => m[2]);
  assert.equal(links.length, (html.match(/<a\b[^>]*\bhref=/g) || []).length, "Link ohne Anführungszeichen");
  for (const ziel of links) {
    if (ziel === "#") continue;
    if (ziel.startsWith("#")) assert.ok(anker.has(ziel.slice(1)), `Anker fehlt: ${ziel}`);
    else if (/^(https:\/\/|mailto:|tel:)/.test(ziel)) continue;
    else {
      // Pfade ab der Wurzel landen auf github.io außerhalb des Projekts.
      assert.ok(ziel && !ziel.startsWith("/"), `Link ab der Wurzel: ${ziel}`);
      const pfad = ziel.split(/[?#]/)[0];
      const datei = join(ROOT, "schlank", pfad.endsWith("/") ? `${pfad}index.html` : pfad);
      assert.ok(existsSync(datei) && statSync(datei).isFile(), `Link führt ins Leere: ${ziel}`);
    }
  }
});

pruefe("jedes eingebundene Bild liegt im Projekt", () => {
  const quellen = [...html.matchAll(/<(?:img|source|link)\b[^>]*\b(?:src|srcset|href)\s*=\s*(["'])(.*?)\1/gi)]
    .filter((m) => !/rel="(canonical|alternate)"/.test(m[0]))
    .flatMap((m) => m[2].split(",").map((teil) => teil.trim().split(/\s+/)[0].split(/[?#]/)[0]));
  const css = readFileSync(join(ROOT, "schlank", "style.css"), "utf8");
  for (const [, ziel] of css.matchAll(/url\("?([^")#]+)"?\)/g)) quellen.push(ziel);
  assert.ok(quellen.length >= 10, "zu wenige Dateien gefunden");
  for (const ziel of quellen) {
    if (/^https:\/\/www\.robingut-strom\.de\//.test(ziel)) continue;
    assert.ok(!ziel.startsWith("/") && !/^https?:/.test(ziel), `Datei von außerhalb: ${ziel}`);
    const datei = join(ROOT, "schlank", ziel);
    assert.ok(existsSync(datei) && statSync(datei).isFile(), `Datei fehlt: ${ziel}`);
  }
  assert.doesNotMatch(html, /\sstyle\s*=/i, "Inline-Style im Markup");
});

const kontrast = (vorne, hinten) => {
  const hell = (hex) => {
    const kanal = [0, 2, 4].map((i) => parseInt(hex.slice(1 + i, 3 + i), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * kanal[0] + 0.7152 * kanal[1] + 0.0722 * kanal[2];
  };
  const [a, b] = [hell(vorne), hell(hinten)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
};

pruefe("Entwurfsmarkierung und Akzentgrün sind auf hellen Flächen gut sichtbar", () => {
  const css = readFileSync(join(ROOT, "schlank", "style.css"), "utf8");
  const farbe = (name) => css.match(new RegExp(`--${name}: (#[0-9a-f]{6});`))[1];
  for (const flaeche of ["#ffffff", farbe("bg"), farbe("bg-2"), farbe("sonne-hell"), farbe("sky")]) {
    assert.ok(kontrast(farbe("check"), flaeche) >= 4.5, `Markierung zu blass auf ${flaeche}`);
    assert.ok(kontrast(farbe("akzent"), flaeche) >= 5, `Akzentgrün zu blass auf ${flaeche}`);
  }
  assert.match(css, /mark\.check \{[^}]*border-bottom: 3px dashed var\(--check\)/);
});

pruefe("jedes Foto mit Menschen ist direkt als KI-Symbolbild gekennzeichnet", () => {
  const ohneKommentare = html.replace(/<!--[\s\S]*?-->/g, "");
  for (const bild of ["hero-familie", "verbraucher-sonne", "hof-sonne", "wald-sonne"]) {
    const stelle = ohneKommentare.indexOf(`bilder/${bild}`);
    assert.ok(stelle > 0, `Bild fehlt: ${bild}`);
    const hinweis = ohneKommentare.slice(stelle, stelle + 900).match(/<(span|figcaption)\b([^>]*)>Symbolbild, KI-generiert</);
    assert.ok(hinweis, `KI-Hinweis fehlt bei ${bild}`);
    assert.doesNotMatch(hinweis[2], /\shidden\b|aria-hidden/, `KI-Hinweis versteckt bei ${bild}`);
  }
  assert.match(ohneKommentare, /Fotos: KI-generierte Symbolbilder/);
  const css = readFileSync(join(ROOT, "schlank", "style.css"), "utf8");
  for (const [, regel] of css.matchAll(/\.(?:ki-hinweis|hero-ki|wald-bild figcaption)\b[^{]*\{([^}]*)\}/g)) {
    assert.doesNotMatch(regel, /display:\s*none|visibility:\s*hidden|opacity:\s*0[;\s]|z-index:\s*-|font-size:\s*0[;\s]|left:\s*-|clip/);
  }
});

pruefe("Kündigungsfrist im Hero bleibt bis zur AGB-Prüfung markiert", () => {
  assert.match(html, /<ul class="trust">[\s\S]*?<li><mark class="check"[^>]*AGB[^>]*>Monatlich kündbar<\/mark><\/li>/);
});

pruefe("Impressum und Datenschutz sind verlinkt", () => {
  assert.match(html, /<a href="https:\/\/www\.robingut-strom\.de\/impressum\/">Impressum<\/a>/);
  assert.match(html, /<a href="https:\/\/www\.robingut-strom\.de\/datenschutzerklaerung\/">Datenschutz<\/a>/);
});

pruefe("Entwurfshinweis steht sichtbar über der Seite", () => {
  const hinweis = html.match(/<p class="entwurf"[^>]*>([\s\S]*?)<\/p>/);
  assert.ok(hinweis, "Entwurfshinweis fehlt");
  assert.ok(html.indexOf('class="entwurf"') < html.indexOf('<header class="top">'));
  assert.doesNotMatch(hinweis[0], /\shidden\b|aria-hidden/);
  assert.match(hinweis[1], /Entwurf/);
  assert.match(hinweis[1], /bestätigt/);
  const css = readFileSync(join(ROOT, "schlank", "style.css"), "utf8");
  for (const [, regel] of css.matchAll(/\.entwurf\b[^{]*\{([^}]*)\}/g)) {
    assert.doesNotMatch(regel, /display:\s*none|visibility:\s*hidden|opacity:\s*0[;\s]/);
  }
  assert.match(css, /\.entwurf strong \{ color: inherit; \}/, "fetter Teil muss dunkel bleiben (Kontrast)");
});

console.log(`\n${bestanden} Prüfungen bestanden${process.exitCode ? " – mit Fehlern" : ""}`);
