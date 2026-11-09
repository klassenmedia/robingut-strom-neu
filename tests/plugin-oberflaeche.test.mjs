// Prüft die Oberfläche des WordPress-Rechners (Straßen-Dropdown) im echten Browser.
// Shortcode-HTML kommt aus PHP, die REST-Routen sind Attrappen; es geht nichts an den Partner.
//
//   node tests/plugin-oberflaeche.test.mjs

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const { chromium } = require(join(homedir(), "node_modules", "playwright"));

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PLUGIN = join(ROOT, "wordpress", "robingut-rechner");
const BASIS = "http://rgr.test";

const shortcode = execFileSync("php", ["-r", `
  require '${PLUGIN}/tests/harness/wp-attrappe.php';
  require '${PLUGIN}/robingut-rechner.php';
  echo rgr_shortcode();
`], { encoding: "utf8" });
const seite = `<!doctype html><html lang="de"><head><meta charset="utf-8">
<link rel="stylesheet" href="/assets/rechner.css"></head><body>${shortcode}
<script src="/assets/rechnung.js"></script><script src="/assets/rechner.js"></script></body></html>`;

const PREIS = { requires_district_selection: false, energy_price: 38.16449, transaction_fee: 1.19,
  base_price: 238.13, monthly_base_price: 19.84, annual_consumption_kwh: 2500, city: "Erkelenz",
  annual_total: (38.16449 + 1.19) / 100 * 2500 + 238.13 };
const STRASSEN = ["Hauptstr.", "Kölner Heerweg", "Kölner Str.", "<img src=x onerror=window.__xss=1>"];

