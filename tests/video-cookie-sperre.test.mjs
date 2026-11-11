// Prüft die Video-Sperre (wordpress/video-cookie-sperre.js) im echten Browser: YouTube darf erst nach
// Zustimmung zu „YouTube Video“ im Cookie-Banner laden. CCM19 und die Player sind Attrappen; jeder
// Abruf von youtube-nocookie.com wird gezählt und abgebrochen, es geht nichts nach außen.
//
//   node tests/video-cookie-sperre.test.mjs

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const { chromium } = require(join(homedir(), "node_modules", "playwright"));

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKRIPT = readFileSync(join(ROOT, "wordpress", "video-cookie-sperre.js"), "utf8");
const BASIS = "http://video.test";

// Nachbau der beiden Player: Essential Blocks (Button, lädt bei click und keypress) und die
// Kundenstimmen (div mit role=button, lädt bei click und keydown). Dazu ein Player, der schon bei
// pointerdown/touchstart lädt, um diese Wege abzudecken.
const SEITE = `<!doctype html><html lang="de"><head><meta charset="utf-8"><style>.eb-react-player, .yt-facade-t { position: relative; display: block; width: 480px; height: 270px; margin: 8px; } .eb-av-yt-facade { width: 100%; height: 100%; } .rg-video-hinweis { position: absolute; left: 8px; right: 8px; bottom: 8px; background: #fff; }</style></head><body>
<div class="eb-react-player"><button class="eb-av-yt-facade" aria-label="Play video"><span class="eb-av-yt-play"></span></button></div>
<div class="yt-facade-t" role="button" tabindex="0" data-videoid="abc"><div class="play-btn"></div></div>
<div class="eb-react-player"><button class="eb-av-yt-facade" id="frueh">Früh</button></div>
<script>
  window.CCMSTART && (window.CCM = window.CCMSTART);
  function lade(el, ersetzen) {
    var f = document.createElement("iframe");
    f.src = "https://www.youtube-nocookie.com/embed/x";
    if (ersetzen) { el.replaceWith(f); } else { el.innerHTML = ""; el.appendChild(f); }
  }
  document.querySelectorAll(".eb-av-yt-facade:not(#frueh)").forEach(function (b) {
    b.addEventListener("click", function () { lade(b, true); });
    b.addEventListener("keypress", function (e) { if (e.key === "Enter") lade(b, true); });
  });
  var t = document.querySelector(".yt-facade-t");
  t.addEventListener("click", function () { lade(t, false); });
  t.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); lade(t, false); } });
  var f = document.getElementById("frueh");
  f.addEventListener("pointerdown", function () { lade(f, true); });
  f.addEventListener("touchstart", function () { lade(f, true); }, { passive: true });
</script>
<script>${SKRIPT}</script>
</body></html>`;

let bestanden = 0;
async function pruefe(name, ccm, fn) {
  const browser = await chromium.launch({ channel: process.env.RGR_BROWSER_CHANNEL || "chrome" });
  const page = await browser.newPage({ hasTouch: true });
  const z = { youtube: 0 };
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (url.startsWith(BASIS)) return route.fulfill({ contentType: "text/html", body: SEITE });
    if (/youtube/.test(url)) z.youtube += 1;
    return route.abort();
  });
  if (ccm !== null) {
    await page.addInitScript((namen) => {
      window.__zustimmung = namen.slice();
      window.CCMSTART = {
        get acceptedEmbeddings() { return window.__zustimmung.map((name) => ({ id: name, name })); },
        openControlPanel() { window.__panelAuf = true; },
      };
    }, ccm);
  }
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

const iframes = (page) => page.$$eval("iframe", (l) => l.length);
const hinweise = (page) => page.$$eval(".rg-video-hinweis", (l) => l.length);
const stimmeZu = (page) => page.evaluate(() => { window.__zustimmung.push("YouTube Video"); });

console.log("Video-Sperre");

await pruefe("ohne Cookie-Banner (CCM fehlt): Hinweis, kein Video", null, async (page, z) => {
  await page.click(".eb-av-yt-facade:not(#frueh)");
  assert.equal(await hinweise(page), 1);
  assert.equal(await iframes(page), 0);
  assert.equal(z.youtube, 0);
});

await pruefe("ohne Zustimmung: Klick auf Video-Block zeigt Hinweis, lädt nichts", [], async (page, z) => {
  await page.click(".eb-av-yt-facade:not(#frueh)");
  assert.equal(await hinweise(page), 1);
  assert.equal(await iframes(page), 0);
  assert.equal(z.youtube, 0);
  assert.equal(await page.evaluate(() => document.activeElement.textContent), "Cookie-Einstellungen öffnen");
});

