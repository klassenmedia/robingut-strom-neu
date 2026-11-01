// Prüft die Landwirte-Seite und den Anfrage-Link mit Aktionscode.
//
//   node tests/landwirte.test.mjs

import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";

import { codeAusAdresse, anfrageLink, verbindeSeite, ANFRAGE_MAIL, BEKANNTE_CODES } from "../schlank/landwirte/anfrage.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = join(ROOT, "schlank", "landwirte");
const html = readFileSync(join(SEITE, "index.html"), "utf8");
const startseite = readFileSync(join(ROOT, "schlank", "index.html"), "utf8");
const anfrageJs = readFileSync(join(SEITE, "anfrage.js"), "utf8");
const ohneKommentare = html.replace(/<!--[\s\S]*?-->/g, "");
const sichtbarerText = ohneKommentare
  .replace(/<head>[\s\S]*?<\/head>/, "")
  .replace(/<script[\s\S]*?<\/script>/g, "")
  .replace(/<svg[\s\S]*?<\/svg>/g, "")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ")
  .replace(/\s+/g, " ");

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

const parameterAus = (link) => new URLSearchParams(link.slice(link.indexOf("?") + 1));

console.log("Aktionscode");

pruefe("vergebener Code wird übernommen und großgeschrieben", () => {
  assert.equal(codeAusAdresse("?code=messe"), "MESSE");
  assert.equal(codeAusAdresse("?utm=x&code=Flyer"), "FLYER");
  assert.deepEqual([...BEKANNTE_CODES].sort(), ["BRIEF", "FLYER", "MESSE", "NEWSLETTER", "PARTNER"]);
});

pruefe("fehlender oder leerer Code ergibt null", () => {
  for (const suche of ["", "?", "?code=", "?andere=1", undefined, null]) {
    assert.equal(codeAusAdresse(suche), null, String(suche));
  }
});

pruefe("böswillige oder unpassende Codes werden verworfen", () => {
  const boese = [
    "?code=messe%0D%0ABcc:fremd@example.com",
    "?code=%3Cscript%3Ealert(1)%3C/script%3E",
    "?code=a",
    `?code=${"x".repeat(25)}`,
    "?code=m%C3%BChle",
    "?code=messe 26",
    "?code=messe%26body=hallo",
    "?code=messe&code=flyer",
    "?code=--",
  ];
  for (const suche of boese) assert.equal(codeAusAdresse(suche), null, suche);
});

pruefe("formal gültige, aber nicht vergebene Codes werden verworfen", () => {
  for (const suche of ["?code=500-EURO-BONUS", "?code=GRATIS-PV-CHECK", "?code=messe26", "?code=messe-"]) {
    assert.equal(codeAusAdresse(suche), null, suche);
  }
});

console.log("Anfrage-Link");

pruefe("Link geht an die Strom-Adresse mit Betreff und Mailtext", () => {
  const link = anfrageLink(null);
  assert.ok(link.startsWith(`mailto:${ANFRAGE_MAIL}?`), link);
  assert.equal(ANFRAGE_MAIL, "info@robingut-strom.de");
  const p = parameterAus(link);
  assert.equal(p.get("subject"), "Technik-Check Hofanlage");
  assert.match(p.get("body"), /Leistung der Anlage/);
  assert.match(p.get("body"), /Inbetriebnahme/);
});

pruefe("Code steht in Betreff und Mailtext", () => {
  const p = parameterAus(anfrageLink("MESSE"));
  assert.equal(p.get("subject"), "Technik-Check Hofanlage · Code MESSE");
  assert.match(p.get("body"), /Code: MESSE/);
});

pruefe("Mailtext fragt die Weitergabe an den Partner ausdrücklich ab", () => {
  const body = parameterAus(anfrageLink(null)).get("body");
  assert.match(body, /an den Partner weitergeben/);
  assert.match(body, /Bitte streichen Sie, was nicht zutrifft: ja \/ nein/);
});

pruefe("Link enthält keine rohen Zeilenumbrüche oder weiteren Empfänger", () => {
  for (const code of [null, "MESSE"]) {
    const link = anfrageLink(code);
    assert.doesNotMatch(link, /[\r\n]/);
    assert.equal([...parameterAus(link).keys()].sort().join(","), "body,subject");
  }
});

pruefe("ungeprüfter Code wird im Link nicht verwendet", () => {
  assert.equal(anfrageLink("evil\r\nBcc: x@y.de"), anfrageLink(null));
  assert.equal(anfrageLink("<b>"), anfrageLink(null));
  assert.equal(anfrageLink("500-EURO-BONUS"), anfrageLink(null));
});

const seitenAttrappe = () => {
  const links = [{ href: "statisch-1" }, { href: "statisch-2" }];
  const hinweis = { textContent: "", hidden: true };
  return {
    links, hinweis,
    querySelectorAll: (auswahl) => (auswahl === "a[data-anfrage]" ? links : []),
    getElementById: (id) => (id === "code-hinweis" ? hinweis : null),
  };
};

pruefe("Seite: vergebener Code setzt beide Links und den Hinweis", () => {
  const seite = seitenAttrappe();
  verbindeSeite(seite, "?code=messe");
  for (const link of seite.links) assert.equal(link.href, anfrageLink("MESSE"));
  assert.equal(seite.hinweis.hidden, false);
  assert.equal(seite.hinweis.textContent, "Ihre Anfrage-Kennung: MESSE. Nennen Sie sie gern auch am Telefon.");
});