let bestanden = 0;
async function pruefe(name, fn) {
  // Installiertes Chrome mit leerem Profil; Playwright-eigene Browser sind nicht heruntergeladen
  const browser = await chromium.launch({ channel: process.env.RGR_BROWSER_CHANNEL || "chrome" });
  const page = await browser.newPage();
  const zaehler = { preis: 0, strassen: 0, preisVerzoegerung: 0, strassenVerzoegerung: 0, fehlerEinmal: false };
  await page.route(`${BASIS}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/") return route.fulfill({ contentType: "text/html", body: seite });
    if (url.pathname.startsWith("/assets/")) {
      const datei = url.pathname.slice("/assets/".length);
      return route.fulfill({ contentType: datei.endsWith(".css") ? "text/css" : "text/javascript", body: readFileSync(join(PLUGIN, "assets", datei)) });
    }
    const body = JSON.parse(route.request().postData() || "{}");
    if (url.pathname.endsWith("/strassen")) {
      zaehler.strassen++;
      if (zaehler.strassenVerzoegerung) await new Promise((r) => setTimeout(r, zaehler.strassenVerzoegerung));
      if (zaehler.strassenStoerung === "502") return route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ fehler: "x", strassen: [] }) });
      if (zaehler.strassenStoerung === "kaputt") return route.fulfill({ contentType: "application/json", body: "kein json" });
      // Der Eintrag mit HTML kommt bei „Köl…“ mit, damit der XSS-Test ihn sieht
      const treffer = STRASSEN.filter((s) => s.toLowerCase().startsWith(body.suche.toLowerCase()) || (s.startsWith("<") && body.suche.startsWith("Köl")));
      return route.fulfill({ contentType: "application/json", body: JSON.stringify({ strassen: treffer }) });
    }
    if (url.pathname.endsWith("/preis")) {
      zaehler.preis++;
      if (zaehler.preisVerzoegerung) await new Promise((r) => setTimeout(r, zaehler.preisVerzoegerung));
      if (zaehler.fehlerEinmal && body.strasse) {
        zaehler.fehlerEinmal = false;
        return route.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ fehler: "Gerade sind es zu viele Anfragen." }) });
      }
      const antwort = body.strasse
        ? { ...PREIS, annual_consumption_kwh: body.kwh, annual_total: (PREIS.energy_price + PREIS.transaction_fee) / 100 * body.kwh + PREIS.base_price }
        : { requires_district_selection: true, city: "Erkelenz" };
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(antwort) });
    }
    return route.fulfill({ status: 404, body: "" });
  });
  await page.goto(`${BASIS}/`);
  try {
    await page.fill("[name=plz]", "41812");
    await page.waitForSelector(".rgr-adresse:not([hidden])");
    await fn(page, zaehler);
    bestanden += 1;
    console.log(`  ok  ${name}`);
  } catch (fehler) {
    console.error(`  FEHLER  ${name}\n        ${fehler.message.split("\n")[0]}`);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

const offen = (page) => page.$eval(".rgr-vorschlaege", (ul) => !ul.hidden);
const tippe = async (page, wert) => { await page.click("[name=strasse]"); await page.fill("[name=strasse]", ""); await page.type("[name=strasse]", wert); };
const warteListe = (page) => page.waitForSelector(".rgr-vorschlaege:not([hidden]) li");

console.log("Straßen-Dropdown");

await pruefe("Vorschläge erscheinen und werden nur als Text gezeigt", async (page) => {
  await tippe(page, "Köl");
  await warteListe(page);
  const eintraege = await page.$$eval(".rgr-vorschlaege li", (lis) => lis.map((li) => li.textContent));
  assert.ok(eintraege.includes("Kölner Str."));
  assert.equal(await page.$$eval(".rgr-vorschlaege img", (x) => x.length), 0);
  assert.equal(await page.evaluate(() => window.__xss), undefined);
  assert.equal(await page.getAttribute("[name=strasse]", "aria-expanded"), "true");
});

await pruefe("Pfeil runter und Enter übernehmen die Straße und springen zur Hausnummer", async (page) => {
  await tippe(page, "Haupt");
  await warteListe(page);
  await page.keyboard.press("ArrowDown");
  assert.match(await page.getAttribute("[name=strasse]", "aria-activedescendant"), /-strassen-0$/);
  await page.keyboard.press("Enter");
  assert.equal(await page.inputValue("[name=strasse]"), "Hauptstr.");
  assert.equal(await offen(page), false);
  assert.equal(await page.evaluate(() => document.activeElement.name), "hausnummer");
});

await pruefe("Auswahl bei gefüllter Hausnummer fragt den Preis genau einmal an", async (page, z) => {
  await page.fill("[name=hausnummer]", "10");
  await tippe(page, "Köl");
  await warteListe(page);
  const vorher = z.preis;
  // Antwort verzögert: Das Verlassen des Feldes fällt in die laufende Anfrage
  z.preisVerzoegerung = 600;
  await page.click(".rgr-vorschlaege li:has-text('Kölner Str.')");
  await page.click("[name=kwh]");
  await page.waitForSelector(".rgr-ergebnis:not([hidden])");
  await page.waitForTimeout(300);
  assert.equal(z.preis - vorher, 1);
});

await pruefe("nach der Auswahl öffnet eine noch geplante Suche die Liste nicht wieder", async (page) => {
  await page.fill("[name=hausnummer]", "10");
  await tippe(page, "Köl");
  await warteListe(page);
  await page.type("[name=strasse]", "n");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(600);
  assert.equal(await offen(page), false);
});

await pruefe("Abblendung verschwindet, wenn die Adresse am Ende gleich bleibt", async (page) => {
  await page.fill("[name=hausnummer]", "10");
  await tippe(page, "Köl");
  await warteListe(page);
  await page.click(".rgr-vorschlaege li:has-text('Kölner Str.')");
  await page.waitForSelector(".rgr-ergebnis:not([hidden])");
  await page.click("[name=hausnummer]");
  await page.keyboard.press("End");
  await page.keyboard.type("1");
  await page.keyboard.press("Backspace");
  await page.click("[name=kwh]");
  await page.waitForTimeout(200);
  assert.equal(await page.$eval(".rgr-ergebnis", (e) => e.classList.contains("rgr-laedt")), false);
  assert.equal(await page.getAttribute(".rgr-ergebnis", "aria-busy"), "false");
});

await pruefe("eine alte Antwort hebt die Abblendung für eine geänderte Adresse nicht auf", async (page, z) => {
  await page.fill("[name=hausnummer]", "10");
  await tippe(page, "Köl");
  await warteListe(page);
  await page.click(".rgr-vorschlaege li:has-text('Kölner Str.')");
  await page.waitForSelector(".rgr-ergebnis:not([hidden])");
  z.preisVerzoegerung = 800;
  await page.fill("[name=hausnummer]", "120");
  await page.click("[name=kwh]");
  await page.click("[name=hausnummer]");
  await page.keyboard.press("End");
  await page.keyboard.type("5");
  await page.waitForTimeout(1200);
  assert.equal(await page.$eval(".rgr-ergebnis", (e) => e.classList.contains("rgr-laedt")), true);
});

await pruefe("Klick auf den Rand der Liste nimmt dem Feld den Fokus nicht", async (page) => {
  await tippe(page, "Köl");
  await warteListe(page);
  // Mitte des oberen Innenabstands: trifft die Liste, aber keinen Eintrag und keine runde Ecke
  const box = await page.$eval(".rgr-vorschlaege", (ul) => { const r = ul.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 4 }; });
  assert.equal(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y).tagName, box), "UL");
  await page.mouse.click(box.x, box.y);
  assert.equal(await page.evaluate(() => document.activeElement.name), "strasse");
  assert.equal(await offen(page), true);
});

await pruefe("Pfeil runter öffnet die geschlossene Liste wieder", async (page) => {
  await tippe(page, "Köl");
  await warteListe(page);
  await page.keyboard.press("Escape");
  assert.equal(await offen(page), false);
  await page.keyboard.press("ArrowDown");
  assert.equal(await offen(page), true);
  assert.match(await page.getAttribute("[name=strasse]", "aria-activedescendant"), /-strassen-0$/);
});

await pruefe("Anzahl der Vorschläge und kein Treffer werden angesagt", async (page) => {
  await tippe(page, "Köl");
  await warteListe(page);
  assert.match(await page.textContent(".rgr-ansage"), /Vorschläge/);
  await tippe(page, "Xyz");
  await page.waitForFunction(() => /Keine passende Straße/.test(document.querySelector(".rgr-ansage").textContent));
});

// Gemeinsamer Start: Kölner Str. 10 ist gewählt und gerechnet
async function mitErgebnis(page) {
  await page.fill("[name=hausnummer]", "10");
  await tippe(page, "Köl");
  await warteListe(page);
  await page.click(".rgr-vorschlaege li:has-text('Kölner Str.')");
  await page.waitForSelector(".rgr-ergebnis:not([hidden])");
  await page.waitForFunction(() => !document.querySelector(".rgr-ergebnis").classList.contains("rgr-laedt"));
}
const abgeblendet = (page) => page.$eval(".rgr-ergebnis", (e) => e.classList.contains("rgr-laedt"));
const sichtbar = (page) => page.$eval(".rgr-ergebnis", (e) => !e.hidden);

console.log("Zustände");

await pruefe("Abschlag tippen während einer laufenden Anfrage lässt den alten Preis abgeblendet", async (page, z) => {
  await mitErgebnis(page);
  z.preisVerzoegerung = 1500;
  await page.fill("[name=hausnummer]", "99");
  await page.evaluate(() => { document.querySelector(".rgr-heute").open = true; });
  await page.click("[name=abschlag]");
  await page.keyboard.type("1");
  assert.equal(await abgeblendet(page), true);
  assert.equal(await page.getAttribute(".rgr-ergebnis", "aria-busy"), "true");
});

await pruefe("nach einem Fehler geht dieselbe Anfrage beim nächsten Versuch wieder raus", async (page, z) => {
  await page.fill("[name=hausnummer]", "10");
  await tippe(page, "Köl");
  await warteListe(page);
  z.fehlerEinmal = true;
  await page.click(".rgr-vorschlaege li:has-text('Kölner Str.')");
  await page.waitForFunction(() => /zu viele/.test(document.querySelector(".rgr-status").textContent));
  const vorher = z.preis;
  await page.click("[name=hausnummer]");
  await page.click("[name=kwh]");
  await page.waitForSelector(".rgr-ergebnis:not([hidden])");
  assert.equal(z.preis - vorher, 1);
});

await pruefe("ungültiger Verbrauch und zurück zeigt das Ergebnis wieder", async (page) => {
  await mitErgebnis(page);
  await page.fill("[name=kwh]", "300");
  await page.waitForFunction(() => document.querySelector(".rgr-ergebnis").hidden);
  await page.fill("[name=kwh]", "2500");
  await page.waitForSelector(".rgr-ergebnis:not([hidden])");
});

await pruefe("späte Antwort zeigt keinen Preis, wenn der Verbrauch inzwischen ungültig ist", async (page, z) => {
  await mitErgebnis(page);
  z.preisVerzoegerung = 1500;
  const vorher = z.preis;
  await page.fill("[name=kwh]", "3000");
  // erst ungültig machen, wenn die Anfrage für 3000 beim Server angekommen ist
  for (let i = 0; i < 50 && z.preis === vorher; i++) await page.waitForTimeout(50);
  assert.equal(z.preis - vorher, 1);
  await page.fill("[name=kwh]", "300");
  await page.waitForTimeout(2200);
  assert.equal(await sichtbar(page), false);
});

await pruefe("Auswahl während einer laufenden Suche hält die Liste zu", async (page, z) => {
  await page.fill("[name=hausnummer]", "10");
  await tippe(page, "Köl");
  await warteListe(page);
  z.strassenVerzoegerung = 700;
  await page.type("[name=strasse]", "n");
  await page.waitForTimeout(350);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1000);
  assert.equal(await offen(page), false);
});

await pruefe("nur die Straße ändern und zum Verbrauch wechseln rechnet neu", async (page, z) => {
  await mitErgebnis(page);
  const vorher = z.preis;
  await tippe(page, "Köl");
  await warteListe(page);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.click("[name=kwh]");
  await page.waitForTimeout(300);
  assert.equal(z.preis - vorher, 1);
});

await pruefe("fehlt nur die Hausnummer, sagt die Meldung genau das", async (page) => {
  await tippe(page, "Haupt");
  await warteListe(page);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  assert.match(await page.textContent(".rgr-status"), /Hausnummer/);
  assert.doesNotMatch(await page.textContent(".rgr-status"), /Straße und Hausnummer/);
});

await pruefe("Verbrauch ändern und sofort Straße tippen bricht das Tippen nicht ab", async (page) => {
  await mitErgebnis(page);
  await page.fill("[name=kwh]", "3000");
  await tippe(page, "Köl");
  await page.waitForTimeout(700);
  assert.doesNotMatch(await page.textContent(".rgr-status"), /Vorschlägen/);
});

for (const art of ["502", "kaputt"]) {
  await pruefe(`Straßensuche gestört (${art}): Ansage „nicht verfügbar“, Liste zu`, async (page, z) => {
    z.strassenStoerung = art;
    await tippe(page, "Köl");
    await page.waitForFunction(() => /nicht verfügbar/.test(document.querySelector(".rgr-ansage").textContent));
    assert.equal(await offen(page), false);
  });
}

await pruefe("Eingabe in der Hausnummer ohne Fokus (Autofill) löscht keine geplante Rechnung", async (page, z) => {
  await mitErgebnis(page);
  const vorher = z.preis;
  await page.click("[name=kwh]");
  await page.fill("[name=kwh]", "3000");
  await page.evaluate(() => {
    const h = document.querySelector("[name=hausnummer]");
    h.value = "10";
    h.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.waitForTimeout(900);
  assert.equal(z.preis - vorher, 1);
  assert.equal(await page.evaluate(() => document.activeElement.name), "kwh");
});

await pruefe("getippter Verbrauch markiert die Personen-Knöpfe sofort", async (page) => {
  await page.fill("[name=kwh]", "3500");
  await tippe(page, "K");
  const gedrueckt = await page.$$eval(".rgr-person", (k) => k.map((b) => b.getAttribute("aria-pressed")));
  assert.deepEqual(gedrueckt, ["false", "true", "false"]);
});

console.log("Klickstrecke mit Rollen");

const ERZEUGER = { individuell: false, grund_monat: 95.38, vermarktung_ct: 0.2, einrichtung: 390 };
const PREIS_VIERSEN = { ...PREIS, city: "Viersen" };

async function pruefeRolle(name, atts, fn, { altBrowser = false, breite = 0 } = {}) {
  const html = execFileSync("php", ["-r", `
    require '${PLUGIN}/tests/harness/wp-attrappe.php';
    require '${PLUGIN}/robingut-rechner.php';
    echo rgr_shortcode(json_decode('${JSON.stringify(atts)}', true));
  `], { encoding: "utf8" });
  const rollenSeite = seite.replace(shortcode, html);
  const browser = await chromium.launch({ channel: process.env.RGR_BROWSER_CHANNEL || "chrome" });
  const page = await browser.newPage(breite ? { viewport: { width: breite, height: 800 } } : {});
  // Safari/iOS bis 15 kennt AbortSignal.timeout nicht.
  if (altBrowser) await page.addInitScript(() => { AbortSignal.timeout = undefined; });
  const z = { preis: 0, erzeuger: 0, erzeugerBodies: [] };
  await page.route(`${BASIS}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/") return route.fulfill({ contentType: "text/html", body: rollenSeite });
    if (url.pathname.startsWith("/assets/")) {
      const datei = url.pathname.slice("/assets/".length);
      return route.fulfill({ contentType: datei.endsWith(".css") ? "text/css" : "text/javascript", body: readFileSync(join(PLUGIN, "assets", datei)) });
    }
    const body = JSON.parse(route.request().postData() || "{}");
    if (url.pathname.endsWith("/erzeuger")) {
      z.erzeuger++;
      z.erzeugerBodies.push(body);
      const verzoegerung = z.verzoegerung ? z.verzoegerung(body) : 0;
      if (verzoegerung) await new Promise((r) => setTimeout(r, verzoegerung));
      const { status = 200, daten = ERZEUGER } = z.antwort ? z.antwort(body) : {};
      return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(daten) }).catch(() => {});
    }
    if (url.pathname.endsWith("/preis")) {
      z.preis++;
      const antwort = { ...PREIS_VIERSEN, annual_consumption_kwh: body.kwh, annual_total: (PREIS.energy_price + PREIS.transaction_fee) / 100 * body.kwh + PREIS.base_price };
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(antwort) });
    }
    return route.fulfill({ status: 404, body: "" });
  });
  await page.goto(`${BASIS}/`);
  try {
    await fn(page, z);
    bestanden += 1;
    console.log(`  ok  ${name}`);
  } catch (fehler) {
    console.error(`  FEHLER  ${name}\n        ${fehler.message.split("\n")[0]}`);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

const zuSehen = (page, sel) => page.$eval(sel, (el) => !el.hidden && el.offsetParent !== null);
const feldText = (page, name) => page.textContent(`.rgr-ergebnis-erzeuger [data-feld="${name}"]`);
const anlageEingeben = async (page, kwp = "100", kwh = "66.500") => {
  await page.fill("[name=kwp]", kwp);
  await page.fill("[name=ueberschuss]", kwh);
  await page.click(".rgr-schritt-2 button[type=submit]");
};

await pruefeRolle("Startseite: Strom beziehen vorgewählt, Erzeugerfelder versteckt", {}, async (page) => {
  assert.equal(await page.$eval("[name=rolle][value=beziehen]", (r) => r.checked), true);
  assert.equal(await zuSehen(page, ".rgr-teil-bezug"), true);
  assert.equal(await zuSehen(page, ".rgr-teil-erzeugung"), false);
  assert.equal((await page.textContent(".rgr-anmelden")).trim(), "Jetzt anmelden");
});

await pruefeRolle("Landwirte: Strom einspeisen vorgewählt, Ergebnis wie im Rechenbeispiel", { rolle: "einspeisen", anrede: "sie" }, async (page, z) => {
  assert.equal(await page.$eval("[name=rolle][value=einspeisen]", (r) => r.checked), true);
  assert.equal(await zuSehen(page, ".rgr-teil-bezug"), false);
  await anlageEingeben(page);
  await page.waitForSelector(".rgr-ergebnis-erzeuger:not([hidden])");
  assert.equal(await feldText(page, "erloes"), "6.650 €");
  assert.equal(await feldText(page, "grund"), "− 1.145 €");
  assert.equal(await feldText(page, "vermarktung"), "− 133 €");
  assert.equal(await feldText(page, "bleibt"), "rund 5.372 €");
  assert.equal(await feldText(page, "anschluss"), "höchstens 2.993 €");
  assert.deepEqual(z.erzeugerBodies[0], { art: "pv", kwp: 100, kwh: 66500, einspeisung: "teil", foerderung: false });
  assert.equal((await page.textContent(".rgr-anmelden")).trim(), "Als Erzeuger anmelden");
  assert.match(await page.textContent(".rgr-schritt-1"), /Was möchten Sie\?/);
  assert.match(await page.textContent(".rgr-ergebnis-erzeuger"), /Fernwirktechnik/);
});

await pruefeRolle("Wunschpreis rechnet ohne neue Anfrage beim Partner", { rolle: "einspeisen" }, async (page, z) => {
  await anlageEingeben(page);
  await page.waitForSelector(".rgr-ergebnis-erzeuger:not([hidden])");
  await page.$eval("[name=wunschpreis]", (r) => { r.value = "8"; r.dispatchEvent(new Event("input", { bubbles: true })); });
  await page.waitForTimeout(600);
  assert.equal(await feldText(page, "erloes"), "5.320 €");
  assert.match(await page.textContent(".rgr-wunschpreis-wert"), /8,0 ct/);
  assert.equal(z.erzeuger, 1);
});

await pruefeRolle("Beides: beide Teile sichtbar, beide Ergebnisse", { rolle: "beides", anrede: "sie" }, async (page, z) => {
  assert.equal(await zuSehen(page, ".rgr-teil-bezug"), true);
  assert.equal(await zuSehen(page, ".rgr-teil-erzeugung"), true);
  await page.fill("[name=plz]", "41747");
  await page.fill("[name=kwh]", "40.000");
  await anlageEingeben(page, "250", "200.000");
  await page.waitForSelector(".rgr-ergebnis:not([hidden])");
  await page.waitForSelector(".rgr-ergebnis-erzeuger:not([hidden])");
  assert.equal(z.erzeugerBodies.at(-1).kwp, 250);
  assert.equal((await page.textContent(".rgr-anmelden")).trim(), "Weiter zur Anmeldung");
});

await pruefeRolle("Rollenwechsel blendet die passenden Felder ein", {}, async (page) => {
  await page.click("label:has([name=rolle][value=einspeisen])");
  assert.equal(await zuSehen(page, ".rgr-teil-bezug"), false);
  assert.equal(await zuSehen(page, ".rgr-teil-erzeugung"), true);
  assert.equal(await zuSehen(page, ".rgr-ergebnis"), false);
  assert.equal((await page.textContent(".rgr-anmelden")).trim(), "Als Erzeuger anmelden");
});

await pruefeRolle("über 1.000 kWp: individuelles Angebot ohne Anfrage", { rolle: "einspeisen" }, async (page, z) => {
  await anlageEingeben(page, "1.200", "900.000");
  await page.waitForFunction(() => /individuelles Angebot/.test(document.querySelector(".rgr-status-erzeugung").textContent));
  assert.equal(z.erzeuger, 0);
  assert.equal(await zuSehen(page, ".rgr-ergebnis-erzeuger"), false);
});

await pruefeRolle("ab 100.000 kWh Verbrauch: individuelles Angebot ohne Mailadresse", {}, async (page, z) => {
  await page.fill("[name=plz]", "41747");
  await page.fill("[name=kwh]", "100.000");
  await page.click(".rgr-schritt-2 button[type=submit]");
  await page.waitForFunction(() => /individuelles Angebot/.test(document.querySelector(".rgr-status").textContent));
  assert.doesNotMatch(await page.textContent(".rgr"), /@/);
  assert.equal(z.preis, 0);
});

await pruefeRolle("unbekannte Rolle im Shortcode fällt auf Strom beziehen zurück", { rolle: "x\" onfocus=\"alert(1)" }, async (page) => {
  assert.equal(await page.$eval("[name=rolle][value=beziehen]", (r) => r.checked), true);
  assert.equal(await page.$$eval("[onfocus]", (l) => l.length), 0);
});

const ergebnisDa = (page) => page.waitForSelector(".rgr-ergebnis-erzeuger:not([hidden]):not(.rgr-laedt)");
const statusErzeugung = (page) => page.textContent(".rgr-status-erzeugung");

await pruefeRolle("Anlagenart, Einspeisung und Förderung gehen mit in die Anfrage", { rolle: "einspeisen" }, async (page, z) => {
  await page.selectOption("[name=art]", "wind");
  await page.check("[name=einspeisung][value=voll]");
  await page.check("[name=foerderung][value=ja]");
  await anlageEingeben(page, "80", "300.000");
  await ergebnisDa(page);
  assert.deepEqual(z.erzeugerBodies.at(-1), { art: "wind", kwp: 80, kwh: 300000, einspeisung: "voll", foerderung: true });
});

await pruefeRolle("Wasserkraft und Biogas: individuelles Angebot ohne Anfrage", { rolle: "einspeisen" }, async (page, z) => {
  for (const art of ["wasser", "biogas"]) {
    await page.selectOption("[name=art]", art);
    await anlageEingeben(page, "80", "300.000");
    await page.waitForFunction(() => /individuelles Angebot/.test(document.querySelector(".rgr-status-erzeugung").textContent));
    assert.equal(await page.$eval(".rgr-ergebnis-erzeuger", (e) => e.hidden), true);
  }
  assert.equal(z.erzeuger, 0);
});

await pruefeRolle("keine Vergleichszeile bei Wind, Förderung oder über 100 kWp", { rolle: "einspeisen" }, async (page) => {
  const zeile = () => page.$eval('[data-feld="anschluss"]', (dd) => !dd.closest("div").hidden);
  await anlageEingeben(page);
  await ergebnisDa(page);
  assert.equal(await zeile(), true);
  await page.selectOption("[name=art]", "wind");
  await page.click(".rgr-schritt-2 button[type=submit]");
  await ergebnisDa(page);
  assert.equal(await zeile(), false);
  await page.selectOption("[name=art]", "pv");
  await page.check("[name=foerderung][value=ja]");
  await page.click(".rgr-schritt-2 button[type=submit]");
  await ergebnisDa(page);
  assert.equal(await zeile(), false);
  assert.equal(await zuSehen(page, ".rgr-hinweis-foerderung"), true);
  await page.check("[name=foerderung][value=nein]");
  await page.click(".rgr-schritt-2 button[type=submit]");
  await ergebnisDa(page);
  assert.equal(await zuSehen(page, ".rgr-hinweis-foerderung"), false);
  await page.fill("[name=kwp]", "150");
  await page.click(".rgr-schritt-2 button[type=submit]");
  await ergebnisDa(page);
  assert.equal(await zeile(), false);
});

await pruefeRolle("neue Leistung fragt neu und zeigt die neuen Kosten", { rolle: "einspeisen" }, async (page, z) => {
  z.antwort = (b) => ({ daten: b.kwp === 10 ? { individuell: false, grund_monat: 31, vermarktung_ct: 0.2, einrichtung: 390 } : ERZEUGER });
  await anlageEingeben(page);
  await ergebnisDa(page);
  await anlageEingeben(page, "10", "5.000");
  await page.waitForFunction(() => /12 × 31,00 €/.test(document.querySelector('[data-feld="grund-rechnung"]').textContent));
  assert.equal(await feldText(page, "grund"), "− 372 €");
  assert.equal(z.erzeuger, 2);
});

await pruefeRolle("veraltete Antwort überschreibt das neue Ergebnis nicht", { rolle: "einspeisen" }, async (page, z) => {
  z.verzoegerung = (b) => (b.kwp === 100 ? 1500 : 0);
  z.antwort = (b) => ({ daten: b.kwp === 10 ? { individuell: false, grund_monat: 31, vermarktung_ct: 0.2, einrichtung: 390 } : ERZEUGER });
  await anlageEingeben(page);
  await anlageEingeben(page, "10", "5.000");
  await ergebnisDa(page);
  await page.waitForTimeout(1800);
  assert.equal(await feldText(page, "grund"), "− 372 €");
});

await pruefeRolle("während einer laufenden Anfrage ist das alte Ergebnis abgeblendet", { rolle: "einspeisen" }, async (page, z) => {
  await anlageEingeben(page);
  await ergebnisDa(page);
  z.verzoegerung = () => 1500;
  await page.fill("[name=kwp]", "10");
  await page.fill("[name=ueberschuss]", "5.000");
  await page.$eval("[name=wunschpreis]", (r) => { r.value = "8"; r.dispatchEvent(new Event("input", { bubbles: true })); });
  // Sichtbar abgeblendet, nicht nur per Klasse: die Deckkraft muss sinken (nach der Überblendung).
  await page.waitForTimeout(300);
  assert.equal(await page.$eval(".rgr-ergebnis-erzeuger", (e) => e.hidden || Number(getComputedStyle(e).opacity) < 1), true);
});

await pruefeRolle("A → B (langsam) → zurück auf A: Regler rechnet weiter mit den richtigen Kosten", { rolle: "einspeisen" }, async (page, z) => {
  z.antwort = (b) => ({ daten: b.kwp === 10 ? { individuell: false, grund_monat: 31, vermarktung_ct: 0.2, einrichtung: 390 } : ERZEUGER });
  await anlageEingeben(page);
  await ergebnisDa(page);
  z.verzoegerung = (b) => (b.kwp === 10 ? 1200 : 0);
  await page.fill("[name=kwp]", "10");
  await page.waitForTimeout(700);           // Anfrage B läuft
  await page.fill("[name=kwp]", "100");
  await page.click(".rgr-schritt-2 button[type=submit]");
  await page.waitForTimeout(1500);          // B kommt zu spät an
  await page.$eval("[name=wunschpreis]", (r) => { r.value = "7"; r.dispatchEvent(new Event("input", { bubbles: true })); });
  await page.waitForTimeout(300);
  assert.equal(await feldText(page, "bleibt"), "rund 3.377 €");
  assert.equal(await page.$eval(".rgr-ergebnis-erzeuger", (e) => Number(getComputedStyle(e).opacity)), 1);
});

await pruefeRolle("Mehrfachklick auf Weiter schickt nur eine Anfrage", { rolle: "einspeisen" }, async (page, z) => {
  z.verzoegerung = () => 600;
  await page.fill("[name=kwp]", "100");
  await page.fill("[name=ueberschuss]", "66.500");
  for (let i = 0; i < 3; i++) await page.click(".rgr-schritt-2 button[type=submit]");
  await ergebnisDa(page);
  assert.equal(z.erzeuger, 1);
});

await pruefeRolle("Rollenwechsel hin und zurück während der Anfrage: kein Ergebnis ohne neues Weiter", { rolle: "einspeisen" }, async (page, z) => {
  z.verzoegerung = () => 1000;
  await page.fill("[name=kwp]", "100");
  await page.fill("[name=ueberschuss]", "66.500");
  await page.click(".rgr-schritt-2 button[type=submit]");
  await page.click("label:has([name=rolle][value=beziehen])");
  await page.click("label:has([name=rolle][value=einspeisen])");
  await page.waitForTimeout(1400);
  assert.equal(await page.$eval(".rgr-ergebnis-erzeuger", (e) => e.hidden), true);
  assert.equal(await statusErzeugung(page), "");
});

await pruefeRolle("Partnerfehler: Meldung, kein altes Ergebnis", { rolle: "einspeisen" }, async (page, z) => {
  await anlageEingeben(page);
  await ergebnisDa(page);
  z.antwort = () => ({ status: 502, daten: { fehler: "x" } });
  await anlageEingeben(page, "50", "40.000");
  await page.waitForFunction(() => /nicht erreichbar/.test(document.querySelector(".rgr-status-erzeugung").textContent));
  assert.equal(await page.$eval(".rgr-ergebnis-erzeuger", (e) => e.hidden), true);
});

await pruefeRolle("individuelles Angebot vom Server wird als Hinweis gezeigt", { rolle: "einspeisen" }, async (page, z) => {
  z.antwort = () => ({ daten: { individuell: true } });
  await anlageEingeben(page, "900", "800.000");
  await page.waitForFunction(() => /individuelles Angebot/.test(document.querySelector(".rgr-status-erzeugung").textContent));
  assert.equal(await page.$eval(".rgr-ergebnis-erzeuger", (e) => e.hidden), true);
});

await pruefeRolle("Rollenwechsel während der Anfrage zeigt kein Erzeuger-Ergebnis", { rolle: "beides" }, async (page, z) => {
  z.verzoegerung = () => 1200;
  await page.fill("[name=kwp]", "100");
  await page.fill("[name=ueberschuss]", "66.500");
  await page.click(".rgr-schritt-2 button[type=submit]");
  await page.click("label:has([name=rolle][value=beziehen])");
  await page.waitForTimeout(1600);
  assert.equal(await page.$eval(".rgr-ergebnis-erzeuger", (e) => e.hidden), true);
});

await pruefeRolle("Beides mit 100.000 kWh: Hinweis zum Verbrauch bleibt neben dem Erzeuger-Ergebnis", { rolle: "beides" }, async (page) => {
  await page.fill("[name=plz]", "41747");
  await page.fill("[name=kwh]", "100.000");
  await anlageEingeben(page);
  await ergebnisDa(page);
  assert.match(await page.textContent(".rgr-status-bezug"), /individuelles Angebot/);
  assert.equal(await statusErzeugung(page), "");
});

await pruefeRolle("nach einem Partnerfehler fragt Weiter mit gleichen Eingaben neu", { rolle: "einspeisen" }, async (page, z) => {
  let erst = true;
  z.antwort = () => { if (erst) { erst = false; return { status: 502, daten: { fehler: "x" } }; } return {}; };
  await anlageEingeben(page);
  await page.waitForFunction(() => /nicht erreichbar/.test(document.querySelector(".rgr-status-erzeugung").textContent));
  await page.click(".rgr-schritt-2 button[type=submit]");
  await ergebnisDa(page);
  assert.equal(z.erzeuger, 2);
});

await pruefeRolle("A → B (langsam) → A → B: B wird neu gefragt und gezeigt", { rolle: "einspeisen" }, async (page, z) => {
  z.antwort = (b) => ({ daten: b.kwp === 10 ? { individuell: false, grund_monat: 31, vermarktung_ct: 0.2, einrichtung: 390 } : ERZEUGER });
  await anlageEingeben(page);
  await ergebnisDa(page);
  z.verzoegerung = (b) => (b.kwp === 10 && z.erzeuger <= 2 ? 1200 : 0);
  await page.fill("[name=kwp]", "10");
  await page.waitForTimeout(700);
  await page.fill("[name=kwp]", "100");
  await page.click(".rgr-schritt-2 button[type=submit]");
  await page.fill("[name=kwp]", "10");
  await page.click(".rgr-schritt-2 button[type=submit]");
  await page.waitForFunction(() => /12 × 31,00 €/.test(document.querySelector('[data-feld="grund-rechnung"]').textContent), null, { timeout: 5000 });
  await ergebnisDa(page);
});

await pruefeRolle("Rollenwechsel weg und zurück, dann Weiter mit gleichen Eingaben: Ergebnis kommt", { rolle: "einspeisen" }, async (page, z) => {
  z.verzoegerung = () => 800;
  await page.fill("[name=kwp]", "100");
  await page.fill("[name=ueberschuss]", "66.500");
  await page.click(".rgr-schritt-2 button[type=submit]");
  await page.click("label:has([name=rolle][value=beziehen])");
  await page.click("label:has([name=rolle][value=einspeisen])");
  await page.click(".rgr-schritt-2 button[type=submit]");
  await ergebnisDa(page);
  assert.equal(await feldText(page, "bleibt"), "rund 5.372 €");
});

await pruefeRolle("Browser ohne AbortSignal.timeout (iOS 15): Erlös kommt trotzdem", { rolle: "einspeisen" }, async (page, z) => {
  await anlageEingeben(page);
  await ergebnisDa(page);
  assert.equal(await feldText(page, "bleibt"), "rund 5.372 €");
}, { altBrowser: true });

for (const [was, weg, zurueck] of [
  ["kWp kurz ungültig", (p) => p.fill("[name=kwp]", "0"), (p) => p.fill("[name=kwp]", "100")],
  ["Art kurz Wasserkraft", (p) => p.selectOption("[name=art]", "wasser"), (p) => p.selectOption("[name=art]", "pv")],
]) {
  await pruefeRolle(`${was} während der Anfrage, dann gleiche Eingaben: Ergebnis kommt`, { rolle: "einspeisen" }, async (page, z) => {
    z.verzoegerung = () => 800;
    await page.fill("[name=kwp]", "100");
    await page.fill("[name=ueberschuss]", "66.500");
    await page.click(".rgr-schritt-2 button[type=submit]");
    await weg(page);
    await page.click(".rgr-schritt-2 button[type=submit]");
    await zurueck(page);
    await page.click(".rgr-schritt-2 button[type=submit]");
    await ergebnisDa(page);
    assert.equal(await feldText(page, "bleibt"), "rund 5.372 €");
  });
}

await pruefeRolle("320 px: Personen-Knöpfe in einer Reihe, Text nicht abgeschnitten", {}, async (page) => {
  const knoepfe = await page.$$eval(".rgr-person", (alle) => alle.map((k) => ({ oben: Math.round(k.getBoundingClientRect().top), passt: k.scrollWidth <= k.clientWidth })));
  assert.equal(new Set(knoepfe.map((k) => k.oben)).size, 1);
  assert.ok(knoepfe.every((k) => k.passt), JSON.stringify(knoepfe));
}, { breite: 320 });

await pruefe("Monatsbetrag genau auf Euro und Cent, ohne „ca.“", async (page) => {
  await mitErgebnis(page);
  assert.equal(await page.textContent('.rgr-ergebnis [data-feld="monat"]'), "101,83 €");
  assert.doesNotMatch(await page.textContent(".rgr-betrag"), /ca\./);
});

await pruefe("Ersparnis gegenüber dem Abschlag genau auf Euro und Cent", async (page) => {
  await mitErgebnis(page);
  await page.evaluate(() => { document.querySelector(".rgr-heute").open = true; });
  await page.fill("[name=abschlag]", "110");
  await page.waitForFunction(() => /51,21 €/.test(document.querySelector('[data-feld="vergleich-text"]').textContent));
  assert.doesNotMatch(await page.textContent('[data-feld="vergleich-text"]'), /ca\./);
});

await pruefeRolle("Sie-Seite: Vergleich mit dem Abschlag siezt", { anrede: "sie" }, async (page) => {
  await page.fill("[name=plz]", "41747");
  await page.waitForSelector(".rgr-ergebnis:not([hidden])");
  await page.evaluate(() => { document.querySelector(".rgr-heute").open = true; });
  await page.fill("[name=abschlag]", "110");
  await page.waitForFunction(() => /51,21 €/.test(document.querySelector('[data-feld="vergleich-text"]').textContent));
  const titel = await page.textContent('[data-feld="vergleich-titel"]');
  const satz = await page.textContent('[data-feld="vergleich-text"]');
  assert.equal(titel, "Sie sparen");
  assert.match(satz, /Ihrem heutigen Abschlag/);
  assert.doesNotMatch(titel + satz, /\b(du|dein\w*)\b/i);
});

await pruefe("Lesekopf steht direkt am Monatsbetrag", async (page) => {
  await mitErgebnis(page);
  assert.match(await page.textContent(".rgr-betrag"), /zzgl\. Lesekopf/);
});

await pruefe("Mehrkosten ohne Minuszeichen, auf Euro und Cent", async (page) => {
  await mitErgebnis(page);
  await page.evaluate(() => { document.querySelector(".rgr-heute").open = true; });
  await page.fill("[name=abschlag]", "100");
  await page.waitForFunction(() => /68,79 €/.test(document.querySelector('[data-feld="vergleich-text"]').textContent));
  assert.equal(await page.textContent('[data-feld="vergleich-titel"]'), "Mehrkosten");
  assert.doesNotMatch(await page.textContent('[data-feld="vergleich-text"]'), /[-−]\d|ca\./);
});

for (const [abschlag, titel, betrag] of [["100", "Mehrkosten", /68,79 €/], ["105,73", "Etwa gleich", /Ihr heutiger Abschlag/]]) {
  await pruefeRolle(`Sie-Seite: ${titel} siezt`, { anrede: "sie" }, async (page) => {
    await page.fill("[name=plz]", "41747");
    await page.waitForSelector(".rgr-ergebnis:not([hidden])");
    await page.evaluate(() => { document.querySelector(".rgr-heute").open = true; });
    await page.fill("[name=abschlag]", abschlag);
    await page.waitForFunction((t) => document.querySelector('[data-feld="vergleich-titel"]').textContent === t, titel);
    const satz = await page.textContent('[data-feld="vergleich-text"]');
    assert.match(satz, betrag);
    assert.doesNotMatch(satz, /\b(du|dein\w*)\b|ca\.|[-−]\d/i);
  });
}

console.log(`\n${bestanden} Prüfungen bestanden`);
