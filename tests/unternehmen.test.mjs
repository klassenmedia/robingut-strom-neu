// Prüft die Unternehmen-Seite, vor allem die Zahlen der Praxisbeispiele.
//
//   node tests/unternehmen.test.mjs

import assert from "node:assert/strict";

import { pruefe, abschluss, ladeSeite, gemeinsamePruefungen, zahlenIn, deZahl } from "./seiten-hilfen.mjs";

const seite = ladeSeite("unternehmen");
const beispiel = (nummer) => {
  const treffer = seite.ohneKommentare.match(new RegExp(`<article class="praxis" id="praxis-${nummer}">[\\s\\S]*?</article>`));
  assert.ok(treffer, `Praxisbeispiel ${nummer} fehlt`);
  return treffer[0];
};

console.log("Praxisbeispiele (Zahlen aus der Unternehmenspräsentation)");

pruefe("Kundenfall Bauunternehmen: jede Zahl folgt aus dem Rechenweg", () => {
  const anlagenMwh = [5900, 1900, 400, 4200];
  const standorteMwh = [1800, 1200, 1100];
  const selbstGenutzt = 3100;
  const ersparnisCt = 1.29;
  const erzeugung = anlagenMwh.reduce((a, b) => a + b);
  const verbrauch = standorteMwh.reduce((a, b) => a + b);
  const ersparnisEuro = Math.round((verbrauch * 1000 * ersparnisCt) / 100 / 1000) * 1000;
  const mwh = (wert) => `${deZahl(wert)} MWh`;
  assert.ok(selbstGenutzt <= verbrauch && selbstGenutzt <= erzeugung);
  assert.deepEqual(zahlenIn(beispiel(1)), [
    mwh(erzeugung), mwh(verbrauch),
    `${Math.round((selbstGenutzt / verbrauch) * 100)} %`, mwh(selbstGenutzt),
    mwh(erzeugung - selbstGenutzt),
    `${deZahl(ersparnisCt, 2)} ct`, `${deZahl(ersparnisEuro)} €`,
    mwh(verbrauch),
  ]);
  assert.match(beispiel(1), /<h3>Kundenfall:/);
});

pruefe("Modellrechnung Logistik: jede Zahl folgt aus dem Rechenweg", () => {
  const gesamtGwh = 50, arbeitspreisCt = 12, pvGwh = 15;
  const teile = [{ gwh: pvGwh, ct: 6 }, { gwh: 25, ct: 5 }, { gwh: 10, ct: arbeitspreisCt }];
  assert.equal(teile.reduce((s, t) => s + t.gwh, 0), gesamtGwh, "Mengen ergeben nicht den Verbrauch");
  const mio = (gwh, ct) => (gwh * 1e6 * ct) / 100 / 1e6;
  const vorher = mio(gesamtGwh, arbeitspreisCt);
  const nachher = teile.reduce((s, t) => s + mio(t.gwh, t.ct), 0);
  const euro = (wert, stellen = 2) => `${deZahl(wert, stellen)} Mio. €`;
  assert.deepEqual(zahlenIn(beispiel(2)), [
    `${gesamtGwh} GWh`, `${arbeitspreisCt} ct/kWh`, euro(vorher, 1), `${pvGwh} GWh`,
    ...teile.flatMap((t) => [euro(mio(t.gwh, t.ct)), `${t.gwh} GWh`, `${t.ct} ct/kWh`]),
    euro(nachher), euro(vorher, 1), euro(vorher - nachher), `${Math.round(((vorher - nachher) / vorher) * 100)} %`,
  ]);
});

pruefe("Modellrechnung ist als Annahme erkennbar, Ergebnis markiert", () => {
  const text = beispiel(2);
  assert.match(text, /<h3>Modellrechnung \(Annahme\):/);
  assert.match(text, /Annahme, kein Angebot/);
  assert.match(text, /müssen erst errichtet werden/);
  assert.match(text, /<li><mark class="check"[^>]*Landwirte[^>]*><strong>[^<]*<\/strong>Community-Strom/, "Community-Preis bis zum Abgleich markiert");
  assert.match(text, /<mark class="check"[^>]*>Unter diesen Annahmen[^<]*44&nbsp;% weniger\.<\/mark>/);
});

pruefe("jedes Praxisbeispiel nennt Netzentgelte und Grenzen der Rechnung", () => {
  assert.match(beispiel(1), /Netzentgelte, Umlagen und Stromsteuer fallen weiter an/);
  assert.match(beispiel(2), /Auf Community-Strom fallen die gleichen Abgaben und Netzentgelte an/);
  assert.match(beispiel(2), /nur der Energiepreis/);
});

pruefe("Veröffentlichung und Vergleichsbasis sind bis zur Freigabe markiert", () => {
  assert.match(seite.ohneKommentare, /<section id="beispiele"[\s\S]*?<mark class="check"[^>]*>[^<]*Kundenfall/);
  assert.match(beispiel(1), /<mark class="check"[^>]*>Vergleichsbasis/);
});

console.log("Unternehmen-Seite");

pruefe("Botschaft: Standorte nutzen eigenen Strom, Netzentgelte fallen weiter an", () => {
  const h1 = seite.ohneKommentare.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)[1];
  assert.match(h1, /Standort/);
  const lead = seite.ohneKommentare.match(/<p class="lead">([\s\S]*?)<\/p>/)[1];
  assert.match(lead, /Netzentgelte, Umlagen und Stromsteuer/);
});

pruefe("Hauptknopf führt zur Lastgang-Analyse", () => {
  const knoepfe = [...seite.ohneKommentare.matchAll(/<a\b[^>]*class="btn[^"]*"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => m[1]);
  assert.ok(knoepfe.some((t) => /Lastgang-Analyse anfragen/.test(t)), "Knopf fehlt");
});

pruefe("Absatz für Kommunen und Stadtwerke ohne Namen des Pilot-Stadtwerks", () => {
  assert.match(seite.ohneKommentare, /<h2[^>]*>Für Kommunen und Stadtwerke<\/h2>/);
  assert.doesNotMatch(seite.text, /Pilot/i);
});

pruefe("Aussage zu § 42c ist bis zur Klärung markiert", () => {
  const stellen = [...seite.ohneKommentare.matchAll(/42c/g)];
  assert.ok(stellen.length >= 1);
  assert.match(seite.ohneKommentare, /<mark class="check"[^>]*>[^<]*§&nbsp;42c/);
});

gemeinsamePruefungen(seite, { art: "firma", titelbild: "firma-sonne" });

abschluss();
