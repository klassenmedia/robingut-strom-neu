// Prüft den Flyer-Kasten der Landwirte-Seite (WordPress-HTML-Block): Wortlaut exakt wie auf dem Flyer
// (Vorgabe Dieter/Timo 11.11.2026), Beträge rechnerisch stimmig, kein ausführbarer Inhalt.
//
//   node tests/landwirte-flyer.test.mjs

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "wordpress", "landwirte-flyer.html"), "utf8");

const ohneTags = (text) => text.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
  .replace(/[  \t\r\n]+/g, " ").trim();
const euro = (text) => Number(text.replace(/[^\d]/g, ""));

const beispiele = [...html.matchAll(/<article class="rg-flyer-beispiel">([\s\S]*?)<\/article>/g)].map((t) => t[1]);
const zeilen = (teil) => [...teil.matchAll(/<dt>([\s\S]*?)<\/dt>\s*<dd>([\s\S]*?)<\/dd>/g)]
  .map(([, was, betrag]) => [ohneTags(was), ohneTags(betrag)]);
const feld = (teil, klasse) => {
  const treffer = teil.match(new RegExp(`class="${klasse}">([\\s\\S]*?)</(?:p|h3|span|strong)>`));
  assert.ok(treffer, `${klasse} fehlt`);
  return ohneTags(treffer[1]);
};

let bestanden = 0;
function pruefe(name, fn) {
  try { fn(); bestanden += 1; console.log(`  ok  ${name}`); }
  catch (fehler) { console.error(`  FEHLER  ${name}\n        ${fehler.message.split("\n")[0]}`); process.exitCode = 1; }
}

console.log("Landwirte: Flyer-Kasten");

pruefe("zwei Beispiele", () => assert.equal(beispiele.length, 2));

pruefe("Beispiel 1: Wortlaut wie Flyer", () => {
  const b = beispiele[0];
  assert.equal(feld(b, "rg-flyer-titel"), "Beispiel 1 · Volleinspeisung");
  assert.equal(feld(b, "rg-flyer-unter"), "100.000 kWh/Jahr, kein Verbrauch vor Ort");
  assert.deepEqual(zeilen(b), [
    ["Einspeisung zum Marktwert (5 ct/kWh)", "5.000 €"],
    ["Verkauf in der Community (12 ct/kWh)", "12.000 €"],
  ]);
  assert.equal(feld(b, "rg-flyer-plus-titel"), "Ihr Plus pro Jahr");
  assert.equal(feld(b, "rg-flyer-plus-zusatz"), "mehr Erlös");
  assert.equal(feld(b, "rg-flyer-betrag"), "+ 7.000 €");
});

pruefe("Beispiel 2: Wortlaut wie Flyer", () => {
  const b = beispiele[1];
  assert.equal(feld(b, "rg-flyer-titel"), "Beispiel 2 · Betriebsstätten vernetzen");
  assert.equal(feld(b, "rg-flyer-unter"), "Hälfte verkaufen, Hälfte an 2. Betriebsstätte nutzen");
  assert.deepEqual(zeilen(b), [
    ["50 % Verkauf Community (12 statt 5 ct)", "+ 3.500 €"],
    ["50 % Eigennutzung (16 statt 5 ct)*", "+ 5.500 €"],
  ]);
  assert.equal(feld(b, "rg-flyer-plus-titel"), "Ihr Plus pro Jahr");
  assert.equal(feld(b, "rg-flyer-plus-zusatz"), "Betriebsstätte 2: 50 % autark");
  assert.equal(feld(b, "rg-flyer-betrag"), "+ 9.000 €");
});

pruefe("Fußnote: Wortlaut wie Flyer", () => {
  assert.equal(feld(html, "rg-flyer-fussnote"),
    "Keine Prognose oder Erlöszusage. Tatsächliche Erlöse und Kosten können insbesondere wegen Marktpreisen, " +
    "vermarktbarer Strommenge, Messkonzept, technischen Voraussetzungen, Entgelten, Abgaben, Steuern und " +
    "individuellen Vertragsbedingungen abweichen. Alle ct-Werte angenommen. *Annahme: Betriebsstätte 2 verbraucht " +
    "100.000 kWh, 50 % davon deckt eigener Strom. Gespart: 16 ct Einkauf (Energiepreis Neuabschluss, ohne " +
    "Netzentgelte, Umlagen, Steuern) minus 5 ct entgangene Einspeisevergütung = 11 ct × 50.000 kWh = 5.500 €.");
});

pruefe("Beträge rechnerisch stimmig", () => {
  const MENGE_KWH = 100000;
  const [markt, community] = zeilen(beispiele[0]).map(([, betrag]) => euro(betrag));
  assert.equal(markt, MENGE_KWH * 0.05);
  assert.equal(community, MENGE_KWH * 0.12);
  assert.equal(euro(feld(beispiele[0], "rg-flyer-betrag")), community - markt);
  const [verkauf, eigen] = zeilen(beispiele[1]).map(([, betrag]) => euro(betrag));
  assert.equal(verkauf, Math.round(MENGE_KWH / 2 * (0.12 - 0.05)));
  assert.equal(eigen, Math.round(MENGE_KWH / 2 * (0.16 - 0.05)));
  assert.equal(euro(feld(beispiele[1], "rg-flyer-betrag")), verkauf + eigen);
});

pruefe("kein Text außerhalb der geprüften Felder", () => {
  const felder = [...html.matchAll(/class="(?:rg-flyer-titel|rg-flyer-unter|rg-flyer-plus-titel|rg-flyer-plus-zusatz|rg-flyer-betrag|rg-flyer-fussnote)">([\s\S]*?)<\/(?:p|h3|span|strong)>/g)]
    .map((t) => ohneTags(t[1]));
  const zeilenText = beispiele.flatMap((b) => zeilen(b).flat());
  assert.equal(ohneTags(html).length, [...felder, ...zeilenText].join(" ").length);
});

pruefe("nur erlaubte Tags und Attribute, kein ausführbarer Inhalt", () => {
  const ERLAUBT = new Set(["div", "article", "h3", "p", "dl", "dt", "dd", "strong", "span"]);
  for (const [, name, attribute] of html.matchAll(/<\/?([a-z0-9]+)([^>]*)>/gi)) {
    assert.ok(ERLAUBT.has(name.toLowerCase()), `Tag <${name}> nicht erlaubt`);
    assert.match(attribute, /^(\s+class="[a-z0-9 -]+")?\s*$/, `Attribut nicht erlaubt: ${attribute}`);
  }
  assert.doesNotMatch(html, /<script|<style|\son[a-z]+=|https?:|url\(|javascript:/i);
});

console.log(`\n${bestanden} Prüfungen bestanden`);
