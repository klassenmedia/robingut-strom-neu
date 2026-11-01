// Gemeinsame Prüfungen für die Unterseiten (Landwirte, Unternehmen).

import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";

import { anfrageLink } from "../schlank/anfrage.js";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const startseite = readFileSync(join(ROOT, "schlank", "index.html"), "utf8");

let bestanden = 0;
export function pruefe(name, fn) {
  try {
    fn();
    bestanden += 1;
    console.log(`  ok  ${name}`);
  } catch (fehler) {
    console.error(`  FEHLER  ${name}\n        ${fehler.message}`);
    process.exitCode = 1;
  }
}
export const abschluss = () =>
  console.log(`\n${bestanden} Prüfungen bestanden${process.exitCode ? " – mit Fehlern" : ""}`);

export function ladeSeite(ordner) {
  const verzeichnis = join(ROOT, "schlank", ordner);
  const html = readFileSync(join(verzeichnis, "index.html"), "utf8");
  const ohneKommentare = html.replace(/<!--[\s\S]*?-->/g, "");
  const text = ohneKommentare
    .replace(/<head>[\s\S]*?<\/head>/, "")
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<svg[\s\S]*?<\/svg>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
  return { verzeichnis, html, ohneKommentare, text };
}

// Alle Zahlen eines Abschnitts mit Einheit, in Reihenfolge, z. B. "12.400 MWh".
const ZAHL = /(?<![\d.,])(?:[+−-] ?)?\d{1,3}(?:\.\d{3})*(?:,\d+)?(?![\d.,])(?: ?(?:MWh|GWh|kWh|kWp|kW|ct\/kWh|ct|%|Mio\. €|€))?/g;
export function zahlenIn(fragment) {
  const text = fragment.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
  return text.match(ZAHL) ?? [];
}
export const deZahl = (wert, stellen = 0) =>
  wert.toLocaleString("de-DE", { minimumFractionDigits: stellen, maximumFractionDigits: stellen });
export function abschnitt(seite, muster) {
  const treffer = seite.ohneKommentare.match(muster);
  assert.ok(treffer, `Abschnitt fehlt: ${muster}`);
  return treffer[0];
}
const ohneAnnahmen = (quelle) => quelle
  .replace(/<mark class="check"[\s\S]*?<\/mark>/g, "")
  .replace(/<article class="(praxis|beispiel)"[\s\S]*?<\/article>/g, "");

