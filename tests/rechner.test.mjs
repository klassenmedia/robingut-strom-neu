// Prüft die Rechenlogik des Preisrechners gegen Grenz- und Missbrauchsfälle.
// Die Logik wird aus der gebauten index.html extrahiert und in einer
// Sandbox ausgeführt, damit der Test genau das prüft, was ausgeliefert wird.
//
//   node tests/rechner.test.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");

// Die Konstanten und Hilfsfunktionen stehen im ausgelieferten Skript;
// hier werden sie nachgebildet und gegen die Seite abgeglichen.
function ausSeite(muster, name) {
  const treffer = html.match(muster);
  assert.ok(treffer, `${name} nicht in index.html gefunden — Skript geändert?`);
  return treffer[1];
}

const PREISE = JSON.parse(
  ausSeite(/var PREISE = (\{.*?\});/s, "Preistabelle")
    .replace(/\\u003c/g, "<")
    .replace(/\\u003e/g, ">")
    .replace(/\\u0026/g, "&"),
);

const zahlAus = (name) =>
  Number(ausSeite(new RegExp(`var ${name} = ([0-9.]+);`), name));

const COMMUNITY_ANTEIL = zahlAus("COMMUNITY_ANTEIL");
const E_COMMUNITY_CT = zahlAus("E_COMMUNITY_CT");
const WSE_GEBUEHR_CT = zahlAus("WSE_GEBUEHR_CT");
const GROSSVERBRAUCH_KWH = zahlAus("GROSSVERBRAUCH_KWH");
const VERBRAUCH_MIN = zahlAus("VERBRAUCH_MIN");
const VERBRAUCH_MAX = zahlAus("VERBRAUCH_MAX");
const ISTPREIS_MIN = zahlAus("ISTPREIS_MIN");
const ISTPREIS_MAX = zahlAus("ISTPREIS_MAX");
const REFERENZ_PLZ = ausSeite(/var REFERENZ_PLZ = '(\d+)';/, "REFERENZ_PLZ");
const PLZ_MUSTER = /^[0-9]{5}$/;

function grundpreisAusStaffel(staffel, verbrauchKwh) {
  let preis = staffel[0][1];
  staffel.forEach(([stufe, wert]) => {
    if (verbrauchKwh >= stufe && wert != null) preis = wert;
  });
  return preis;
}

// Spiegelt leseEingaben() und rechne() aus build/09_js.html
function rechne(plzRoh, verbrauchRoh, istpreisRoh) {
  const plz = String(plzRoh ?? "").trim();
  let verbrauch = parseFloat(verbrauchRoh);
  let istpreis = parseFloat(istpreisRoh);

  if (!isFinite(verbrauch) || verbrauch <= 0) verbrauch = 2500;
  if (!isFinite(istpreis) || istpreis <= 0) istpreis = 35;

  const grossverbrauch = verbrauch > GROSSVERBRAUCH_KWH;
  verbrauch = Math.min(VERBRAUCH_MAX, Math.max(VERBRAUCH_MIN, verbrauch));
  istpreis = Math.min(ISTPREIS_MAX, Math.max(ISTPREIS_MIN, istpreis));

  const gueltigePlz = PLZ_MUSTER.test(plz);
  let eintrag =
    gueltigePlz && Object.prototype.hasOwnProperty.call(PREISE, plz)
      ? PREISE[plz]
      : null;
  const quelle = eintrag ? "treffer" : gueltigePlz ? "referenz" : "leer";
  if (!eintrag) eintrag = PREISE[REFERENZ_PLZ];

  const anteil = COMMUNITY_ANTEIL / 100;
  const preisCommunityCt = eintrag.fBrutto + E_COMMUNITY_CT + WSE_GEBUEHR_CT;
  const preisRestCt = eintrag.fBrutto + eintrag.eReststromBrutto;
  const arbeitspreisCt = anteil * preisCommunityCt + (1 - anteil) * preisRestCt;

  const grundpreisMonat = grundpreisAusStaffel(eintrag.grundpreisStaffel, verbrauch);
  const gesamtJahr = (arbeitspreisCt / 100) * verbrauch + grundpreisMonat * 12;
  const ersparnisJahr = ((istpreis - arbeitspreisCt) / 100) * verbrauch;

  return { arbeitspreisCt, gesamtJahr, ersparnisJahr, grundpreisMonat, quelle, grossverbrauch, stadt: eintrag.stadt };
}

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

