
/* YouTube erst nach Zustimmung zu „YouTube Video“ im Cookie-Banner (CCM19), Andreas 09.11.2026.
   Gilt für den Video-Block (.eb-av-yt-facade) und die Kundenstimmen (.yt-facade-t); liegt einmal in der Fußzeile.
   Test: tests/video-cookie-sperre.test.mjs */
(function () {
  if (window.rgVideoSperre) return;
  window.rgVideoSperre = true;
  var DIENST = "YouTube Video";
  var PLAYER = ".eb-av-yt-facade, .yt-facade-t";
  var PRUEF_TAKT_MS = 500;
  var PRUEF_HOECHSTENS = 600;
  // CCM19 schaltet blockierte Player-Skripte (Kundenstimmen) erst nach der Zustimmung frei: kurz warten.
  var START_VERZOEGERUNG_MS = 600;
  var zaehler = 0;

  function erlaubt() {
    var liste = window.CCM && window.CCM.acceptedEmbeddings;
    return Array.isArray(liste) && liste.some(function (eintrag) { return eintrag && eintrag.name === DIENST; });
  }
  function flaecheVon(knopf) {
    return knopf.classList.contains("yt-facade-t") ? knopf : knopf.parentElement;
  }
  function hinweisWeg(flaeche) {
    var box = flaeche && flaeche.querySelector(".rg-video-hinweis");
    if (!box) return false;
    clearInterval(box.rgWarten);
    box.remove();
    return true;
  }
  function starten(knopf) {
    hinweisWeg(flaecheVon(knopf));
    setTimeout(function () {
      if (!knopf.isConnected) return;
      knopf.focus();
      knopf.click();
    }, START_VERZOEGERUNG_MS);
  }
  function hinweis(knopf) {
    var flaeche = flaecheVon(knopf);
    if (flaeche.querySelector(".rg-video-hinweis")) return;
    zaehler += 1;
    var box = document.createElement("div");
    box.className = "rg-video-hinweis";
    box.setAttribute("role", "status");
    var text = document.createElement("p");
    text.id = "rg-video-hinweis-" + zaehler;
    text.textContent = "Das Video kommt von YouTube. Zum Abspielen bitte „YouTube Video“ in den Cookie-Einstellungen erlauben.";
    var oeffnen = document.createElement("button");
    oeffnen.type = "button";
    oeffnen.textContent = "Cookie-Einstellungen öffnen";
    oeffnen.setAttribute("aria-describedby", text.id);
    oeffnen.addEventListener("click", function () {
      if (window.CCM && window.CCM.openControlPanel) window.CCM.openControlPanel();
    });
    // Bei den Kundenstimmen liegt der Hinweis im Player selbst: Eingaben nicht zum Player durchreichen.
    ["click", "keydown", "keyup", "keypress", "pointerdown", "mousedown", "touchstart"].forEach(function (typ) {
      box.addEventListener(typ, function (e) { e.stopPropagation(); });
    });
    box.appendChild(text);
    box.appendChild(oeffnen);
    flaeche.appendChild(box);
    oeffnen.focus();
    // Zustimmung kann auch über das Banner kommen, nicht nur über den Knopf: regelmäßig nachsehen.
    var versuche = 0;
    box.rgWarten = setInterval(function () {
      versuche += 1;
      if (erlaubt()) { starten(knopf); }
      else if (versuche >= PRUEF_HOECHSTENS) { clearInterval(box.rgWarten); }
    }, PRUEF_TAKT_MS);
  }
  function aktiviert(ereignis) {
    if (ereignis.type === "click") return true;
    return ereignis.type === "keydown" && (ereignis.key === "Enter" || ereignis.key === " ");
  }
  function abfangen(ereignis) {
    var ziel = ereignis.target;
    if (!ziel || !ziel.closest || ziel.closest(".rg-video-hinweis")) return;
    var knopf = ziel.closest(PLAYER);
    if (!knopf) return;
    if (erlaubt()) { hinweisWeg(flaecheVon(knopf)); return; }
    ereignis.stopImmediatePropagation();
    // touchstart/pointerdown/keyup nur stoppen: preventDefault würde dort den Klick verschlucken, der den Hinweis zeigt.
    if (aktiviert(ereignis)) {
      ereignis.preventDefault();
      hinweis(knopf);
    }
  }
  ["click", "keydown", "keyup", "keypress", "pointerdown", "mousedown", "touchstart"].forEach(function (typ) {
    window.addEventListener(typ, abfangen, { capture: true, passive: false });
  });
  // Netz darunter: Entsteht ohne Zustimmung trotzdem ein YouTube-iframe, wird es sofort entfernt.
  function istYoutube(knoten) {
    return knoten.tagName === "IFRAME" && /youtube/i.test(knoten.getAttribute("src") || "");
  }
  function entfernen(iframe) { iframe.src = "about:blank"; iframe.remove(); }
  new MutationObserver(function (aenderungen) {
    if (erlaubt()) return;
    aenderungen.forEach(function (aenderung) {
      if (aenderung.type === "attributes") {
        if (istYoutube(aenderung.target)) entfernen(aenderung.target);
        return;
      }
      aenderung.addedNodes.forEach(function (knoten) {
        if (knoten.nodeType !== 1) return;
        var treffer = istYoutube(knoten) ? [knoten] : Array.prototype.slice.call(knoten.querySelectorAll("iframe")).filter(istYoutube);
        treffer.forEach(entfernen);
      });
    });
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });
})();
