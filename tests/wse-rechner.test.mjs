// Prüft die Einbettung des WeShareEnergy-Rechners (wordpress/wse-rechner.html) im echten Browser:
// lädt direkt (Entscheidung Andreas 09.11.), Höhe nur von weshareenergy.de aus dem eigenen iframe, nur als Zahl, begrenzt.
// Nichts geht nach außen.
//
//   node tests/wse-rechner.test.mjs

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const { chromium } = require(join(homedir(), "node_modules", "playwright"));
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BLOCK = readFileSync(join(ROOT, "wordpress", "wse-rechner.html"), "utf8");
// Mit dem echten Seiten-CSS, damit Theme-Regeln (z. B. display:grid) die Sichtbarkeit mitprüfen
const CSS = readFileSync(join(ROOT, "wordpress", "variante-a.css"), "utf8");
const seiteMit = (inhalt) => `<!doctype html><html lang="de"><head><style>${CSS}</style></head><body><div class="wp-block-post-content"><div class="wp-block-group alignwide rgb-karte">${inhalt}</div></div></body></html>`;
// Skript ans Seitenende verschoben (wie Optimierer mit „Inline-JS zusammenfassen“)
const SKRIPT = BLOCK.match(/<script>[\s\S]*?<\/script>/)[0];
const OHNE_SKRIPT = BLOCK.replace(SKRIPT, "");
const BASIS = "http://seite.test";
const WSE = "https://weshareenergy.de/stromcommunitys/neukunde/robin-gut-strom?iframe=1&buttonColor=0e670e&borderRadius=9999px&fontFamily=NotoSans";
// Attrappe der WSE-Seite: meldet 1234 px und leitet Nachrichten auf Wunsch an die Elternseite weiter
const ATTRAPPE = `<body><script>
  addEventListener("message", (e) => {
    if (e.data && e.data.sende) parent.postMessage(e.data.sende, "*");
    if (e.data && e.data.navigiere) location.href = e.data.navigiere;
  });
  parent.postMessage({ type: "IFRAME_HEIGHT", height: 1234 }, "*");</script></body>`;