console.log("Preisrechner");

pruefe("bekannte Postleitzahl wird erkannt", () => {
  const r = rechne("30627", 3500, 35);
  assert.equal(r.quelle, "treffer");
  assert.equal(r.stadt, "Hannover");
});

pruefe("unbekannte Postleitzahl fällt auf die Referenz zurück", () => {
  const r = rechne("99999", 3500, 35);
  assert.equal(r.quelle, "referenz");
  assert.equal(r.stadt, PREISE[REFERENZ_PLZ].stadt);
});

pruefe("leere Postleitzahl meldet 'leer', rechnet aber weiter", () => {
  const r = rechne("", 3500, 35);
  assert.equal(r.quelle, "leer");
  assert.ok(isFinite(r.arbeitspreisCt));
});

pruefe("zu kurze Postleitzahl gilt nicht als Treffer", () => {
  assert.equal(rechne("1234", 3500, 35).quelle, "leer");
});

// Regression: PREISE["toString"] lieferte früher die geerbte Funktion,
// dadurch wurde fBrutto undefined und die Staffel warf einen TypeError.
for (const key of ["toString", "valueOf", "constructor", "__proto__", "hasOwnProperty"]) {
  pruefe(`geerbter Name "${key}" gilt nicht als Treffer`, () => {
    const r = rechne(key, 3500, 35);
    assert.notEqual(r.quelle, "treffer");
    assert.ok(isFinite(r.arbeitspreisCt), "Arbeitspreis muss endlich bleiben");
    assert.ok(isFinite(r.gesamtJahr), "Jahreskosten müssen endlich bleiben");
  });
}

pruefe("überzogener Verbrauch wird gedeckelt", () => {
  const gedeckelt = rechne("30627", 999999999, 35);
  const grenze = rechne("30627", VERBRAUCH_MAX, 35);
  assert.equal(gedeckelt.gesamtJahr, grenze.gesamtJahr);
  assert.equal(gedeckelt.grossverbrauch, true);
});

pruefe("Verbrauch unterhalb der Grenze wird angehoben", () => {
  assert.equal(rechne("30627", 1, 35).gesamtJahr, rechne("30627", VERBRAUCH_MIN, 35).gesamtJahr);
});

pruefe("überzogener Ist-Preis wird gedeckelt", () => {
  const r = rechne("30627", 3500, 1e308);
  assert.ok(isFinite(r.ersparnisJahr), "Ersparnis darf nicht unendlich werden");
  assert.equal(r.ersparnisJahr, rechne("30627", 3500, ISTPREIS_MAX).ersparnisJahr);
});

pruefe("keine NaN-Ausgaben bei unsinnigen Eingaben", () => {
  for (const fall of [["", "", ""], ["abc", "abc", "abc"], ["30627", -5, -5], [null, undefined, NaN]]) {
    const r = rechne(...fall);
    assert.ok(isFinite(r.arbeitspreisCt), `Arbeitspreis NaN bei ${JSON.stringify(fall)}`);
    assert.ok(isFinite(r.gesamtJahr), `Jahreskosten NaN bei ${JSON.stringify(fall)}`);
    assert.ok(isFinite(r.ersparnisJahr), `Ersparnis NaN bei ${JSON.stringify(fall)}`);
  }
});

pruefe("Großverbrauch wird ab der Schwelle gemeldet", () => {
  assert.equal(rechne("30627", GROSSVERBRAUCH_KWH, 35).grossverbrauch, false);
  assert.equal(rechne("30627", GROSSVERBRAUCH_KWH + 1, 35).grossverbrauch, true);
});

