// Prüft den Anfrage-Link mit Aktionscode und die Landwirte-Seite.
//
//   node tests/landwirte.test.mjs

import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

import { codeAusAdresse, anfrageLink, verbindeSeite, ANFRAGE_MAIL, BEKANNTE_CODES } from "../schlank/anfrage.js";
import { ROOT, pruefe, abschluss, ladeSeite, gemeinsamePruefungen, zahlenIn, deZahl } from "./seiten-hilfen.mjs";

const anfrageJs = readFileSync(join(ROOT, "schlank", "anfrage.js"), "utf8");
const seite = ladeSeite("landwirte");
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

pruefe("Hof-Link geht an die Strom-Adresse mit Betreff und Mailtext", () => {
  const link = anfrageLink(null, "hof");
  assert.ok(link.startsWith(`mailto:${ANFRAGE_MAIL}?`), link);
  assert.equal(ANFRAGE_MAIL, "info@robingut-strom.de");
  const p = parameterAus(link);
  assert.equal(p.get("subject"), "Technik-Check Hofanlage");
  assert.match(p.get("body"), /Leistung der Anlage/);
  assert.match(p.get("body"), /Inbetriebnahme/);
});

pruefe("Firmen-Link fragt Standorte und Verbrauch ab", () => {
  const p = parameterAus(anfrageLink(null, "firma"));
  assert.equal(p.get("subject"), "Lastgang-Analyse");
  assert.match(p.get("body"), /Standorte/);
  assert.match(p.get("body"), /Jahresverbrauch/);
});

pruefe("ohne oder mit unbekannter Vorlage gilt die Hof-Vorlage", () => {
  assert.equal(anfrageLink(null), anfrageLink(null, "hof"));
  for (const art of ["toString", "__proto__", "constructor", "", undefined]) {
    assert.equal(anfrageLink("MESSE", art), anfrageLink("MESSE", "hof"), String(art));
  }
});

pruefe("Code steht in Betreff und Mailtext", () => {
  for (const [art, betreff] of [["hof", "Technik-Check Hofanlage"], ["firma", "Lastgang-Analyse"]]) {
    const p = parameterAus(anfrageLink("MESSE", art));
    assert.equal(p.get("subject"), `${betreff} · Code MESSE`);
    assert.match(p.get("body"), /Code: MESSE/);
  }
});

pruefe("Mailtext fragt die Weitergabe an den Partner ausdrücklich ab", () => {
  for (const art of ["hof", "firma"]) {
    const body = parameterAus(anfrageLink(null, art)).get("body");
    assert.match(body, /an den Partner weitergeben/);
    assert.match(body, /Bitte streichen Sie, was nicht zutrifft: ja \/ nein/);
  }
});

pruefe("Link enthält keine rohen Zeilenumbrüche oder weiteren Empfänger", () => {
  for (const art of ["hof", "firma"]) {
    for (const code of [null, "MESSE"]) {
      const link = anfrageLink(code, art);
      assert.doesNotMatch(link, /[\r\n]/);
      assert.equal([...parameterAus(link).keys()].sort().join(","), "body,subject");
    }
  }
});

pruefe("ungeprüfter Code wird im Link nicht verwendet", () => {
  assert.equal(anfrageLink("evil\r\nBcc: x@y.de"), anfrageLink(null));
  assert.equal(anfrageLink("<b>"), anfrageLink(null));
  assert.equal(anfrageLink("500-EURO-BONUS", "firma"), anfrageLink(null, "firma"));
});

const seitenAttrappe = () => {
  const links = [
    { href: "statisch-1", dataset: { anfrage: "hof" } },
    { href: "statisch-2", dataset: { anfrage: "firma" } },
  ];
  const hinweis = { textContent: "", hidden: true };
  return {
    links, hinweis,
    querySelectorAll: (auswahl) => (auswahl === "a[data-anfrage]" ? links : []),
    getElementById: (id) => (id === "code-hinweis" ? hinweis : null),
  };
};

pruefe("Seite: vergebener Code setzt jeden Link mit seiner Vorlage und den Hinweis", () => {
  const attrappe = seitenAttrappe();
  verbindeSeite(attrappe, "?code=messe");
  assert.equal(attrappe.links[0].href, anfrageLink("MESSE", "hof"));
  assert.equal(attrappe.links[1].href, anfrageLink("MESSE", "firma"));
  assert.equal(attrappe.hinweis.hidden, false);
  assert.equal(attrappe.hinweis.textContent, "Ihre Anfrage-Kennung: MESSE. Nennen Sie sie gern auch am Telefon.");
});

pruefe("Seite: fremder oder böswilliger Code ändert nichts", () => {
  for (const suche of ["", "?code=500-EURO-BONUS", "?code=%3Cb%3E", "?code=messe%0D%0ABcc:x@y.de"]) {
    const attrappe = seitenAttrappe();
    verbindeSeite(attrappe, suche);
    assert.deepEqual(attrappe.links.map((l) => l.href), ["statisch-1", "statisch-2"], suche);
    assert.equal(attrappe.hinweis.hidden, true, suche);
    assert.equal(attrappe.hinweis.textContent, "", suche);
  }
});