// Prüfungen, die für jede Unterseite gleich gelten.
export function gemeinsamePruefungen(seite, { art, titelbild }) {
  const { verzeichnis, html, ohneKommentare, text } = seite;

  pruefe("Ansprache durchgehend in der Sie-Form", () => {
    assert.doesNotMatch(text, /\b(du|dich|dir|dein\w*|euch|euer\w*)\b/i);
    assert.match(text, /\bSie\b/);
  });

  pruefe("Partner ohne Firmennamen, gemeinsam mit unserem Partner", () => {
    assert.doesNotMatch(html, /WeShare/i);
    assert.match(text, /gemeinsam mit unserem Partner/i);
  });

  pruefe("keine Preisversprechen und kein klimaneutral, auch in den Meta-Angaben", () => {
    const meta = [
      ...[...html.matchAll(/<meta\b[^>]*\bcontent="([^"]*)"/g)].map((m) => m[1]),
      html.match(/<title>([^<]*)<\/title>/)[1],
    ].join(" ");
    assert.ok(meta.length > 100, "Meta-Angaben nicht gefunden");
    for (const quelle of [text, meta]) {
      assert.doesNotMatch(quelle, /günstiger|billiger|garantiert|klimaneutral|CO2-neutral|mehr verdienen als|Kosten senken|ohne (zusätzliche )?Investition/i);
    }
    const ausserhalb = ohneAnnahmen(ohneKommentare).replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");
    assert.doesNotMatch(`${ausserhalb} ${meta}`, /sparen \d|\d+ ?% weniger|verdoppel|doppelte[nr]? Erlös|mehr Erlös|jede Kilowattstunde/i);
  });

  pruefe("Netzentgelte: fallen an, nirgends als entfallen dargestellt", () => {
    const ohneMarkierung = ohneKommentare.replace(/<mark class="check"[\s\S]*?<\/mark>/g, "")
      .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
    assert.doesNotMatch(ohneMarkierung, /entfallen|keine Netzentgelte|ohne Netzentgelte|Netzentgelte[^.]*(reduziert|sinken|befreit)/i);
    assert.match(ohneMarkierung, /Netzentgelte, Umlagen und Stromsteuer fallen[^.]* an/);
  });

  pruefe("Partner liefert und bilanziert, nicht ROBIN GUT", () => {
    assert.doesNotMatch(text, /ROBIN GUT( Strom)? (liefert|bilanziert|übernimmt|rechnet)/);
    assert.doesNotMatch(text, /(liefert|bilanziert|übernimmt|rechnet)( jetzt| auch)? ROBIN GUT/);
    assert.doesNotMatch(text, /(Lieferung|Vollversorgung|Bilanzkreis|Abrechnung)[^.]*übernehmen wir/);
    assert.match(text, /übernimmt unser Partner|Er übernimmt Lieferung/);
  });

  pruefe("ROBIN GUT immer in Großbuchstaben", () => {
    assert.doesNotMatch(text, /Robin (Gut|Good|Hood)/);
  });

  pruefe("keine Eyebrow-Zeilen über Überschriften", () => {
    assert.doesNotMatch(html, /class="[^"]*\b(eyebrow|kicker)\b/);
  });

  pruefe("Anfrage-Links: eigene Vorlage, ohne JavaScript gleich wie mit", () => {
    const tags = [...html.matchAll(/<a\b[^>]*\bdata-anfrage\b[^>]*>/g)].map((m) => m[0]);
    assert.ok(tags.length >= 2, "zu wenige Anfrage-Links");
    for (const tag of tags) {
      assert.match(tag, new RegExp(`data-anfrage="${art}"`), tag);
      const href = tag.match(/href="([^"]+)"/)[1].replace(/&amp;/g, "&");
      assert.equal(href, anfrageLink(null, art));
    }
    assert.match(html, /href="tel:\+4922129282931"/);
    assert.match(html, /<p id="code-hinweis"[^>]*\bhidden\b/);
  });

  pruefe("Entwurf: noindex und sichtbarer Hinweis", () => {
    assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
    const hinweis = ohneKommentare.match(/<p class="entwurf"[^>]*>([\s\S]*?)<\/p>/);
    assert.ok(hinweis, "Entwurfshinweis fehlt");
    assert.match(hinweis[1], /Entwurf/);
  });

  pruefe("CSP wie auf der Startseite, genau das gemeinsame Skript", () => {
    const csp = (quelle) => quelle.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
    assert.equal(csp(html), csp(startseite));
    const skripte = [...html.matchAll(/<script\b[^>]*>/g)].map((m) => m[0]);
    assert.deepEqual(skripte, ['<script type="module" src="../anfrage.js?v=7">']);
    assert.doesNotMatch(html, /\son[a-z]+\s*=/i, "Inline-Handler");
    assert.doesNotMatch(html, /\sstyle\s*=/i, "Inline-Style");
  });

  pruefe("jeder Link führt auf einen Anker, eine eigene Datei oder https/mailto/tel", () => {
    const anker = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
    const links = [...html.matchAll(/<a\b[^>]*\bhref=(["'])(.*?)\1/g)].map((m) => m[2]);
    assert.equal(links.length, (html.match(/<a\b[^>]*\bhref=/g) || []).length, "Link ohne Anführungszeichen");
    for (const ziel of links) {
      if (ziel.startsWith("#")) assert.ok(anker.has(ziel.slice(1)), `Anker fehlt: ${ziel}`);
      else if (/^(https:\/\/|mailto:|tel:)/.test(ziel)) continue;
      else {
        assert.ok(ziel && !ziel.startsWith("/"), `Link ab der Wurzel: ${ziel}`);
        const pfad = ziel.split(/[?#]/)[0];
        const datei = join(verzeichnis, pfad.endsWith("/") ? `${pfad}index.html` : pfad);
        assert.ok(existsSync(datei) && statSync(datei).isFile(), `Link führt ins Leere: ${ziel}`);
      }
    }
  });

  pruefe("jede eingebundene Datei liegt im Projekt", () => {
    const quellen = [...html.matchAll(/<(?:img|source|link|script)\b[^>]*\b(?:src|srcset|href)\s*=\s*(["'])(.*?)\1/gi)]
      .filter((m) => !/rel="(canonical|alternate)"/.test(m[0]))
      .flatMap((m) => m[2].split(",").map((teil) => teil.trim().split(/\s+/)[0].split(/[?#]/)[0]));
    assert.ok(quellen.length >= 4, "zu wenige Dateien gefunden");
    for (const ziel of quellen) {
      assert.ok(!ziel.startsWith("/") && !/^https?:/.test(ziel), `Datei von außerhalb: ${ziel}`);
      const datei = join(verzeichnis, ziel);
      assert.ok(existsSync(datei) && statSync(datei).isFile(), `Datei fehlt: ${ziel}`);
    }
  });

  pruefe("Titelbild trägt direkt den KI-Hinweis", () => {
    const stelle = ohneKommentare.indexOf(`bilder/${titelbild}`);
    assert.ok(stelle > 0, "Titelbild fehlt");
    assert.match(ohneKommentare.slice(stelle, stelle + 900), /<span class="ki-hinweis[^"]*">Symbolbild, KI-generiert<\/span>/);
  });

  pruefe("Impressum und Datenschutz verlinkt, Startseite verlinkt die Seite", () => {
    assert.match(html, /href="https:\/\/www\.robingut-strom\.de\/impressum\/"/);
    assert.match(html, /href="https:\/\/www\.robingut-strom\.de\/datenschutzerklaerung\/"/);
    assert.match(startseite, new RegExp(`href="${verzeichnis.split("/").pop()}/"`));
  });
}