pruefe("Seite: fremder oder böswilliger Code ändert nichts", () => {
  for (const suche of ["", "?code=500-EURO-BONUS", "?code=%3Cb%3E", "?code=messe%0D%0ABcc:x@y.de"]) {
    const seite = seitenAttrappe();
    verbindeSeite(seite, suche);
    assert.deepEqual(seite.links.map((l) => l.href), ["statisch-1", "statisch-2"], suche);
    assert.equal(seite.hinweis.hidden, true, suche);
    assert.equal(seite.hinweis.textContent, "", suche);
  }
});

pruefe("Skript schreibt nur per textContent und href, lädt nichts nach", () => {
  assert.doesNotMatch(anfrageJs, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|fetch\(|XMLHttpRequest|import\(/);
});

console.log("Seite");

pruefe("Kernaussage aus dem Flyer steht in der Hauptüberschrift", () => {
  const h1 = ohneKommentare.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)[1].replace(/<[^>]+>/g, " ");
  assert.match(h1, /Ihre EEG-Förderung läuft aus\./);
  assert.match(h1, /Ihre PV-Anlage läuft weiter\./);
});

pruefe("Ansprache durchgehend in der Sie-Form", () => {
  assert.doesNotMatch(sichtbarerText, /\b(du|dich|dir|dein\w*|euch|euer\w*)\b/i);
  assert.match(sichtbarerText, /\bSie\b/);
});

pruefe("Partner ohne Firmennamen, gemeinsam mit unserem Partner", () => {
  assert.doesNotMatch(html, /WeShare/i);
  assert.match(sichtbarerText, /gemeinsam mit unserem Partner/i);
});

pruefe("keine Preisversprechen und kein klimaneutral", () => {
  assert.doesNotMatch(sichtbarerText, /günstiger|billiger|garantiert|klimaneutral|CO2-neutral|mehr verdienen als/i);
});

pruefe("ROBIN GUT immer in Großbuchstaben", () => {
  assert.doesNotMatch(sichtbarerText, /Robin (Gut|Good|Hood)/);
});

pruefe("jedes Rechenbeispiel ist sichtbar als Annahme gekennzeichnet", () => {
  const beispiele = [...ohneKommentare.matchAll(/<article class="beispiel"[\s\S]*?<\/article>/g)];
  assert.equal(beispiele.length, 2, "zwei Rechenbeispiele wie im Flyer");
  for (const [beispiel] of beispiele) assert.match(beispiel, /Annahme/);
});

pruefe("Cent-Werte stehen nur markiert auf der Seite", () => {
  const ohneMarkierung = ohneKommentare.replace(/<mark class="check"[\s\S]*?<\/mark>/g, "")
    .replace(/<head>[\s\S]*?<\/head>/, "");
  assert.doesNotMatch(ohneMarkierung, /\d+([,.]\d+)?(&nbsp;|\s)*(ct|Cent)\b/);
});

pruefe("keine Eyebrow-Zeilen über Überschriften", () => {
  assert.doesNotMatch(html, /class="[^"]*\b(eyebrow|kicker)\b/);
});

pruefe("Hauptknopf führt zum Technik-Check, Rückruf per Telefon", () => {
  const knoepfe = [...ohneKommentare.matchAll(/<a\b[^>]*class="btn[^"]*"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => m[1]);
  assert.ok(knoepfe.some((t) => /Technik-Check anfragen/.test(t)), "Knopf fehlt");
  assert.match(html, /href="tel:\+4922129282931"/);
  const mailLinks = [...html.matchAll(/<a\b[^>]*\bdata-anfrage\b[^>]*>/g)];
  assert.ok(mailLinks.length >= 2, "Anfrage-Links ohne data-anfrage");
  for (const [tag] of mailLinks) {
    const href = tag.match(/href="([^"]+)"/)[1].replace(/&amp;/g, "&");
    assert.equal(href, anfrageLink(null), "Link ohne JavaScript muss dem Skript entsprechen");
  }
});

pruefe("Entwurf: noindex und sichtbarer Hinweis", () => {
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  const hinweis = ohneKommentare.match(/<p class="entwurf"[^>]*>([\s\S]*?)<\/p>/);
  assert.ok(hinweis, "Entwurfshinweis fehlt");
  assert.match(hinweis[1], /Entwurf/);
});

pruefe("CSP wie auf der Startseite, genau ein eigenes Skript", () => {
  const csp = (quelle) => quelle.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
  assert.equal(csp(html), csp(startseite));
  const skripte = [...html.matchAll(/<script\b[^>]*>/g)].map((m) => m[0]);
  assert.deepEqual(skripte, ['<script type="module" src="anfrage.js?v=3">']);
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
      const datei = join(SEITE, pfad.endsWith("/") || pfad === "" ? `${pfad}index.html` : pfad);
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
    const datei = join(SEITE, ziel);
    assert.ok(existsSync(datei) && statSync(datei).isFile(), `Datei fehlt: ${ziel}`);
  }
});

pruefe("Foto mit Menschen trägt direkt den KI-Hinweis", () => {
  const stelle = ohneKommentare.indexOf("bilder/hof-sonne");
  assert.ok(stelle > 0, "Titelbild fehlt");
  assert.match(ohneKommentare.slice(stelle, stelle + 900), /<span class="ki-hinweis[^"]*">Symbolbild, KI-generiert<\/span>/);
});

pruefe("Impressum und Datenschutz verlinkt, Startseite verlinkt die Landwirte", () => {
  assert.match(html, /href="https:\/\/www\.robingut-strom\.de\/impressum\/"/);
  assert.match(html, /href="https:\/\/www\.robingut-strom\.de\/datenschutzerklaerung\/"/);
  assert.match(startseite, /href="landwirte\/"/);
});

console.log(`\n${bestanden} Prüfungen bestanden${process.exitCode ? " – mit Fehlern" : ""}`);