pruefe("Betreff und Text sind vollständig kodiert", () => {
  const link = anfrageLink("MESSE", "firma");
  assert.match(link, /subject=Lastgang-Analyse%20%C2%B7%20Code%20MESSE&/);
  assert.doesNotMatch(link, /[ ·]/);
});

pruefe("Skript schreibt nur per textContent und href, lädt nichts nach", () => {
  assert.doesNotMatch(anfrageJs, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|fetch\(|XMLHttpRequest|import\(/);
});

console.log("Landwirte-Seite");

pruefe("Kernaussage aus dem Flyer steht in der Hauptüberschrift", () => {
  const h1 = seite.ohneKommentare.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)[1].replace(/<[^>]+>/g, " ");
  assert.match(h1, /Ihre EEG-Förderung läuft aus\./);
  assert.match(h1, /Ihre PV-Anlage läuft weiter\./);
});

const beispiel = (nummer) => {
  const treffer = seite.ohneKommentare.match(new RegExp(`<article class="beispiel" id="beispiel-${nummer}">[\\s\\S]*?</article>`));
  assert.ok(treffer, `Rechenbeispiel ${nummer} fehlt`);
  return treffer[0];
};

pruefe("jedes Rechenbeispiel ist sichtbar als Annahme gekennzeichnet", () => {
  const beispiele = [...seite.ohneKommentare.matchAll(/<article class="beispiel"[\s\S]*?<\/article>/g)];
  assert.equal(beispiele.length, 2, "zwei Rechenbeispiele wie in der Präsentation");
  for (const [text] of beispiele) {
    assert.match(text, /<h3>[^<]*\(Annahme\)/);
    assert.match(text, /angenommen: Die Community nimmt/i);
    assert.match(text, /nicht eingerechnet/);
  }
});

pruefe("Beispiel 1: jede Zahl folgt aus dem Rechenweg", () => {
  const kwp = 100, erzeugung = 95000, eigenProzent = 30, spotCt = 5, communityCt = 10;
  const eigen = (erzeugung * eigenProzent) / 100;
  const ueberschuss = erzeugung - eigen;
  const vorher = (ueberschuss * spotCt) / 100;
  const nachher = (ueberschuss * communityCt) / 100;
  const kwh = (wert) => `${deZahl(wert)} kWh`;
  assert.deepEqual(zahlenIn(beispiel(1)), [
    "1", `${kwp} kWp`,
    kwh(erzeugung), `${eigenProzent} %`, kwh(eigen), kwh(ueberschuss),
    `${deZahl(vorher)} €`, kwh(ueberschuss), `${spotCt} ct/kWh`,
    `${deZahl(nachher)} €`, kwh(ueberschuss), `${communityCt} ct/kWh`,
    `+ ${deZahl(nachher - vorher)} €`,
    `${communityCt} ct/kWh`,
  ]);
});

pruefe("Beispiel 2: jede Zahl folgt aus dem Rechenweg", () => {
  const kwp = 200, erzeugung = 190000, spotCt = 5, praemieCt = 25, communityCt = 10;
  const euro = (ct) => `${deZahl((erzeugung * ct) / 100)} €`;
  const kwh = `${deZahl(erzeugung)} kWh`;
  assert.deepEqual(zahlenIn(beispiel(2)), [
    "2", `${kwp} kWp`,
    `${kwp} kWp`, kwh,
    euro(spotCt + praemieCt), kwh, `${spotCt} ct`, `+ ${praemieCt} ct`,
    euro(communityCt + praemieCt), kwh, `${communityCt} ct`, `+ ${praemieCt} ct`,
    euro(communityCt), kwh, `${communityCt} ct/kWh`, euro(spotCt),
  ]);
});

pruefe("Beispiel 2: Marktprämie markiert, Verlustrisiko genannt", () => {
  assert.match(beispiel(2), /<mark class="check"[^>]*§ 80 EEG[^>]*>Angenommen: Die Marktprämie bleibt/);
  assert.match(beispiel(2), /<li><mark class="check"[^>]*><strong>66\.500&nbsp;€<\/strong>mit Community/);
  assert.match(beispiel(2), /Fällt sie weg, sinkt der Erlös deutlich\./);
  assert.match(beispiel(2), /Bei Anlagen in der Direktvermarktung/);
});

pruefe("Cent-Werte stehen nur in den Rechenbeispielen oder markiert", () => {
  const ohneMarkierung = seite.ohneKommentare.replace(/<mark class="check"[\s\S]*?<\/mark>/g, "")
    .replace(/<section id="beispiele"[\s\S]*?<\/section>/, "")
    .replace(/<head>[\s\S]*?<\/head>/, "");
  assert.doesNotMatch(ohneMarkierung, /\d+([,.]\d+)?(&nbsp;|\s)*(ct|Cent)\b/);
});

pruefe("Hauptknopf führt zum Technik-Check", () => {
  const knoepfe = [...seite.ohneKommentare.matchAll(/<a\b[^>]*class="btn[^"]*"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => m[1]);
  assert.ok(knoepfe.some((t) => /Technik-Check anfragen/.test(t)), "Knopf fehlt");
});

pruefe("Landwirte finden den Weg zur Unternehmen-Seite", () => {
  assert.match(seite.html, /href="\.\.\/unternehmen\/"/);
});

gemeinsamePruefungen(seite, { art: "hof", titelbild: "hof-sonne" });

abschluss();
