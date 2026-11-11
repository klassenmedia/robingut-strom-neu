// Prüft das Schaubild „Kundenfall Bauunternehmen“ (WordPress-HTML-Block der Unternehmensseite):
// jede Zahl, jeder Prozentwert und jede Balkenbreite folgt aus Erzeugung, Verbrauch und Eigenzuordnung.
//
//   node tests/kundenfall-unternehmen.test.mjs

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "wordpress", "kundenfall-unternehmen.html"), "utf8");

const ERZEUGUNG_MWH = 12400;
const VERBRAUCH_MWH = 4100;
const EIGEN_MWH = 3100;
const COMMUNITY_MWH = ERZEUGUNG_MWH - EIGEN_MWH;
const NETZ_MWH = VERBRAUCH_MWH - EIGEN_MWH;

const NBSP = " ";
const deZahl = (wert) => wert.toLocaleString("de-DE");
const prozent = (teil, ganz) => Math.round((teil / ganz) * 100);
const ohneTags = (text) => text.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, NBSP).replace(/[ \t\r\n]+/g, " ").trim();

const karten = html.split('<div class="rg-fall-karte">').slice(1);
const balken = (teil) => [...teil.matchAll(/<div class="rg-fall-balken[^"]*"[^>]*>([\s\S]*?)<\/div>/g)].map((treffer) =>
  [...treffer[1].matchAll(/<span class="rg-seg ([a-z-]+)" style="width:(\d+)%">([^<]*)<\/span>/g)]
    .map(([, farbe, breite, text]) => ({ farbe, breite: Number(breite), text: ohneTags(text) })));
const legende = (teil) => [...teil.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((treffer) => ohneTags(treffer[1]));

let bestanden = 0;
function pruefe(name, fn) {
  try { fn(); bestanden += 1; console.log(`  ok  ${name}`); }
  catch (fehler) { console.error(`  FEHLER  ${name}\n        ${fehler.message.split("\n")[0]}`); process.exitCode = 1; }
}

console.log("Kundenfall Unternehmen (Schaubild)");

pruefe("zwei Karten, drei Balken", () => {
  assert.equal(karten.length, 2);
  assert.equal(balken(karten[0]).length, 2);
  assert.equal(balken(karten[1]).length, 1);
});

pruefe("jeder Balken ergibt 100 %, Beschriftung = Breite", () => {
  for (const segmente of [...balken(karten[0]), ...balken(karten[1])]) {
    assert.equal(segmente.reduce((summe, s) => summe + s.breite, 0), 100);
    for (const s of segmente) assert.equal(s.text, `${s.breite}${NBSP}%`);
  }
});

pruefe("Karte 1: Erzeugung vorher komplett Netz, nachher Standorte + Community", () => {
  const [vorher, nachher] = balken(karten[0]);
  assert.match(ohneTags(karten[0]), new RegExp(`Erzeugung: ${deZahl(ERZEUGUNG_MWH)}${NBSP}MWh im Jahr`));
  assert.deepEqual(vorher.map((s) => [s.farbe, s.breite]), [["rg-seg-netz", 100]]);
  assert.deepEqual(nachher.map((s) => [s.farbe, s.breite]), [
    ["rg-seg-eigen", prozent(EIGEN_MWH, ERZEUGUNG_MWH)],
    ["rg-seg-community", prozent(COMMUNITY_MWH, ERZEUGUNG_MWH)],
  ]);
  const [l1, l2, l3] = legende(karten[0]);
  assert.ok(l1.startsWith(`${deZahl(ERZEUGUNG_MWH)}${NBSP}MWh (100${NBSP}%)`), l1);
  assert.ok(l2.startsWith(`${deZahl(EIGEN_MWH)}${NBSP}MWh (${prozent(EIGEN_MWH, ERZEUGUNG_MWH)}${NBSP}%)`), l2);
  assert.ok(l3.startsWith(`${deZahl(COMMUNITY_MWH)}${NBSP}MWh (${prozent(COMMUNITY_MWH, ERZEUGUNG_MWH)}${NBSP}%)`), l3);
});

pruefe("Karte 2: Verbrauch der Standorte, bilanziell eigen + Netz", () => {
  const [verbrauch] = balken(karten[1]);
  assert.match(ohneTags(karten[1]), new RegExp(`Nachher: Verbrauch ${deZahl(VERBRAUCH_MWH)}${NBSP}MWh im Jahr = 100${NBSP}%`));
  assert.deepEqual(verbrauch.map((s) => [s.farbe, s.breite]), [
    ["rg-seg-eigen", prozent(EIGEN_MWH, VERBRAUCH_MWH)],
    ["rg-seg-netz", prozent(NETZ_MWH, VERBRAUCH_MWH)],
  ]);
  const [eigen, netz] = legende(karten[1]);
  assert.ok(eigen.startsWith(`${prozent(EIGEN_MWH, VERBRAUCH_MWH)}${NBSP}% (${deZahl(EIGEN_MWH)}${NBSP}MWh) bilanziell aus den eigenen Anlagen`), eigen);
  assert.ok(netz.startsWith(`${prozent(NETZ_MWH, VERBRAUCH_MWH)}${NBSP}% (${deZahl(NETZ_MWH)}${NBSP}MWh)`), netz);
});

pruefe("keine Skripte, Ereignis-Attribute oder externen Adressen", () => {
  assert.doesNotMatch(html, /<script|\son[a-z]+=|https?:|url\(/i);
});

console.log(`\n${bestanden} Prüfungen bestanden`);
