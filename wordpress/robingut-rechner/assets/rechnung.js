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

  function pruefeVerbrauch(kwh) {
    if (!Number.isFinite(kwh)) return "verbrauch-ungueltig";
    if (kwh < VERBRAUCH_MIN) return "zu-klein";
    if (kwh > VERBRAUCH_MAX) return "grossverbrauch";
    return "ok";
  }

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
      stadt: typeof daten.city === "string" ? daten.city.trim().slice(0, STADT_MAX) : "",
    };
  }

  // Der Lesekopf gehört zu den Kosten, die heute nicht anfallen; darum zählt er im Vergleich mit.
  function vergleiche(jahr, abschlagMonat) {
    if (!(abschlagMonat > 0)) return null;
    const differenz = abschlagMonat * 12 - (jahr + 12 * LESEKOPF_MIETE_MONAT);
    if (Math.abs(differenz) < ETWA_GLEICH_JAHR) return { art: "gleich", jahr: differenz };
    return { art: differenz > 0 ? "ersparnis" : "mehrkosten", jahr: differenz };
  }

  function berechne(preise, abschlagMonat) {
    if (!preise) return { status: "preise-fehlen" };
    return {
      status: "ok",
      jahr: preise.jahr,
      monat: preise.jahr / 12,
      vergleich: vergleiche(preise.jahr, abschlagMonat),
    };
  }

  const zahl = (wert, stellen) =>
    wert.toLocaleString("de-DE", { minimumFractionDigits: stellen, maximumFractionDigits: stellen });
  const euro = (wert, stellen = 0) => `${zahl(wert, stellen)} €`;
  const cent = (wert) => `${zahl(wert, 2)} ct`;

  const api = {
    VERBRAUCH_MIN, VERBRAUCH_MAX, LESEKOPF_MIETE_MONAT, LESEKOPF_KAUF,
    kwhAusEingabe, betragAusEingabe, pruefeVerbrauch, pruefePreise, berechne, euro, cent,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else wurzel.RGRechnung = Object.freeze(api);
})(typeof window !== "undefined" ? window : globalThis);
