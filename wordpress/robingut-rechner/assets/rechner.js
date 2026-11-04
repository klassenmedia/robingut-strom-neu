// Oberfläche des Preisrechners: liest Eingaben, fragt die REST-Route des Plugins an und
// schreibt die Zahlen nur über textContent in die Seite.
(function () {
  "use strict";

  const R = window.RGRechnung;
  const VERZOEGERUNG_MS = 450;
  const STRASSEN_VERZOEGERUNG_MS = 250;
  const MELDUNG = {
    "verbrauch-ungueltig": "Gib deinen Verbrauch im Jahr als ganze Zahl in kWh ein, zum Beispiel 2.500.",
    "zu-klein": "Der Rechner beginnt bei 500 kWh im Jahr.",
    grossverbrauch: "Über 100.000 kWh im Jahr erstellen wir dir ein individuelles Angebot: info@robingut-strom.de.",
    plz: "Gib deine fünfstellige Postleitzahl ein.",
    laden: "Preis wird berechnet …",
    ort: "Bitte wähle deinen Ort, damit wir das richtige Netzgebiet finden.",
    adresse: "Bitte gib Straße und Hausnummer ein, damit wir das richtige Netzgebiet finden.",
    strasseListe: "Bitte wähle deine Straße aus den Vorschlägen.",
    fehler: "Die Preise unseres Partners sind gerade nicht erreichbar. Bitte versuch es gleich noch einmal.",
    unplausibel: "Für diese Angaben konnten wir keinen verlässlichen Preis ermitteln. Bitte versuch es gleich noch einmal.",
  };
  const VERGLEICH = {
    ersparnis: ["Du sparst", (j) => `ca. ${R.euro(j)} im Jahr gegenüber deinem heutigen Abschlag, Lesekopf-Miete schon abgezogen.`],
    gleich: ["Etwa gleich", () => "wie dein heutiger Abschlag, mit Lesekopf-Miete."],
    mehrkosten: ["Mehrkosten", (j) => `ca. ${R.euro(-j)} im Jahr mehr als dein heutiger Abschlag, mit Lesekopf-Miete.`],
  };

  function starte(wurzel) {
    const rest = wurzel.dataset.rest;
    const form = wurzel.querySelector(".rgr-form");
    const feld = (name) => form.elements.namedItem(name);
    const teil = (name) => wurzel.querySelector(`[data-feld="${name}"]`);
    const status = wurzel.querySelector(".rgr-status");
    const ergebnis = wurzel.querySelector(".rgr-ergebnis");
    const vergleichBox = wurzel.querySelector(".rgr-vergleich");
    const ortBox = wurzel.querySelector(".rgr-ort");
    const adresse = wurzel.querySelector(".rgr-adresse");
    const strassenListe = wurzel.querySelector("datalist");
    const personen = [...wurzel.querySelectorAll(".rgr-person")];
    let preise = null;
    let stadt = "";
    let anfrageNr = 0;
    let strassenNr = 0;
    let warten = null;
    let strassenWarten = null;

    // Funktioniert auch mit Permalinks im Format ?rest_route=
    const routenUrl = (route) => new URL(rest + route, window.location.href).toString();
    const sende = (route, body) => fetch(routenUrl(route), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      credentials: "omit",
    });
    const melde = (text) => { status.textContent = text || ""; };
    const laedt = (ja) => { ergebnis.classList.toggle("rgr-laedt", ja); ergebnis.setAttribute("aria-busy", String(ja)); };
    const versteckeErgebnis = () => { ergebnis.hidden = true; preise = null; laedt(false); };

    function zeige() {
      const r = R.berechne(preise, R.betragAusEingabe(feld("abschlag").value));
      if (r.status !== "ok") return versteckeErgebnis();
      teil("monat").textContent = R.euro(r.monat);
      teil("jahr").textContent = R.euro(r.jahr, 2);
      teil("ort").textContent = preise.stadt ? ` · Netzgebiet ${preise.stadt}` : "";
      teil("arbeitspreis").textContent = `${R.cent(preise.arbeitspreisCt)} pro kWh`;
      teil("gebuehr").textContent = `${R.cent(preise.gebuehrCt)} pro kWh`;
      teil("grundpreis").textContent = R.euro(preise.grundMonat, 2);
      teil("lesekopf").textContent = `${R.euro(R.LESEKOPF_MIETE_MONAT, 2)} im Monat Miete oder einmalig ${R.euro(R.LESEKOPF_KAUF)} Kauf`;
      const v = r.vergleich;
      vergleichBox.hidden = !v;
      if (v) {
        vergleichBox.dataset.art = v.art;
        teil("vergleich-titel").textContent = VERGLEICH[v.art][0];
        teil("vergleich-text").textContent = VERGLEICH[v.art][1](v.jahr);
      }
      ergebnis.hidden = false;
      laedt(false);
      melde("");
    }

    function fuelleOrte(orte) {
      const auswahl = feld("ort");
      auswahl.replaceChildren(auswahl.options[0], ...orte.map((name) => {
        const option = document.createElement("option");
        option.value = String(name);
        option.textContent = String(name);
        return option;
      }));
      auswahl.value = "";
    }

    // Ein neuer Ort braucht ggf. eine neue Straße; eine neue PLZ auch einen neuen Ort.
    function setzeZusatzZurueck(nurAdresse) {
      if (!nurAdresse) { fuelleOrte([]); ortBox.hidden = true; }
      adresse.hidden = true;
      stadt = "";
      strassenNr++;
      strassenListe.replaceChildren();
    }

    function markierePersonen(kwh) {
      for (const knopf of personen) knopf.setAttribute("aria-pressed", String(Number(knopf.dataset.kwh) === kwh));
    }

    async function frage(body) {
      const antwort = await sende("preis", body);
      const daten = await antwort.json().catch(() => null);
      return { ok: antwort.ok, daten };
    }

    async function rechne() {
      const plz = feld("plz").value.trim();
      const kwh = R.kwhAusEingabe(feld("kwh").value);
      markierePersonen(kwh);
      const verbrauch = R.pruefeVerbrauch(kwh);
      const nr = ++anfrageNr;
      if (!/^\d{5}$/.test(plz)) { versteckeErgebnis(); return melde(plz ? MELDUNG.plz : ""); }
      if (verbrauch !== "ok") { versteckeErgebnis(); return melde(MELDUNG[verbrauch]); }

      const body = { plz, kwh };
      if (!ortBox.hidden) {
        const ort = feld("ort").value;
        if (!ort) { versteckeErgebnis(); return melde(MELDUNG.ort); }
        body.ort = ort;
      }
      if (!adresse.hidden) {
        const strasse = feld("strasse").value.trim();
        const hausnummer = feld("hausnummer").value.trim();
        if (!strasse || !hausnummer) { versteckeErgebnis(); return melde(MELDUNG.adresse); }
        // Unbekannte Straßen beantwortet der Partner mit einem Fehler; also nur Vorschläge schicken.
        const vorschlaege = [...strassenListe.options].map((o) => o.value);
        if (vorschlaege.length && !vorschlaege.includes(strasse)) { versteckeErgebnis(); return melde(MELDUNG.strasseListe); }
        Object.assign(body, { strasse, hausnummer });
      }
      melde(MELDUNG.laden);
      laedt(true);
      try {
        const { ok, daten } = await frage(body);
        if (nr !== anfrageNr) return;
        if (!ok) { versteckeErgebnis(); return melde((daten && typeof daten.fehler === "string") ? daten.fehler : MELDUNG.fehler); }
        if (daten && daten.requires_city_selection === true) {
          fuelleOrte(Array.isArray(daten.orte) ? daten.orte : []);
          ortBox.hidden = false;
          adresse.hidden = true;
          versteckeErgebnis();
          return melde(MELDUNG.ort);
        }
        if (daten && daten.requires_district_selection === true) {
          stadt = typeof daten.city === "string" ? daten.city : "";
          adresse.hidden = false;
          versteckeErgebnis();
          return melde(MELDUNG.adresse);
        }
        preise = R.pruefePreise(daten, kwh);
        if (!preise) { versteckeErgebnis(); return melde(MELDUNG.unplausibel); }
        zeige();
      } catch {
        if (nr === anfrageNr) { versteckeErgebnis(); melde(MELDUNG.fehler); }
      }
    }

    function spaeter(fn, ms) {
      clearTimeout(warten);
      warten = setTimeout(fn, ms);
    }

    async function sucheStrassen() {
      const suche = feld("strasse").value.trim();
      if (!stadt || suche.length < 2) return;
      const nr = ++strassenNr;
      try {
        const antwort = await sende("strassen", { plz: feld("plz").value.trim(), stadt, suche });
        const daten = await antwort.json();
        if (nr !== strassenNr) return;
        strassenListe.replaceChildren(...(Array.isArray(daten.strassen) ? daten.strassen : []).map((name) => {
          const option = document.createElement("option");
          option.value = String(name);
          return option;
        }));
      } catch {
        if (nr === strassenNr) strassenListe.replaceChildren();
      }
    }

    form.addEventListener("submit", (e) => { e.preventDefault(); clearTimeout(warten); rechne(); });
    form.addEventListener("input", (e) => {
      const name = e.target.name;
      if (name === "abschlag") return preise && zeige();
      if (name === "plz") setzeZusatzZurueck(false);
      if (name === "ort") { setzeZusatzZurueck(true); clearTimeout(warten); return rechne(); }
      if (name === "strasse") {
        clearTimeout(strassenWarten);
        strassenWarten = setTimeout(sucheStrassen, STRASSEN_VERZOEGERUNG_MS);
      }
      // Bei der Adresse erst rechnen, wenn das Feld verlassen wird; Tipp-Pausen kosten sonst Partner-Anfragen.
      if (name === "strasse" || name === "hausnummer") return;
      spaeter(rechne, VERZOEGERUNG_MS);
    });
    form.addEventListener("change", (e) => {
      if (e.target.name === "strasse" || e.target.name === "hausnummer") { clearTimeout(warten); rechne(); }
    });
    form.addEventListener("click", (e) => {
      const knopf = e.target.closest(".rgr-person");
      if (!knopf) return;
      feld("kwh").value = knopf.dataset.kwh;
      clearTimeout(warten);
      rechne();
    });
  }

  function alle() {
    if (!R) return;
    document.querySelectorAll(".rgr").forEach(starte);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", alle);
  else alle();
})();