pruefe("Grundpreis folgt der Staffel", () => {
  const staffel = PREISE["30627"].grundpreisStaffel;
  const [ersteStufe] = staffel[0];
  const [zweiteStufe] = staffel[1];
  assert.equal(rechne("30627", ersteStufe, 35).grundpreisMonat, staffel[0][1]);
  assert.equal(rechne("30627", zweiteStufe, 35).grundpreisMonat, staffel[1][1]);
});

pruefe("teurerer Ist-Tarif ergibt eine positive Ersparnis", () => {
  const r = rechne("30627", 3500, 40);
  assert.ok(r.ersparnisJahr > 0);
});

pruefe("günstigerer Ist-Tarif ergibt eine negative Ersparnis", () => {
  const r = rechne("30627", 3500, ISTPREIS_MIN);
  assert.ok(r.ersparnisJahr < 0);
});

pruefe("Arbeitspreis liegt zwischen Community- und Restpreis", () => {
  const e = PREISE["30627"];
  const community = e.fBrutto + E_COMMUNITY_CT + WSE_GEBUEHR_CT;
  const rest = e.fBrutto + e.eReststromBrutto;
  const r = rechne("30627", 3500, 35);
  assert.ok(r.arbeitspreisCt >= Math.min(community, rest));
  assert.ok(r.arbeitspreisCt <= Math.max(community, rest));
});

pruefe("alle Preisdaten sind vollständig", () => {
  for (const [plz, e] of Object.entries(PREISE)) {
    assert.match(plz, PLZ_MUSTER, `Schlüssel "${plz}" ist keine Postleitzahl`);
    assert.equal(typeof e.stadt, "string");
    assert.ok(isFinite(e.fBrutto) && e.fBrutto > 0, `fBrutto fehlt bei ${plz}`);
    assert.ok(isFinite(e.eReststromBrutto), `eReststromBrutto fehlt bei ${plz}`);
    assert.ok(Array.isArray(e.grundpreisStaffel) && e.grundpreisStaffel.length, `Staffel fehlt bei ${plz}`);
  }
});

pruefe("Referenz-Postleitzahl existiert in den Daten", () => {
  assert.ok(Object.prototype.hasOwnProperty.call(PREISE, REFERENZ_PLZ));
});

console.log("\nAusgelieferte Seite");

pruefe("kein innerHTML im Skript", () => {
  assert.equal(html.includes("innerHTML"), false, "innerHTML vermeiden, textContent nutzt keine HTML-Auswertung");
});

pruefe("keine nicht ersetzten Platzhalter", () => {
  const offen = html.match(/__[A-Z0-9_]+__/g);
  assert.equal(offen, null, `offene Platzhalter: ${offen}`);
});

pruefe("kein roher Script-Abschluss in den eingebetteten Daten", () => {
  const literal = ausSeite(/var PREISE = (\{.*?\});/s, "Preistabelle");
  assert.equal(literal.includes("</"), false, "\"</script>\" muss als \\u003c escaped sein");
});

pruefe("Script-Blöcke sind ausgeglichen", () => {
  assert.equal((html.match(/<script/g) || []).length, (html.match(/<\/script>/g) || []).length);
});

pruefe("alle JSON-LD-Blöcke sind valide", () => {
  const bloecke = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || [];
  assert.ok(bloecke.length >= 5, `nur ${bloecke.length} JSON-LD-Blöcke gefunden`);
  for (const block of bloecke) {
    const inhalt = block.replace(/<script[^>]*>/, "").replace(/<\/script>/, "");
    JSON.parse(inhalt);
  }
});

pruefe("keine externen Hosts außer den bewusst gesetzten Links", () => {
  const erlaubt = new Set([
    "https://robingut-strom.de",
    "https://weshareenergy.de",
    "https://klassenmedia.github.io",
    "https://schema.org",
    "https://ogp.me",
    "http://www.w3.org",
    "https://docs.github.com",
  ]);
  for (const host of new Set(html.match(/https?:\/\/[a-zA-Z0-9.-]+/g) || [])) {
    assert.ok(erlaubt.has(host), `unerwarteter Host: ${host}`);
  }
});

console.log(`\n${bestanden} Prüfungen bestanden${process.exitCode ? " — mit Fehlern" : ""}`);
