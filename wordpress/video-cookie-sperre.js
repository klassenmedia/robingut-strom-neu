
/* Video erst nach Zustimmung zu „YouTube Video“ im Cookie-Banner (CCM19), Andreas 09.11.2026 */
(function () {
  if (window.rgVideoSperre) return;
  window.rgVideoSperre = true;
  var DIENST = /youtube/i;
  function erlaubt() {
    var liste = window.CCM && window.CCM.acceptedEmbeddings;
    return Array.isArray(liste) && liste.some(function (eintrag) { return eintrag && DIENST.test(eintrag.name); });
  }
  function hinweis(knopf) {
    var flaeche = knopf.parentElement;
    if (flaeche.querySelector(".rg-video-hinweis")) return;
    var box = document.createElement("div");
    box.className = "rg-video-hinweis";
    box.setAttribute("role", "status");
    var text = document.createElement("p");
    text.textContent = "Das Video kommt von YouTube. Zum Abspielen bitte „YouTube Video“ in den Cookie-Einstellungen erlauben.";
    var oeffnen = document.createElement("button");
    oeffnen.type = "button";
    oeffnen.textContent = "Cookie-Einstellungen öffnen";
    oeffnen.addEventListener("click", function () {
      if (window.CCM && window.CCM.openControlPanel) window.CCM.openControlPanel();
      var versuche = 0;
      var warten = setInterval(function () {
        versuche += 1;
        if (erlaubt()) { clearInterval(warten); box.remove(); knopf.click(); }
        else if (versuche > 600) { clearInterval(warten); }
      }, 500);
    });
    box.appendChild(text);
    box.appendChild(oeffnen);
    flaeche.appendChild(box);
    oeffnen.focus();
  }
  document.addEventListener("click", function (ereignis) {
    var knopf = ereignis.target.closest ? ereignis.target.closest(".eb-av-yt-facade") : null;
    if (!knopf || erlaubt()) return;
    ereignis.preventDefault();
    ereignis.stopImmediatePropagation();
    hinweis(knopf);
  }, true);
})();
