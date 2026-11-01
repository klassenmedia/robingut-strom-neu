// Prüft Aufbau und Leitplanken der Startseite (Briefing vom 01.11.2026).
//
//   node tests/startseite.test.mjs

import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

import { anfrageLink } from "../schlank/anfrage.js";
import { E_COMMUNITY_CT, WSE_GEBUEHR_CT } from "../schlank/rechner.js";
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

pruefe("Abschnitte in der Reihenfolge des Trichters, Zielgruppen direkt unter dem Einstieg (Meeting)", () => {
  const reihenfolge = ["start", "fuer-wen", "so-gehts", "warum", "wald", "preis", "fragen", "kontakt"];
  const stellen = reihenfolge.map((id) => ohneKommentare.indexOf(`<section id="${id}"`));
  stellen.forEach((stelle, i) => assert.ok(stelle > 0, `#${reihenfolge[i]} fehlt`));
  assert.deepEqual([...stellen].sort((a, b) => a - b), stellen, "Reihenfolge stimmt nicht");
});

pruefe("Einstieg: Kernaussage, Bild und genau die zwei Knöpfe", () => {
  const start = abschnitt("start");
  assert.match(start, /<h1>/);
  assert.match(start, /bilder\/hero-community-1749\.webp/);
  assert.doesNotMatch(html, /hero-familie/);
  const knoepfe = [...start.matchAll(/<a class="btn[^"]*" href="([^"]+)">([^<]+)<\/a>/g)].map((m) => [m[2], m[1]]);
  assert.deepEqual(knoepfe, [["So funktioniert's", "#so-gehts"], ["Tarif prüfen", "#preis"]]);
  assert.match(start, /niemand sitzt im Dunkeln/i);
});

pruefe("Einstieg zeigt Dieter Könnes mit Porträt und markiertem Zitat", () => {
  const dieter = abschnitt("start").match(/<figure class="dieter"[\s\S]*?<\/figure>/);
  assert.ok(dieter, "Dieter-Block fehlt");
  assert.match(dieter[0], /<img src="bilder\/dieter-koennes-240\.webp"[^>]*alt="Dieter Könnes"/);
  assert.match(dieter[0], /<blockquote><mark class="check"[^>]*>[^<]+<\/mark><\/blockquote>/);
  assert.match(dieter[0], /<figcaption>Dieter Könnes, Stiftungsgründer<\/figcaption>\s*<\/figure>/);
  assert.match(dieter[0], /^<figure class="dieter">\s*<img\b/, "figcaption und img als direkte Kinder");
  assert.doesNotMatch(dieter[0], /KI-generiert/, "echtes Foto, kein KI-Hinweis");
  const css = readFileSync(join(ROOT, "schlank", "style.css"), "utf8");
  assert.match(css, /\.hero-ki \{ top: 12px; bottom: auto;/, "KI-Etikett oben, weg vom Porträt");
});

pruefe("Strom aus Sonne, Wind und Wasser, nicht nur Solar – Titel, Meta und Einstieg", () => {
  assert.doesNotMatch(meta, /Solarstrom|Wer eine Solaranlage hat/);
  assert.doesNotMatch(JSON.stringify(jsonLd), /Solarstrom/);
  const lead = abschnitt("start").match(/<p class="lead">([\s\S]*?)<\/p>/)[1];
  assert.match(lead, /Sonne, Wind oder Wasser/);
  assert.doesNotMatch(lead, /Solaranlage/);
  assert.match(meta, /Sonne, Wind (oder|und) Wasser/);
});

pruefe("Preis in der Reihenfolge Netz/Steuern, Erzeugerpreis, Plattformgebühr", () => {
  const leiste = abschnitt("preis").match(/<div class="price-bar"[\s\S]*?\n    <\/div>/)[0];
  const teile = [...leiste.matchAll(/class="seg (seg-\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(teile, ["seg-net", "seg-partner", "seg-fee"]);
  assert.match(leiste, /seg-fee"[^>]*><strong>1 ct<\/strong>Plattformgebühr/);
  const kosten = [...abschnitt("fragen").matchAll(/<summary>Was kostet eine Kilowattstunde\?<\/summary><p>([^<]*)/g)][0][1];
  assert.ok(kosten.indexOf("Netzentgelte") < kosten.indexOf("Erzeuger") && kosten.indexOf("Erzeuger") < kosten.indexOf("1,00"), "FAQ-Reihenfolge");
});

pruefe("Gebühr heißt überall gleich: Plattformgebühr", () => {
  for (const quelle of [text, JSON.stringify(jsonLd), llms]) assert.doesNotMatch(quelle, /Vermittlung|netto Gebühr/);
  assert.match(abschnitt("preis"), /Netz, Steuern, Abgaben und Plattformgebühr/);
});

pruefe("Erzeugerspanne und Gebühr überall gleich und passend zum Rechner", () => {
  const quellen = [abschnitt("preis"), abschnitt("fragen"), JSON.stringify(jsonLd), llms].join("\n").replace(/&nbsp;/g, " ");
  const spannen = [...quellen.matchAll(/(\d+)–(\d+) ct/g)].map((m) => `${m[1]}–${m[2]}`);
  assert.ok(spannen.length >= 7, `zu wenige Spannen: ${spannen.length}`);
  assert.deepEqual([...new Set(spannen)], ["7–11"]);
  assert.ok(E_COMMUNITY_CT >= 7 && E_COMMUNITY_CT <= 11);
  const gebuehren = [...quellen.matchAll(/(\d+(?:,\d+)?) ct(?:\/kWh)?(?:<\/strong>Plattformgebühr| netto)/g)].map((m) => m[1].replace(",00", ""));
  assert.ok(gebuehren.length >= 5, `zu wenige Gebühren: ${gebuehren.length}`);
  assert.deepEqual([...new Set(gebuehren)], ["1"]);
  assert.equal(Math.round(WSE_GEBUEHR_CT / 1.19 * 100) / 100, 1);
  const preis = abschnitt("preis");
  assert.match(preis, /<th scope="row">Plattformgebühr<\/th><td>1,00 ct\/kWh netto auf Community-Strom<\/td>/);
  const community = E_COMMUNITY_CT.toFixed(2).replace(".", ",");
  const genannt = [...preis.matchAll(/(\d+,\d+)(?:&nbsp;| )ct(?:\/kWh)? Community-Preis|Community-Preis (\d+,\d+)(?:&nbsp;| )ct/g)].map((m) => m[1] || m[2]);
  assert.ok(genannt.length >= 2, `Community-Preis zu selten genannt: ${genannt.length}`);
  assert.deepEqual([...new Set(genannt)], [community]);
});

pruefe("Platz für das Erklärvideo: markierter Platzhalter, nichts Eingebettetes", () => {
  const teil = abschnitt("so-gehts");
  const platz = teil.match(/<figure class="video-platz"[\s\S]*?<\/figure>/);
  assert.ok(platz, "Video-Platz fehlt");
  assert.match(platz[0], /<mark class="check"[^>]*>[^<]*Erklärvideo[^<]*<\/mark>/);
  assert.doesNotMatch(html, /<(video|iframe|object|embed)\b/);
});

pruefe("Zielgruppen-Kacheln mit markiertem Platz für ein Statement, ohne echte Namen", () => {
  const kacheln = [...abschnitt("fuer-wen").matchAll(/<article class="card"[\s\S]*?<\/article>/g)].map((m) => m[0]);
  const platzhalter = kacheln.map((kachel) => kachel.match(/<blockquote class="stimme"><mark class="check"[^>]*>([^<]+)<\/mark><\/blockquote>/)?.[1]);
  assert.deepEqual(platzhalter, ["Hier kommt das Statement eines Privatkunden.",
    "Hier kommt das Statement eines Landwirts mit ausgeförderter Anlage.", "Hier kommt das Statement eines Unternehmens oder Solarteurs."]);
  assert.doesNotMatch(html, /Schmitz|Michalsky|Platzbecker|Egerather/);
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

pruefe("keine Preisversprechen, auch in Titel, Meta-Angaben, JSON-LD und llms.txt", () => {
  for (const quelle of [ohneMarkierung, meta, JSON.stringify(jsonLd), llms]) {
    assert.doesNotMatch(quelle, /günstiger|billiger|garantiert|klimaneutral|CO2-neutral|Kosten senken|\bspar\w*\b[^.]{0,25}\d|bis zu \d+ ?(%|€|Euro)|\d+ ?% weniger|verdoppel|halbier|lohnt sich (besonders|immer)|zahl(st|en|t) weniger|ohne Mehrkosten/i);
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