await pruefe("ohne Zustimmung: Kundenstimme per Klick, Enter und Leertaste gesperrt", [], async (page, z) => {
  await page.click(".yt-facade-t");
  await page.focus(".yt-facade-t");
  await page.keyboard.press("Enter");
  await page.keyboard.press(" ");
  assert.equal(await iframes(page), 0);
  assert.equal(z.youtube, 0);
  assert.equal(await page.$$eval(".yt-facade-t .rg-video-hinweis", (l) => l.length), 1);
});

await pruefe("ohne Zustimmung: Video-Block per Tastatur gesperrt", [], async (page, z) => {
  await page.focus(".eb-av-yt-facade:not(#frueh)");
  await page.keyboard.press("Enter");
  await page.keyboard.press(" ");
  assert.equal(await iframes(page), 0);
  assert.equal(z.youtube, 0);
  assert.equal(await hinweise(page), 1);
});

await pruefe("ohne Zustimmung: Player, der auf pointerdown/touchstart lädt, bleibt gesperrt", [], async (page, z) => {
  await page.click("#frueh");
  await page.tap("#frueh").catch(() => {});
  assert.equal(await iframes(page), 0);
  assert.equal(z.youtube, 0);
});

await pruefe("falscher Dienst („YouTube Kanal“) gibt das Video nicht frei", ["YouTube Kanal"], async (page, z) => {
  await page.click(".eb-av-yt-facade:not(#frueh)");
  assert.equal(await iframes(page), 0);
  assert.equal(z.youtube, 0);
});

await pruefe("Enter und Klick im Hinweis laden die Kundenstimme nicht", [], async (page, z) => {
  await page.click(".yt-facade-t");
  await page.keyboard.press("Enter");
  assert.equal(await page.evaluate(() => window.__panelAuf === true), true);
  await page.click(".yt-facade-t .rg-video-hinweis p");
  assert.equal(await iframes(page), 0);
  assert.equal(z.youtube, 0);
});

await pruefe("mit Zustimmung: beide Player laden direkt, kein Hinweis", ["YouTube Video"], async (page) => {
  await page.click(".eb-av-yt-facade:not(#frueh)");
  await page.click(".yt-facade-t");
  assert.equal(await iframes(page), 2);
  assert.equal(await hinweise(page), 0);
});

await pruefe("Zustimmung über den Hinweis-Knopf: Hinweis weg, Video startet", [], async (page) => {
  await page.click(".eb-av-yt-facade:not(#frueh)");
  await page.click(".rg-video-hinweis button");
  await stimmeZu(page);
  await page.waitForFunction(() => document.querySelectorAll("iframe").length === 1, null, { timeout: 4000 });
  assert.equal(await hinweise(page), 0);
});

await pruefe("Zustimmung über das Banner (ohne Hinweis-Knopf): Hinweis verschwindet von selbst", [], async (page) => {
  await page.click(".yt-facade-t");
  await stimmeZu(page);
  await page.waitForFunction(() => !document.querySelector(".rg-video-hinweis"), null, { timeout: 4000 });
  await page.waitForFunction(() => document.querySelectorAll("iframe").length === 1, null, { timeout: 4000 });
});

await pruefe("Netz darunter: ein ohne Zustimmung eingefügtes YouTube-iframe wird entfernt", [], async (page) => {
  await page.evaluate(() => {
    const f = document.createElement("iframe");
    f.src = "https://www.youtube-nocookie.com/embed/y";
    document.querySelector(".eb-react-player").appendChild(f);
  });
  await page.waitForFunction(() => !document.querySelector("iframe"), null, { timeout: 2000 });
});

await pruefe("Netz darunter: iframe, dessen YouTube-Adresse erst nachträglich gesetzt wird, wird entfernt", [], async (page) => {
  await page.evaluate(() => {
    const f = document.createElement("iframe");
    document.querySelector(".eb-react-player").appendChild(f);
    setTimeout(() => { f.src = "https://www.youtube-nocookie.com/embed/z"; }, 50);
  });
  await page.waitForFunction(() => !document.querySelector("iframe"), null, { timeout: 2000 });
});

await pruefe("Hinweis-Text wird über aria-describedby am Knopf angesagt", [], async (page) => {
  await page.click(".eb-av-yt-facade:not(#frueh)");
  const ok = await page.evaluate(() => {
    const knopf = document.querySelector(".rg-video-hinweis button");
    const text = document.getElementById(knopf.getAttribute("aria-describedby"));
    return Boolean(text) && /YouTube/.test(text.textContent);
  });
  assert.equal(ok, true);
});

console.log(`\n${bestanden} Prüfungen bestanden`);
