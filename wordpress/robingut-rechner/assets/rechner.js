// Oberfläche des Preisrechners: liest Eingaben, fragt die REST-Route des Plugins an und
// schreibt die Zahlen nur über textContent in die Seite.
(function () {
  "use strict";

  const R = window.RGRechnung;
  const VERZOEGERUNG_MS = 450;
  const STRASSEN_VERZOEGERUNG_MS = 250;
  const ZEITLIMIT_MS = 15000;
  const ANMELDE_TEXT = { beziehen: "Jetzt anmelden", einspeisen: "Als Erzeuger anmelden", beides: "Weiter zur Anmeldung" };
  const MELDUNG_ERZEUGER = {
    "kwp-ungueltig": "Bitte die Leistung der Anlage in kWp eingeben, zum Beispiel 100 oder 9,8.",
    "kwp-zu-klein": "Der Rechner beginnt bei 1 kWp.",
    grossanlage: "Über 1.000 kWp erstellen wir ein individuelles Angebot.",
    "ueberschuss-ungueltig": "Bitte den Überschuss im Jahr als ganze Zahl in kWh eingeben, zum Beispiel 66.500.",
    "ueberschuss-zu-klein": "Der Rechner beginnt bei 100 kWh Überschuss im Jahr.",
    "ueberschuss-zu-gross": "Bei mehr als 10 Millionen kWh im Jahr erstellen wir ein individuelles Angebot.",
    individuell: "Für diese Anlage erstellen wir ein individuelles Angebot.",
    "art-individuell": "Für Wasserkraft und Biogas erstellen wir ein individuelles Angebot.",
    laden: "Ertrag wird berechnet …",
    fehler: "Die Kosten für Erzeuger sind gerade nicht erreichbar. Bitte gleich noch einmal versuchen.",
  };
  // Nur wo die Sie-Form anders lautet; alles andere ist neutral formuliert.
  const MELDUNG_SIE = {
    "verbrauch-ungueltig": "Bitte geben Sie Ihren Verbrauch im Jahr als ganze Zahl in kWh ein, zum Beispiel 2.500.",
    plz: "Bitte geben Sie Ihre fünfstellige Postleitzahl ein.",
    ort: "Bitte wählen Sie Ihren Ort, damit wir das richtige Netzgebiet finden.",
    adresse: "Bitte geben Sie Straße und Hausnummer ein, damit wir das richtige Netzgebiet finden.",
    strasseFehlt: "Bitte geben Sie Ihre Straße ein.",
    hausnummerFehlt: "Bitte geben Sie Ihre Hausnummer ein.",
    strasseListe: "Bitte wählen Sie Ihre Straße aus den Vorschlägen.",
    fehler: "Die Preise sind gerade nicht erreichbar. Bitte versuchen Sie es gleich noch einmal.",
    unplausibel: "Für diese Angaben konnten wir keinen verlässlichen Preis ermitteln. Bitte versuchen Sie es gleich noch einmal.",
  };
  const MELDUNG = {
    "verbrauch-ungueltig": "Gib deinen Verbrauch im Jahr als ganze Zahl in kWh ein, zum Beispiel 2.500.",
    "zu-klein": "Der Rechner beginnt bei 500 kWh im Jahr.",
    grossverbrauch: "Ab 100.000 kWh im Jahr erstellen wir ein individuelles Angebot.",
    plz: "Gib deine fünfstellige Postleitzahl ein.",
    laden: "Preis wird berechnet …",
    ort: "Bitte wähle deinen Ort, damit wir das richtige Netzgebiet finden.",
    adresse: "Bitte gib Straße und Hausnummer ein, damit wir das richtige Netzgebiet finden.",
    strasseFehlt: "Bitte gib deine Straße ein.",
    hausnummerFehlt: "Bitte gib deine Hausnummer ein.",
    strasseListe: "Bitte wähle deine Straße aus den Vorschlägen.",
    fehler: "Die Preise sind gerade nicht erreichbar. Bitte versuch es gleich noch einmal.",
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
    const status = wurzel.querySelector(".rgr-status-bezug");
    const statusErzeugung = wurzel.querySelector(".rgr-status-erzeugung");
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
      // same-origin statt omit: Hinter einem Basic-Auth-Passwortschutz (Release-Seite) käme sonst 401.
      // Ohne REST-Nonce behandelt WordPress die Anfrage trotz Cookie als nicht angemeldet.
      credentials: "same-origin",
      // Ohne Zeitlimit bliebe eine im Netz hängende Anfrage für immer „unterwegs“ und sperrte Weiter.
      signal: AbortSignal.timeout(ZEITLIMIT_MS),
    });
    const sie = wurzel.dataset.anrede === "sie";
    const text = (schluessel) => (sie && MELDUNG_SIE[schluessel]) || MELDUNG[schluessel];
    const leer = wurzel.querySelector(".rgr-leer");
    const erzeugerBox = wurzel.querySelector(".rgr-ergebnis-erzeuger");
    const teilBezug = wurzel.querySelector(".rgr-teil-bezug");
    const teilErzeugung = wurzel.querySelector(".rgr-teil-erzeugung");
    const anmelden = wurzel.querySelector(".rgr-anmelden");
    const aktualisiereLeer = () => { leer.hidden = !ergebnis.hidden || !erzeugerBox.hidden; };
    const melde = (inhalt) => { status.textContent = inhalt || ""; };
    const laedt = (ja) => { ergebnis.classList.toggle("rgr-laedt", ja); ergebnis.setAttribute("aria-busy", String(ja)); };
    const versteckeErgebnis = () => { ergebnis.hidden = true; preise = null; laedt(false); aktualisiereLeer(); };

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
      aktualisiereLeer();
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
      if (teilBezug.hidden) return;
      const plz = feld("plz").value.trim();
      const kwh = R.kwhAusEingabe(feld("kwh").value);
      markierePersonen(kwh);
      const verbrauch = R.pruefeVerbrauch(kwh);
      if (!/^\d{5}$/.test(plz)) return abbruch(plz ? text("plz") : "");
      if (verbrauch !== "ok") return abbruch(text(verbrauch));

      const body = { plz, kwh };
      if (!ortBox.hidden) {
        const ort = feld("ort").value;
        if (!ort) return abbruch(text("ort"));
        body.ort = ort;
      }
      if (!adresse.hidden) {
        const strasse = feld("strasse").value.trim();
        const hausnummer = feld("hausnummer").value.trim();
        if (!strasse && !hausnummer) return abbruch(text("adresse"));
        if (!strasse) return abbruch(text("strasseFehlt"));
        if (!hausnummer) return abbruch(text("hausnummerFehlt"));
        // Unbekannte Straßen beantwortet der Partner mit einem Fehler; also nur Vorschläge schicken.
        if (strassen.length && !strassen.includes(strasse)) return abbruch(text("strasseListe"));
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
      melde(text("laden"));
      laedt(true);
      try {
        const { ok, daten } = await frage(body);
        if (nr !== anfrageNr) return;
        if (!ok) { versteckeErgebnis(); return melde((daten && typeof daten.fehler === "string") ? daten.fehler : text("fehler")); }
        if (daten && daten.requires_city_selection === true) {
          fuelleOrte(Array.isArray(daten.orte) ? daten.orte : []);
          ortBox.hidden = false;
          adresse.hidden = true;
          versteckeErgebnis();
          return melde(text("ort"));
        }
        if (daten && daten.requires_district_selection === true) {
          stadt = typeof daten.city === "string" ? daten.city : "";
          adresse.hidden = false;
          versteckeErgebnis();
          return melde(text("adresse"));
        }
        preise = R.pruefePreise(daten, kwh);
        if (!preise) { versteckeErgebnis(); return melde(text("unplausibel")); }
        gezeigtFuer = schluessel;
        zeige(true);
      } catch {
        if (nr === anfrageNr) { versteckeErgebnis(); melde(text("fehler")); }
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

    // Erzeuger: Kosten kommen vom Plugin (Partnerwerte), der Erlös wird hier gerechnet.
    // Angezeigt wird nur, was zu den Eingaben der letzten Antwort gehört (erzeugerFuer).
    let kosten = null;
    let erzeugerNr = 0;
    let erzeugerWarten = null;
    let erzeugerFuer = "";
    let erzeugerLaeuft = "";   // Anfrage, die gerade unterwegs ist; gleiche nicht doppelt schicken
    const zahl1 = (wert) => wert.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const teilE = (name) => erzeugerBox.querySelector(`[data-feld="${name}"]`);
    const meldeE = (inhalt) => { statusErzeugung.textContent = inhalt || ""; };
    const blendeAb = (ja) => { erzeugerBox.classList.toggle("rgr-laedt", ja); erzeugerBox.setAttribute("aria-busy", String(ja)); };
    const versteckeErzeuger = () => { erzeugerBox.hidden = true; blendeAb(false); aktualisiereLeer(); };
    const wunsch = () => R.wunschpreisAusWert(feld("wunschpreis").value) ?? R.WUNSCHPREIS_VORBELEGUNG;
    const meldeErzeuger = (schluessel) => { kosten = null; erzeugerFuer = ""; versteckeErzeuger(); meldeE(MELDUNG_ERZEUGER[schluessel]); };

    function anlageAusFormular() {
      return {
        art: feld("art").value,
        kwp: R.kwpAusEingabe(feld("kwp").value),
        kwh: R.kwhAusEingabe(feld("ueberschuss").value),
        einspeisung: form.querySelector("[name=einspeisung]:checked")?.value === "voll" ? "voll" : "teil",
        foerderung: form.querySelector("[name=foerderung]:checked")?.value === "ja",
      };
    }

    function zeigeErzeuger() {
      const ct = wunsch();
      wurzel.querySelector(".rgr-wunschpreis-wert").textContent = `${zahl1(ct)} ct/kWh`;
      if (!kosten) return;
      // Geänderte Eingaben ohne neue Antwort: altes Ergebnis nur abgeblendet stehen lassen.
      if (JSON.stringify(anlageAusFormular()) !== erzeugerFuer) return blendeAb(true);
      const anlage = JSON.parse(erzeugerFuer);
      const e = R.berechneErzeuger(anlage.kwh, ct, kosten, anlage);
      if (!e) return versteckeErzeuger();
      teilE("erloes-rechnung").textContent = `${anlage.kwh.toLocaleString("de-DE")} kWh × ${zahl1(ct)} ct`;
      teilE("erloes").textContent = R.euro(e.erloes);
      teilE("grund-rechnung").textContent = `12 × ${R.euro(kosten.grundMonat, 2)}`;
      teilE("grund").textContent = `− ${R.euro(e.grundJahr)}`;
      teilE("vermarktung-rechnung").textContent = `${R.cent(kosten.vermarktungCt)}/kWh`;
      teilE("vermarktung").textContent = `− ${R.euro(e.vermarktung)}`;
      teilE("bleibt").textContent = `rund ${R.euro(e.bleibt)}`;
      erzeugerBox.querySelector(".rgr-anschluss").hidden = e.anschluss === null;
      teilE("anschluss").textContent = e.anschluss === null ? "" : `höchstens ${R.euro(e.anschluss)}`;
      erzeugerBox.querySelector(".rgr-hinweis-foerderung").hidden = !anlage.foerderung;
      teilE("einrichtung").textContent = R.euro(e.einrichtung);
      erzeugerBox.querySelector(".rgr-fernwirk").hidden = !R.brauchtFernwirktechnik(anlage.kwp);
      blendeAb(false);
      erzeugerBox.hidden = false;
      aktualisiereLeer();
    }

    async function rechneErzeuger() {
      if (teilErzeugung.hidden) return;
      const body = anlageAusFormular();
      const pruefung = R.pruefeAnlage(body.kwp, body.kwh);
      if (pruefung !== "ok") { erzeugerNr++; erzeugerLaeuft = ""; return meldeErzeuger(pruefung); }
      if (R.ANLAGENARTEN[body.art]?.individuell !== false) { erzeugerNr++; erzeugerLaeuft = ""; return meldeErzeuger("art-individuell"); }
      const schluessel = JSON.stringify(body);
      if (schluessel === erzeugerLaeuft) return;
      // Zurück auf die Eingaben der letzten Antwort: eine noch laufende andere Anfrage verfällt.
      if (kosten && schluessel === erzeugerFuer) { erzeugerNr++; erzeugerLaeuft = ""; meldeE(""); return zeigeErzeuger(); }
      const nr = ++erzeugerNr;
      erzeugerLaeuft = schluessel;
      blendeAb(true);
      meldeE(MELDUNG_ERZEUGER.laden);
      try {
        const antwort = await sende("erzeuger", body);
        const daten = await antwort.json().catch(() => null);
        if (nr !== erzeugerNr || teilErzeugung.hidden) return;
        const geprueft = antwort.ok ? R.pruefeErzeugerKosten(daten) : null;
        if (!geprueft) return meldeErzeuger("fehler");
        if (geprueft.individuell) return meldeErzeuger("individuell");
        kosten = geprueft;
        erzeugerFuer = schluessel;
        meldeE("");
        zeigeErzeuger();
      } catch {
        if (nr === erzeugerNr) meldeErzeuger("fehler");
      } finally {
        if (nr === erzeugerNr) erzeugerLaeuft = "";
      }
    }

    function setzeRolle(rolle) {
      teilBezug.hidden = rolle === "einspeisen";
      teilErzeugung.hidden = rolle === "beziehen";
      anmelden.textContent = ANMELDE_TEXT[rolle];
      if (teilBezug.hidden) { verwerfeLaufende(); versteckeErgebnis(); }
      if (teilErzeugung.hidden) { erzeugerNr++; erzeugerLaeuft = ""; versteckeErzeuger(); meldeE(""); }
      melde("");
    }

    const ERZEUGER_FELDER = ["art", "kwp", "ueberschuss", "einspeisung", "foerderung"];
    form.addEventListener("change", (e) => {
      if (e.target.name === "rolle") setzeRolle(R.rolleAusWert(e.target.value));
    });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      clearTimeout(warten);
      clearTimeout(erzeugerWarten);
      rechne();
      rechneErzeuger();
    });
    form.addEventListener("input", (e) => {
      const name = e.target.name;
      if (name === "rolle") return;
      if (name === "wunschpreis") return zeigeErzeuger();
      if (ERZEUGER_FELDER.includes(name)) {
        if (kosten && !erzeugerBox.hidden) blendeAb(true);
        clearTimeout(erzeugerWarten);
        erzeugerWarten = setTimeout(rechneErzeuger, VERZOEGERUNG_MS);
        return;
      }
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
