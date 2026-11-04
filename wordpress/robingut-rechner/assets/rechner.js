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
    strasseFehlt: "Bitte gib deine Straße ein.",
    hausnummerFehlt: "Bitte gib deine Hausnummer ein.",
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
    const vorschlagsListe = wurzel.querySelector(".rgr-vorschlaege");
    const personen = [...wurzel.querySelectorAll(".rgr-person")];
    let preise = null;
    let stadt = "";
    let anfrageNr = 0;
    let strassenNr = 0;
    let warten = null;
    let strassenWarten = null;
    let strassen = [];      // letzte Vorschläge des Partners; nur diese werden zum Rechnen geschickt
    let aktiv = -1;         // markierter Vorschlag, -1 = keiner
    let gezeigtFuer = "";   // Anfrage, zu der das sichtbare Ergebnis gehört
    let laeuftFuer = "";    // Anfrage, die gerade unterwegs ist
    const ansage = wurzel.querySelector(".rgr-ansage");

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

    // frisch: Die Zahlen kommen gerade vom Server. Sonst (Abschlag getippt) bleiben Abblendung und
    // Status, wie sie sind, denn das Ergebnis kann zu einer schon geänderten Adresse gehören.
    function zeige(frisch = false) {
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
      if (frisch) {
        laedt(false);
        melde("");
      }
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

    function markiere(index) {
      aktiv = index;
      const eintraege = [...vorschlagsListe.children];
      eintraege.forEach((li, i) => li.setAttribute("aria-selected", String(i === index)));
      const ziel = eintraege[index];
      if (ziel) {
        feld("strasse").setAttribute("aria-activedescendant", ziel.id);
        ziel.scrollIntoView({ block: "nearest" });
      } else {
        feld("strasse").removeAttribute("aria-activedescendant");
      }
    }

    function schliesseVorschlaege() {
      vorschlagsListe.hidden = true;
      feld("strasse").setAttribute("aria-expanded", "false");
      markiere(-1);
    }

    function oeffneVorschlaege() {
      vorschlagsListe.hidden = false;
      feld("strasse").setAttribute("aria-expanded", "true");
    }

    function zeigeVorschlaege(namen, ansagen = false) {
      strassen = namen;
      if (ansagen) {
        ansage.textContent = namen.length === 0 ? "Keine passende Straße gefunden."
          : `${namen.length} ${namen.length === 1 ? "Vorschlag" : "Vorschläge"}, mit den Pfeiltasten auswählen.`;
      }
      vorschlagsListe.replaceChildren(...namen.map((name, i) => {
        const li = document.createElement("li");
        li.id = `${vorschlagsListe.id}-${i}`;
        li.setAttribute("role", "option");
        li.setAttribute("aria-selected", "false");
        li.dataset.index = String(i);
        li.textContent = name;
        return li;
      }));
      const offen = namen.length > 0 && document.activeElement === feld("strasse");
      vorschlagsListe.hidden = !offen;
      feld("strasse").setAttribute("aria-expanded", String(offen));
      markiere(-1);
    }

    function waehle(index) {
      const name = strassen[index];
      if (name === undefined) return;
      // Eine noch geplante oder laufende Suche darf die Liste nach der Wahl nicht wieder öffnen.
      clearTimeout(strassenWarten);
      strassenNr++;
      feld("strasse").value = name;
      schliesseVorschlaege();
      if (feld("hausnummer").value.trim()) { clearTimeout(warten); rechne(); }
      else feld("hausnummer").focus();
    }

    // Ein neuer Ort braucht ggf. eine neue Straße; eine neue PLZ auch einen neuen Ort.
    function setzeZusatzZurueck(nurAdresse) {
      if (!nurAdresse) { fuelleOrte([]); ortBox.hidden = true; }
      adresse.hidden = true;
      stadt = "";
      strassenNr++;
      strassen = [];
      vorschlagsListe.replaceChildren();
      schliesseVorschlaege();
    }

    function markierePersonen(kwh) {
      for (const knopf of personen) knopf.setAttribute("aria-pressed", String(Number(knopf.dataset.kwh) === kwh));
    }

    async function frage(body) {
      const antwort = await sende("preis", body);
      const daten = await antwort.json().catch(() => null);
      return { ok: antwort.ok, daten };
    }

    // Laufende Antworten verfallen, etwa wenn sich die Adresse schon wieder geändert hat.
    function verwerfeLaufende() {
      anfrageNr++;
      laeuftFuer = "";
    }

    function abbruch(meldung) {
      verwerfeLaufende();
      versteckeErgebnis();
      melde(meldung);
    }

    async function rechne() {
      const plz = feld("plz").value.trim();
      const kwh = R.kwhAusEingabe(feld("kwh").value);
      markierePersonen(kwh);
      const verbrauch = R.pruefeVerbrauch(kwh);
      if (!/^\d{5}$/.test(plz)) return abbruch(plz ? MELDUNG.plz : "");
      if (verbrauch !== "ok") return abbruch(MELDUNG[verbrauch]);

      const body = { plz, kwh };
      if (!ortBox.hidden) {
        const ort = feld("ort").value;
        if (!ort) return abbruch(MELDUNG.ort);
        body.ort = ort;
      }
      if (!adresse.hidden) {
        const strasse = feld("strasse").value.trim();
        const hausnummer = feld("hausnummer").value.trim();
        if (!strasse && !hausnummer) return abbruch(MELDUNG.adresse);
        if (!strasse) return abbruch(MELDUNG.strasseFehlt);
        if (!hausnummer) return abbruch(MELDUNG.hausnummerFehlt);
        // Unbekannte Straßen beantwortet der Partner mit einem Fehler; also nur Vorschläge schicken.
        if (strassen.length && !strassen.includes(strasse)) return abbruch(MELDUNG.strasseListe);
        Object.assign(body, { strasse, hausnummer });
      }
      // Gleiche Anfrage wie die laufende oder die angezeigte: kein zweiter Aufruf beim Partner.
      const schluessel = JSON.stringify(body);
      if (schluessel === laeuftFuer) return;
      if (preise && !ergebnis.hidden && schluessel === gezeigtFuer) {
        verwerfeLaufende();
        laedt(false);
        return melde("");
      }
      const nr = ++anfrageNr;
      laeuftFuer = schluessel;
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
        gezeigtFuer = schluessel;
        zeige(true);
      } catch {
        if (nr === anfrageNr) { versteckeErgebnis(); melde(MELDUNG.fehler); }
      } finally {
        if (nr === anfrageNr) laeuftFuer = "";
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
        if (!antwort.ok) throw new Error("Straßensuche nicht verfügbar");
        zeigeVorschlaege((Array.isArray(daten.strassen) ? daten.strassen : []).map(String), true);
      } catch {
        if (nr !== strassenNr) return;
        zeigeVorschlaege([]);
        ansage.textContent = "Vorschläge sind gerade nicht verfügbar.";
      }
    }

    const strassenFeld = feld("strasse");
    strassenFeld.addEventListener("keydown", (e) => {
      if (vorschlagsListe.hidden) {
        if (e.key === "ArrowDown" && strassen.length) { e.preventDefault(); oeffneVorschlaege(); markiere(0); }
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        markiere(R.naechsterVorschlag(aktiv, strassen.length, e.key));
      } else if (e.key === "Enter" && aktiv >= 0) {
        e.preventDefault();
        waehle(aktiv);
      } else if (e.key === "Escape") {
        schliesseVorschlaege();
      }
    });
    strassenFeld.addEventListener("focus", () => { if (strassen.length) oeffneVorschlaege(); });
    strassenFeld.addEventListener("blur", schliesseVorschlaege);
    // mousedown statt click und für die ganze Liste (auch Rand und Scrollbar): Das Feld behält den Fokus.
    vorschlagsListe.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const li = e.target.closest("[role=option]");
      if (li) waehle(Number(li.dataset.index));
    });

    form.addEventListener("submit", (e) => { e.preventDefault(); clearTimeout(warten); rechne(); });
    form.addEventListener("input", (e) => {
      const name = e.target.name;
      if (name === "abschlag") return preise && zeige();
      if (name === "kwh") markierePersonen(R.kwhAusEingabe(feld("kwh").value));
      if (name === "plz") setzeZusatzZurueck(false);
      if (name === "ort") { setzeZusatzZurueck(true); clearTimeout(warten); return rechne(); }
      if (name === "strasse") {
        clearTimeout(strassenWarten);
        strassenWarten = setTimeout(sucheStrassen, STRASSEN_VERZOEGERUNG_MS);
      }
      // Bei der Adresse erst rechnen, wenn das Feld verlassen wird; Tipp-Pausen kosten sonst Partner-Anfragen.
      // Bis dahin gehört das Ergebnis noch zur vorigen Adresse: abblenden, laufende Antworten verwerfen.
      // Nur wer gerade im Adressfeld tippt, schiebt das Rechnen auf; Autofill ohne Fokus rechnet wie sonst.
      if ((name === "strasse" || name === "hausnummer") && document.activeElement === e.target) {
        // Eine geplante Rechnung (z. B. nach dem Verbrauch) käme sonst mitten ins Tippen; focusout holt sie nach.
        clearTimeout(warten);
        verwerfeLaufende();
        if (preise) laedt(true);
        return;
      }
      spaeter(rechne, VERZOEGERUNG_MS);
    });
    // Beim Verlassen immer prüfen: geänderte Adresse rechnet neu, unveränderte hebt nur die Abblendung auf.
    form.addEventListener("focusout", (e) => {
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