let bestanden = 0;
async function pruefe(name, fn, { laden = true, block = BLOCK, seite = null } = {}) {
  const browser = await chromium.launch({ channel: process.env.RGR_BROWSER_CHANNEL || "chrome" });
  const page = await browser.newPage();
  const z = { wse: 0 };
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (url === `${BASIS}/`) return route.fulfill({ contentType: "text/html", body: seite || seiteMit(block) });
    if (url === `${BASIS}/fremd`) return route.fulfill({ contentType: "text/html", body: '<body><script>parent.postMessage({ type: "IFRAME_HEIGHT", height: 444 }, "*");</script></body>' });
    if (url.startsWith("https://weshareenergy.de/")) { z.wse++; return route.fulfill({ contentType: "text/html", body: ATTRAPPE }); }
    return route.abort();
  });
  await page.goto(`${BASIS}/`);
  try {
    if (laden) await page.waitForFunction(() => document.querySelector(".rg-wse-frame").style.height === "1234px");
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

const sichtbar = (page, sel) => page.$eval(sel, (el) => getComputedStyle(el).display !== "none" && el.getBoundingClientRect().height > 0);
const hoehe = (page) => page.$eval(".rg-wse-frame", (f) => f.style.height);
const sende = async (page, daten) => {
  await page.$eval(".rg-wse-frame", (f, d) => f.contentWindow.postMessage({ sende: d }, "*"), daten);
  await page.waitForTimeout(200);
};

console.log("WSE-Rechner (Einbettung)");

await pruefe("lädt direkt sichtbar, ohne Startfläche", async (page, z) => {
  assert.equal(z.wse, 1);
  assert.equal(await sichtbar(page, ".rg-wse-frame"), true);
  assert.equal(await page.$$eval(".rg-wse-start, .rg-wse-laden", (l) => l.length), 0);
});

await pruefe("Skript ans Seitenende verschoben: beide Blöcke wachsen für sich", async (page, z) => {
  await page.waitForFunction(() => [...document.querySelectorAll(".rg-wse-frame")].every((f) => f.style.height === "1234px"));
  assert.equal(z.wse, 2);
}, { laden: false, seite: seiteMit(OHNE_SKRIPT + OHNE_SKRIPT) + SKRIPT });

await pruefe("Skript verzögert ausgeführt: Höhe kommt trotzdem an", async (page) => {
  await page.waitForFunction(() => window.rgWseRechner === true);
  await page.$eval(".rg-wse-frame", (f) => f.contentWindow.postMessage({ sende: { type: "IFRAME_HEIGHT", height: 900 } }, "*"));
  await page.waitForFunction(() => document.querySelector(".rg-wse-frame").style.height === "900px");
}, { laden: false, seite: seiteMit(OHNE_SKRIPT) + `<script>setTimeout(() => { const s = document.createElement("script"); s.textContent = ${JSON.stringify(SKRIPT.replace(/<\/?script>/g, ""))}; document.body.appendChild(s); }, 300);</script>` });

await pruefe("Adresse, Titel, Sandbox ohne Umleitung der Seite", async (page) => {
  assert.equal(await page.getAttribute(".rg-wse-frame", "src"), WSE);
  assert.match(await page.getAttribute(".rg-wse-frame", "title"), /WeShareEnergy/);
  const sandbox = await page.getAttribute(".rg-wse-frame", "sandbox");
  assert.match(sandbox, /allow-popups-to-escape-sandbox/);
  assert.doesNotMatch(sandbox, /allow-top-navigation/);
  assert.equal(await page.getAttribute(".rg-wse-frame", "referrerpolicy"), "strict-origin-when-cross-origin");
  // Ausweg-Zeile entfällt (Andreas 09.11.)
  assert.equal(await page.$$eval(".rg-wse-ausweg", (l) => l.length), 0);
});

await pruefe("Höhe nur als Zahl, begrenzt auf 300 bis 5000 px", async (page) => {
  await sende(page, { type: "ANDERS", height: 800 });
  assert.equal(await hoehe(page), "1234px");
  await sende(page, { type: "IFRAME_HEIGHT", height: "800" });
  assert.equal(await hoehe(page), "1234px");
  await sende(page, { type: "IFRAME_HEIGHT", height: 99999 });
  assert.equal(await hoehe(page), "5000px");
  await sende(page, { type: "IFRAME_HEIGHT", height: 5 });
  assert.equal(await hoehe(page), "300px");
  await sende(page, { type: "IFRAME_HEIGHT", height: 900 });
  await sende(page, { type: "IFRAME_HEIGHT", height: NaN });
  assert.equal(await hoehe(page), "900px");
  await sende(page, { type: "IFRAME_HEIGHT", height: Infinity });
  assert.equal(await hoehe(page), "900px");
  await sende(page, { type: "IFRAME_HEIGHT", height: -1 });
  assert.equal(await hoehe(page), "300px");
});

await pruefe("Nachricht der eigenen Seite wird ignoriert (Herkunft)", async (page) => {
  await page.evaluate(() => window.postMessage({ type: "IFRAME_HEIGHT", height: 600 }, "*"));
  await page.waitForTimeout(200);
  assert.equal(await hoehe(page), "1234px");
});

await pruefe("anderes iframe von weshareenergy.de wird ignoriert (Absender)", async (page) => {
  await page.evaluate(() => {
    const f = document.createElement("iframe");
    f.id = "fremd";
    f.src = "https://weshareenergy.de/andere";
    document.body.appendChild(f);
  });
  await page.waitForTimeout(500);
  await page.$eval("#fremd", (f) => f.contentWindow.postMessage({ sende: { type: "IFRAME_HEIGHT", height: 600 } }, "*"));
  await page.waitForTimeout(300);
  assert.equal(await hoehe(page), "1234px");
});

await pruefe("eigenes iframe nach Wechsel auf fremde Herkunft wird ignoriert", async (page) => {
  await page.$eval(".rg-wse-frame", (f) => f.contentWindow.postMessage({ navigiere: "http://seite.test/fremd" }, "*"));
  await page.waitForTimeout(800);
  assert.equal(await hoehe(page), "1234px");
});

console.log(`\n${bestanden} Prüfungen bestanden`);
