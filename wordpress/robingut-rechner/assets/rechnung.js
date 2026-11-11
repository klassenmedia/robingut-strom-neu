// Reine Rechnung des ROBIN GUT Preisrechners. Zeigt dieselben Zahlen wie der Rechner des
// Partners, weil dessen Preis die Provision schon enthält. Läuft im Browser
// (window.RGRechnung) und in Node (require) für die Tests.
(function (wurzel) {
  "use strict";

  const VERBRAUCH_MIN = 500;
  const VERBRAUCH_MAX = 100000;          // darüber individuelles Angebot
  const LESEKOPF_MIETE_MONAT = 3.9;      // nicht im Partnerpreis enthalten, nur Hinweis
  const LESEKOPF_KAUF = 89;
  const ETWA_GLEICH_JAHR = 12;           // unter 1 € im Monat Unterschied
  const ABSCHLAG_MAX = 2000;
  const STADT_MAX = 100;
  // Gleiche Grenzen wie rgr_preise_plausibel() in logik.php
  const SUMME_TOLERANZ_ANTEIL = 0.005;
  const SUMME_TOLERANZ_MIN = 2;
  const GRUNDPREIS_MONAT_TOLERANZ = 0.05;
  // Preisbildung wie im Rechner des Partners (WSE-Seite, geprüft 09.11.2026): Community-Preis startet bei
  // Netzkosten + 8 ct netto Energie, brutto mit 19 % MwSt.; Anteil startet bei 50 %.
  const COMMUNITY_ENERGIE_NETTO_CT = 8;
  const MWST_FAKTOR = 1.19;
  const ANTEIL_VORBELEGUNG = 50;
  const NETZKOSTEN_CT = [10, 40];   // plausible Spanne brutto (Netzentgelte, Umlagen, Steuern)

  const KWH_MUSTER = /^([1-9]\d*|[1-9]\d{0,2}(\.\d{3})+)$/;   // "3.500" ist dreitausendfünfhundert
  const BETRAG_MUSTER = /^\d+([.,]\d{1,2})?$/;

  function ohneLeerzeichen(roh) {
    return String(roh ?? "").replace(/\s/g, "");
  }

  function kwhAusEingabe(roh) {
    const text = ohneLeerzeichen(roh);
    if (!KWH_MUSTER.test(text)) return null;
    const wert = Number(text.replace(/\./g, ""));
    return wert > 0 ? wert : null;
  }

  function betragAusEingabe(roh) {
    const text = ohneLeerzeichen(roh).replace(/€$/, "");
    if (!BETRAG_MUSTER.test(text)) return null;
    const wert = Number(text.replace(",", "."));
    return wert > 0 && wert <= ABSCHLAG_MAX ? wert : null;
  }

  // Ab 100.000 kWh gibt es laut Übergabe ein individuelles Angebot statt eines Rechnerpreises.
  function pruefeVerbrauch(kwh) {
    if (!Number.isFinite(kwh)) return "verbrauch-ungueltig";
    if (kwh < VERBRAUCH_MIN) return "zu-klein";
    if (kwh >= VERBRAUCH_MAX) return "grossverbrauch";
    return "ok";
  }

  const ROLLEN = Object.freeze(["beziehen", "einspeisen", "zubehoer"]);
  const rolleAusWert = (wert) => (ROLLEN.includes(wert) ? wert : "beziehen");

  // Das öffentliche Preismodell des Partners kennt nur PV und Wind (geprüft 09.11.2026);
  // Wasserkraft und Biogas bekommen ein individuelles Angebot.
  const ANLAGENARTEN = Object.freeze({
    pv: Object.freeze({ name: "Photovoltaik", individuell: false }),
    wind: Object.freeze({ name: "Wind", individuell: false }),
    wasser: Object.freeze({ name: "Wasserkraft", individuell: true }),
    biogas: Object.freeze({ name: "Biogas", individuell: true }),
  });
  const KWP_MIN = 1;
  const KWP_MAX = 1000;                  // darüber individuelles Angebot beim Partner
  const UEBERSCHUSS_MIN = 100;
  const UEBERSCHUSS_MAX = 10000000;
  const WUNSCHPREIS_MIN = 7;
  const WUNSCHPREIS_MAX = 11;
  const WUNSCHPREIS_VORBELEGUNG = 10;
  const ANSCHLUSS_CT = 4.5;              // Jahresmarktwert Solar 2025 gerundet, Anschlussvergütung liegt darunter
  const FERNWIRK_AB_KW = 25;
  const ANSCHLUSS_BIS_KWP = 100;
  const KWP_MUSTER = /^([1-9]\d*|[1-9]\d{0,2}(\.\d{3})+)(,\d)?$/;

  function kwpAusEingabe(roh) {
    const text = ohneLeerzeichen(roh);
    if (!KWP_MUSTER.test(text)) return null;
    const wert = Number(text.replace(/\./g, "").replace(",", "."));
    return wert > 0 ? wert : null;
  }

  function pruefeAnlage(kwp, kwh) {
    if (!Number.isFinite(kwp)) return "kwp-ungueltig";
    if (kwp < KWP_MIN) return "kwp-zu-klein";
    if (kwp > KWP_MAX) return "grossanlage";
    if (!Number.isFinite(kwh)) return "ueberschuss-ungueltig";
    if (kwh < UEBERSCHUSS_MIN) return "ueberschuss-zu-klein";
    if (kwh > UEBERSCHUSS_MAX) return "ueberschuss-zu-gross";
    return "ok";
  }

  function wunschpreisAusWert(roh) {
    const wert = Number(roh);
    if (roh === null || roh === "" || !Number.isFinite(wert)) return null;
    if (wert < WUNSCHPREIS_MIN || wert > WUNSCHPREIS_MAX || !Number.isInteger(wert * 2)) return null;
    return wert;
  }

  // Gleiche Spannen wie rgr_filtere_erzeuger_antwort() in logik.php.
  function pruefeErzeugerKosten(daten) {
    if (!daten || typeof daten !== "object") return null;
    if (daten.individuell === true) return { individuell: true };
    if (daten.individuell !== false) return null;
    const { grund_monat, vermarktung_ct, einrichtung } = daten;
    // Untergrenzen über 0: Ein fehlender Posten des Partners darf nicht als „kostet nichts“ erscheinen.
    if (!zahlIn(grund_monat, 1, 2000) || !zahlIn(vermarktung_ct, 0.01, 5) || !zahlIn(einrichtung, 1, 10000)) return null;
    return { individuell: false, grundMonat: grund_monat, vermarktungCt: vermarktung_ct, einrichtung };
  }

  // Anschlussvergütung nur für ausgeförderte Solaranlagen bis 100 kW (§§ 21, 23b EEG); sonst kein Vergleich.
  function anschlussVergleich(kwh, anlage) {
    if (!anlage || anlage.art !== "pv" || anlage.foerderung !== false) return null;
    if (!Number.isFinite(anlage.kwp) || anlage.kwp > ANSCHLUSS_BIS_KWP) return null;
    return (kwh * ANSCHLUSS_CT) / 100;
  }

  function berechneErzeuger(kwh, wunschCt, kosten, anlage) {
    if (!kosten || kosten.individuell !== false || !Number.isFinite(kwh) || !Number.isFinite(wunschCt)) return null;
    const erloes = (kwh * wunschCt) / 100;
    const grundJahr = kosten.grundMonat * 12;
    const vermarktung = (kwh * kosten.vermarktungCt) / 100;
    return {
      erloes,
      grundJahr,
      vermarktung,
      bleibt: erloes - grundJahr - vermarktung,
      anschluss: anschlussVergleich(kwh, anlage),
      einrichtung: kosten.einrichtung,
    };
  }

  const brauchtFernwirktechnik = (kwp) => kwp >= FERNWIRK_AB_KW;

  const zahlIn = (wert, min, max) =>
    typeof wert === "number" && Number.isFinite(wert) && wert >= min && wert <= max;

  // Nimmt nur eine vollständige, plausible Antwort zum angefragten Verbrauch an.
  function pruefePreise(daten, kwh) {
    if (!daten || typeof daten !== "object") return null;
    if (daten.requires_district_selection !== undefined && daten.requires_district_selection !== false) return null;
    if (daten.requires_city_selection !== undefined && daten.requires_city_selection !== false) return null;
    const { energy_price, transaction_fee, base_price, monthly_base_price, annual_total } = daten;
    if (daten.annual_consumption_kwh !== kwh) return null;
    if (!zahlIn(energy_price, 15, 80) || !zahlIn(transaction_fee, 0, 10)) return null;
    if (!zahlIn(base_price, 0, 5000) || !zahlIn(monthly_base_price, 0, 400)) return null;
    if (Math.abs(monthly_base_price - base_price / 12) > GRUNDPREIS_MONAT_TOLERANZ) return null;
    if (!zahlIn(annual_total, 1, 1e8)) return null;
    const erwartet = ((energy_price + transaction_fee) / 100) * kwh + base_price;
    const toleranz = Math.max(SUMME_TOLERANZ_MIN, erwartet * SUMME_TOLERANZ_ANTEIL);
    if (Math.abs(annual_total - erwartet) > toleranz) return null;
    return {
      arbeitspreisCt: energy_price,
      gebuehrCt: transaction_fee,
      grundMonat: monthly_base_price,
      jahr: annual_total,
      kwh,
      netzCt: netzkosten(daten.minimum_energy_price_gross, energy_price),
      stadt: typeof daten.city === "string" ? daten.city.trim().slice(0, STADT_MAX) : "",
    };
  }

  // Netzkosten & Umlagen sind die Untergrenze des Community-Preises; ohne sie keine Preisbildung.
  const netzkosten = (wert, reststromCt) =>
    zahlIn(wert, NETZKOSTEN_CT[0], NETZKOSTEN_CT[1]) && wert < reststromCt ? wert : null;

  const begrenzt = (wert, min, max) => Math.min(Math.max(wert, min), max);

  function communityStart(netzCt, reststromCt) {
    return begrenzt((netzCt / MWST_FAKTOR + COMMUNITY_ENERGIE_NETTO_CT) * MWST_FAKTOR, netzCt, reststromCt);
  }

  // Reglerwerte kommen aus der Seite und gelten als unsicher: nur Zahlen, auf die Spanne begrenzt.
  function preisbildung(preise, anteilRoh, communityRoh) {
    if (!preise || preise.netzCt === null || preise.netzCt === undefined) return null;
    const netz = preise.netzCt;
    const rest = preise.arbeitspreisCt;
    const anteilZahl = Number(anteilRoh);
    const anteil = Number.isFinite(anteilZahl) && anteilRoh !== null && anteilRoh !== ""
      ? Math.round(begrenzt(anteilZahl, 0, 100)) : ANTEIL_VORBELEGUNG;
    const communityZahl = Number(communityRoh);
    const communityCt = Number.isFinite(communityZahl) && communityRoh !== null && communityRoh !== ""
      ? begrenzt(communityZahl, netz, rest) : communityStart(netz, rest);
    return {
      anteil,
      communityCt,
      energieCt: communityCt - netz,
      netzCt: netz,
      mischCt: (anteil / 100) * communityCt + (1 - anteil / 100) * rest,
    };
  }

  // Der Lesekopf gehört zu den Kosten, die heute nicht anfallen; darum zählt er im Vergleich mit.
  // In ganzen Cent rechnen: toLocaleString rundet sonst z. B. 41,714999… (= 500,58 / 12) ab.
  // toFixed(6) glättet Gleitkomma-Reste wie 1,005 × 100 = 100,4999…, damit halbe Cent aufrunden.
  const inCent = (euroBetrag) => Math.round(Number((euroBetrag * 100).toFixed(6)));

  function vergleiche(jahr, abschlagMonat) {
    if (!(abschlagMonat > 0)) return null;
    const differenz = (inCent(abschlagMonat) * 12 - (inCent(jahr) + 12 * inCent(LESEKOPF_MIETE_MONAT))) / 100;
    if (Math.abs(differenz) < ETWA_GLEICH_JAHR) return { art: "gleich", jahr: differenz };
    return { art: differenz > 0 ? "ersparnis" : "mehrkosten", jahr: differenz };
  }

  // Mit Preisbildung: Der Partner-Jahresbetrag gilt für 0 % Community-Anteil; der günstigere Mischpreis
  // senkt nur den Energieanteil. Grundpreis und Plattformgebühr bleiben wie beim Partner.
  function berechne(preise, abschlagMonat, bildung = null) {
    if (!preise) return { status: "preise-fehlen" };
    const jahr = bildung ? preise.jahr - (preise.kwh * (preise.arbeitspreisCt - bildung.mischCt)) / 100 : preise.jahr;
    return {
      status: "ok",
      jahr: inCent(jahr) / 100,
      monat: Math.round(inCent(jahr) / 12) / 100,
      vergleich: vergleiche(jahr, abschlagMonat),
    };
  }

  // Pfeiltasten im Straßen-Dropdown; -1 heißt: Fokus steht im Eingabefeld.
  function naechsterVorschlag(aktuell, anzahl, taste) {
    if (anzahl <= 0) return -1;
    const gueltig = aktuell >= 0 && aktuell < anzahl ? aktuell : -1;
    if (taste === "ArrowDown") return (gueltig + 1) % anzahl;
    if (taste === "ArrowUp") return gueltig <= 0 ? anzahl - 1 : gueltig - 1;
    return aktuell;
  }

  const zahl = (wert, stellen) =>
    wert.toLocaleString("de-DE", { minimumFractionDigits: stellen, maximumFractionDigits: stellen });
  const euro = (wert, stellen = 0) => `${zahl(wert, stellen)} €`;
  const cent = (wert) => `${zahl(wert, 2)} ct`;

  const api = {
    VERBRAUCH_MIN, VERBRAUCH_MAX, LESEKOPF_MIETE_MONAT, LESEKOPF_KAUF,
    ROLLEN, ANLAGENARTEN, KWP_MAX, WUNSCHPREIS_MIN, WUNSCHPREIS_MAX, WUNSCHPREIS_VORBELEGUNG,
    kwhAusEingabe, betragAusEingabe, pruefeVerbrauch, pruefePreise, berechne, naechsterVorschlag, euro, cent,
    rolleAusWert, kwpAusEingabe, pruefeAnlage, wunschpreisAusWert, pruefeErzeugerKosten, berechneErzeuger,
    brauchtFernwirktechnik, ANTEIL_VORBELEGUNG, communityStart, preisbildung,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else wurzel.RGRechnung = Object.freeze(api);
})(typeof window !== "undefined" ? window : globalThis);
