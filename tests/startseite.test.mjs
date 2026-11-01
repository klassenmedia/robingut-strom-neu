// Prüft Aufbau und Leitplanken der Startseite (Briefing vom 01.11.2026).
//
//   node tests/startseite.test.mjs

import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

import { anfrageLink } from "../schlank/anfrage.js";
import { ROOT, pruefe, abschluss, ladeSeite } from "./seiten-hilfen.mjs";

const seite = ladeSeite("");
const { html, ohneKommentare, text } = seite;
const llms = readFileSync(join(ROOT, "schlank", "llms.txt"), "utf8");
const skripte = ["anfrage.js", "rechner.js", "preise.js"].map((datei) => readFileSync(join(ROOT, "schlank", datei), "utf8")).join("\n");
const meta = [...html.matchAll(/<meta\b[^>]*\bcontent="([^"]*)"/g)].map((m) => m[1]).join(" ") + " " + html.match(/<title>([^<]*)<\/title>/)[1];
const jsonLd = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
const ohneMarkierung = text.replace(/\s+/g, " ");
const ohneMarks = ohneKommentare.replace(/<mark class="check"[\s\S]*?<\/mark>/g, "")
  .replace(/<head>[\s\S]*?<\/head>/, "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
const abschnitt = (id) => {
  const treffer = ohneKommentare.match(new RegExp(`<section id="${id}"[\\s\\S]*?</section>`));
  assert.ok(treffer, `Abschnitt #${id} fehlt`);
  return treffer[0];
};

console.log("Aufbau wie im Briefing");

pruefe("Abschnitte in der Reihenfolge des Trichters", () => {
  const reihenfolge = ["start", "so-gehts", "warum", "wald", "fuer-wen", "preis", "fragen", "kontakt"];
  const stellen = reihenfolge.map((id) => ohneKommentare.indexOf(`<section id="${id}"`));
  stellen.forEach((stelle, i) => assert.ok(stelle > 0, `#${reihenfolge[i]} fehlt`));
  assert.deepEqual([...stellen].sort((a, b) => a - b), stellen, "Reihenfolge stimmt nicht");
});

pruefe("Einstieg: Kernaussage, Bild und genau die zwei Knöpfe", () => {
  const start = abschnitt("start");
  assert.match(start, /<h1>/);
  assert.match(start, /bilder\/hero-familie/);
  const knoepfe = [...start.matchAll(/<a class="btn[^"]*" href="([^"]+)">([^<]+)<\/a>/g)].map((m) => [m[2], m[1]]);
  assert.deepEqual(knoepfe, [["So funktioniert's", "#so-gehts"], ["Tarif prüfen", "#preis"]]);
  assert.match(start, /niemand sitzt im Dunkeln/i);
});

pruefe("Schaubild zeigt Erzeuger, Community, Verbraucher und Ökostrom als Reserve", () => {
  const teil = abschnitt("so-gehts");
  const svg = teil.match(/<svg class="schaubild"[\s\S]*?<\/svg>/);
  assert.ok(svg, "Schaubild fehlt");
  assert.match(svg[0], /role="img"/);
  for (const wort of ["Erzeuger", "Community", "Verbraucher", "Ökostrom"]) assert.match(svg[0], new RegExp(wort));
  assert.equal((teil.match(/<li>\s*<h3>/g) || []).length, 3, "drei Schritte");
});

pruefe("Warum ROBIN GUT: Stiftung, Region, Partner, monatlich kündbar", () => {
  const teil = abschnitt("warum");
  assert.match(teil, /Stiftung/);
  assert.match(teil, /Region/);
  assert.match(teil, /Lieferung, Bilanzkreis und Abrechnung übernimmt unser Partner/);
  assert.match(teil, /monatlich kündigen/);
});

pruefe("Für wen: drei Kacheln, Landwirte und Unternehmen auf eigenen Seiten, Kommunen-Hinweis", () => {
  const teil = abschnitt("fuer-wen");
  const kacheln = [...teil.matchAll(/<article class="card"[\s\S]*?<\/article>/g)].map((m) => m[0]);
  assert.equal(kacheln.length, 3);
  assert.match(kacheln[0], /Privathaushalte/);
  assert.match(kacheln[0], /href="#preis"/);
  assert.match(kacheln[1], /href="landwirte\/"/);
  assert.match(kacheln[2], /href="unternehmen\/"/);
  assert.match(teil, /href="unternehmen\/#kommunen"/);
  const unternehmen = readFileSync(join(ROOT, "schlank", "unternehmen", "index.html"), "utf8");
  assert.match(unternehmen, /<section id="kommunen"/);
});

pruefe("Fragen decken die Themen aus dem Briefing ab", () => {
  const fragen = [...abschnitt("fragen").matchAll(/<summary>([^<]+)<\/summary>/g)].map((m) => m[1]);
  for (const thema of [/Wechsel|wechsle/, /Lesekopf/, /kostet/, /Sonne/, /kündig/, /Daten/]) {
    assert.ok(fragen.some((f) => thema.test(f)), `Frage fehlt: ${thema}`);
  }
});

pruefe("strukturierte FAQ: nur geprüfte Antworten, Wortlaut wie sichtbar", () => {
  const faq = jsonLd["@graph"].find((knoten) => knoten["@type"] === "FAQPage");
  const sichtbar = [...abschnitt("fragen").matchAll(/<summary>([^<]+)<\/summary><p>([\s\S]*?)<\/p><\/details>/g)]
    .filter((m) => !m[2].includes("<mark"))
    .map((m) => [m[1], m[2].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ")]);
  assert.ok(sichtbar.length >= 5);
  assert.deepEqual(faq.mainEntity.map((frage) => [frage.name, frage.acceptedAnswer.text]), sichtbar);
});

pruefe("Kontakt: Anmeldung, Rückruf per Mail mit Code, Telefon", () => {
  const teil = abschnitt("kontakt");
  assert.match(teil, /href="https:\/\/weshareenergy\.de\/stromcommunitys\/neukunde\/robin-gut-strom"/);
  const rueckruf = [...teil.matchAll(/<a\b[^>]*\bdata-anfrage="([^"]+)"[^>]*href="([^"]+)"/g)];
  assert.equal(rueckruf.length, 1);
  assert.equal(rueckruf[0][1], "rueckruf");
  assert.equal(rueckruf[0][2].replace(/&amp;/g, "&"), anfrageLink(null, "rueckruf"));
  assert.match(teil, /href="tel:\+4922129282931"/);
  assert.match(teil, /<p id="code-hinweis"[^>]*data-ansprache="du"[^>]*\bhidden\b/);
});

pruefe("Rückruf-Vorlage in Du-Form mit Einwilligungsfrage", () => {
  const p = new URLSearchParams(anfrageLink("NEWSLETTER", "rueckruf").split("?")[1]);
  assert.equal(p.get("subject"), "Rückruf ROBIN GUT Strom · Code NEWSLETTER");
  assert.match(p.get("body"), /ruft mich bitte zurück/);
  assert.match(p.get("body"), /Bitte streichen Sie, was nicht zutrifft|Bitte streich, was nicht zutrifft/);
});

pruefe("Skripte: Rechner und Anfrage-Link, beide vom eigenen Server", () => {
  const skripte = [...html.matchAll(/<script\b[^>]*>/g)].map((m) => m[0]).filter((t) => !/ld\+json/.test(t));
  assert.deepEqual(skripte, ['<script type="module" src="rechner.js?v=3">', '<script type="module" src="anfrage.js?v=7">']);
});

console.log("Leitplanken");

pruefe("Partner ohne Namen: sichtbar, in JSON-LD und in llms.txt", () => {
  assert.doesNotMatch(text, /WeShare/i);
  assert.doesNotMatch(JSON.stringify(jsonLd), /WeShare/i);
  assert.doesNotMatch(llms, /WeShare|WSE/i);
  const nichtLinks = html.replace(/href="https:\/\/weshareenergy\.de\/[^"]*"/g, "");
  assert.doesNotMatch(nichtLinks, /WeShare|weshareenergy/i);
});

pruefe("Partner liefert und bilanziert, nicht ROBIN GUT – auch in Meta, JSON-LD und llms.txt", () => {
  for (const quelle of [text, meta, JSON.stringify(jsonLd), llms]) {
    assert.doesNotMatch(quelle, /ROBIN GUT( Strom)? (liefert|bilanziert|übernimmt|rechnet)/);
    assert.doesNotMatch(quelle, /(liefert|bilanziert|übernimmt|rechnet)( jetzt| auch)? ROBIN GUT/);
    assert.doesNotMatch(quelle, /(Lieferung|Bilanzkreis|Abrechnung)[^.]*übernehmen wir|liefern wir|bilanzieren wir/);
  }
});

pruefe("Partnername auch nicht in ausgelieferten Skripten", () => {
  assert.doesNotMatch(skripte, /WeShare|WSE-/i);
});

pruefe("„Partner“ meint nur den Lieferpartner, das Gegenüber in der Community heißt Erzeuger", () => {
  assert.doesNotMatch(text, /deine[ns]? Partner(s|n)?\b|Partnerpreis|Preis deines Partners/);
  assert.doesNotMatch(llms, /Partnerpreis|Partner wählen/);
});

pruefe("keine Preisversprechen, auch in Meta-Angaben, JSON-LD und llms.txt", () => {
  const meta = [...html.matchAll(/<meta\b[^>]*\bcontent="([^"]*)"/g)].map((m) => m[1]).join(" ");
  for (const quelle of [ohneMarkierung, meta, JSON.stringify(jsonLd), llms]) {
    assert.doesNotMatch(quelle, /günstiger|billiger|garantiert|klimaneutral|CO2-neutral|Kosten senken|\bspar\w*\b[^.]{0,25}\d|bis zu \d+ ?(%|€|Euro)|\d+ ?% weniger|verdoppel|halbier|lohnt sich (besonders|immer)/i);
  }
});

pruefe("Umweltaussagen nur markiert, nicht pauschal – auch in Meta, JSON-LD und llms.txt", () => {
  for (const quelle of [ohneMarks, meta, JSON.stringify(jsonLd), llms]) {
    assert.doesNotMatch(quelle, /Wald pflanzen|jeder (geteilten )?Kilowattstunde|jeder kWh|wächst Wald|Wald (stärken|schützen|retten)|grün(er|en|e) Strom|klimafreundlich|klimaresilient|CO₂?-?(frei|neutral)|CO2-?(frei|neutral)|umweltfreundlich/i);
  }
});

pruefe("ungeprüfte Zusagen stehen nur markiert im Text", () => {
  const muster = [/Ein Teil (fließt in Bäume|jedes Community-Stromgeschäfts)/, /im Preis schon enthalten/, /[Mm]onatlich kündbar|monatlich kündigen|Monatlich\./,
    /ganz Deutschland/, /Zählerdaten nutzt unser Partner/, /\[Zahl\]/, /18 bis 29/];
  for (const m of muster) {
    assert.match(text, m, `Aussage fehlt ganz: ${m}`);
    assert.doesNotMatch(ohneMarks, m, `unmarkiert: ${m}`);
  }
  assert.doesNotMatch(text, /nicht länger als einen Monat|In deiner Region\./);
  assert.doesNotMatch(llms, /für ganz Deutschland|18–29|[Mm]onatlich kündbar|Teil der Erlöse/);
  assert.match(llms, /Entwurf, Stand/);
});

pruefe("Begriff wie auf den Unterseiten: Stromcommunity statt Energy Sharing", () => {
  assert.doesNotMatch(text, /Energy Sharing/);
  assert.doesNotMatch(JSON.stringify(jsonLd), /Energy Sharing/);
});

pruefe("Entwurf bleibt aus Suchmaschinen heraus", () => {
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
});

pruefe("Netzentgelte nirgends als entfallen dargestellt", () => {
  assert.doesNotMatch(ohneMarks, /entfallen|keine Netzentgelte|ohne Netzentgelte/i);
});

pruefe("keine Eyebrow- oder Kicker-Zeilen", () => {
  assert.doesNotMatch(html, /class="[^"]*\b(eyebrow|kicker|tag)\b/);
});

pruefe("ROBIN GUT immer in Großbuchstaben, auch in llms.txt", () => {
  for (const quelle of [text, llms]) assert.doesNotMatch(quelle, /Robin (Gut|Good|Hood)/);
});

abschluss();
