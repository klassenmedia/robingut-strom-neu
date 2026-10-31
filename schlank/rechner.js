// Preisrechner: Rechenlogik aus dem Potenzialrechner, reduziert auf PLZ,
// Verbrauch und heutigen Tarif. Arbeitspreis und Grundpreis wie im geprüften
// Entwurf vom September (build/09_js.html); der Vergleich mit dem heutigen
// Tarif rechnet hier aber Grundpreis und Lesekopf mit ein.
import { PREISE } from "./preise.js?v=3";

export const COMMUNITY_ANTEIL = 50;        // Prozent des Verbrauchs über Energie-Links
export const E_COMMUNITY_CT = 9.5;         // Verkaufspreis Einspeiser, Mitte der Empfehlung 7–11 ct
export const WSE_GEBUEHR_CT = 1.19;        // 1,00 ct netto plus USt auf Community-Strom
export const LESEKOPF_MIETE_MONAT = 3.9;   // Miete statt Kauf: die vorsichtigere Annahme fürs Jahr
export const REFERENZ_PLZ = "41747";       // Viersen, wenn die PLZ nicht in den Daten ist
export const GROSSVERBRAUCH_KWH = 100000;  // darüber nur individuelles Angebot
export const VERBRAUCH_MIN = 500;
export const ISTPREIS_MIN = 10;
export const ISTPREIS_MAX = 80;
// Darüber ist meist ein Jahresbetrag gemeint (Haushalte zahlen grob 8–30 € im Monat)
export const ISTGRUNDPREIS_PLAUSIBEL = 30;
const PLZ_MUSTER = /^[0-9]{5}$/;
const KWH_MUSTER = /^([1-9]\d*|[1-9]\d{0,2}(\.\d{3})+)$/;   // "3.500" ist dreitausendfünfhundert
const BETRAG_MUSTER = /^\d+([.,]\d+)?$/;
const ETWA_GLEICH_EURO = 1;

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
  const text = ohneLeerzeichen(roh);
  return BETRAG_MUSTER.test(text) ? Number(text.replace(",", ".")) : null;
}

export function grundpreisAusStaffel(staffel, verbrauchKwh) {
  let preis = staffel[0][1];
  for (const [abKwh, wert] of staffel) {
    if (verbrauchKwh >= abKwh && wert != null) preis = wert;
  }
  return preis;
}

function heutigerPreisCt(roh) {
  let wert = betragAusEingabe(roh);
  if (wert == null || wert <= 0) return null;
  let hinweis = null;
  // Häufiger Fehler: 0,35 € statt 35 ct
  if (wert < 1) {
    wert = Math.round(wert * 10000) / 100;
    hinweis = "euro";
  }
  if (wert < ISTPREIS_MIN) { wert = ISTPREIS_MIN; hinweis = "min"; }
  if (wert > ISTPREIS_MAX) { wert = ISTPREIS_MAX; hinweis = "max"; }
  return { wert, hinweis };
}

function vergleiche(istpreisRoh, istGrundpreisRoh, verbrauchKwh, gesamtJahr) {
  const istpreis = heutigerPreisCt(istpreisRoh);
  const istGrundpreisMonat = betragAusEingabe(istGrundpreisRoh);
  if (!istpreis || istGrundpreisMonat == null || istGrundpreisMonat > ISTGRUNDPREIS_PLAUSIBEL) return null;

  const heuteJahr = (istpreis.wert / 100) * verbrauchKwh + istGrundpreisMonat * 12;
  return {
    istpreisCt: istpreis.wert,
    istpreisHinweis: istpreis.hinweis,
    istGrundpreisMonat,
    heuteJahr,
    ersparnisJahr: heuteJahr - gesamtJahr,
  };
}

export function berechne(plzRoh, verbrauchRoh, istpreisRoh, istGrundpreisRoh, preise = PREISE) {
  // hasOwnProperty, damit "toString" & Co. nicht als Treffer durchgehen
  const plz = String(plzRoh ?? "").trim();
  const gueltigePlz = PLZ_MUSTER.test(plz);
  const treffer = gueltigePlz && Object.prototype.hasOwnProperty.call(preise, plz);
  const eintrag = treffer ? preise[plz] : preise[REFERENZ_PLZ];

  const ergebnis = {
    status: "ok",
    quelle: treffer ? "treffer" : gueltigePlz ? "referenz" : "leer",
    stadt: eintrag.stadt,
    verbrauchKwh: null,
    verbrauchAngehoben: false,
    preisCommunityCt: null,
    preisRestCt: null,
    arbeitspreisCt: null,
    grundpreisMonat: null,
    gesamtJahr: null,
    vergleich: null,
    grundpreisUnplausibel: betragAusEingabe(istGrundpreisRoh) > ISTGRUNDPREIS_PLAUSIBEL,
  };

  const eingegeben = kwhAusEingabe(verbrauchRoh);
  if (eingegeben == null) return { ...ergebnis, status: "verbrauch-ungueltig" };
  if (eingegeben > GROSSVERBRAUCH_KWH) return { ...ergebnis, status: "grossverbrauch" };
  const verbrauchKwh = Math.max(VERBRAUCH_MIN, eingegeben);

  const anteil = COMMUNITY_ANTEIL / 100;
  const preisCommunityCt = eintrag.fBrutto + E_COMMUNITY_CT + WSE_GEBUEHR_CT;
  const preisRestCt = eintrag.fBrutto + eintrag.eReststromBrutto;
  const arbeitspreisCt = anteil * preisCommunityCt + (1 - anteil) * preisRestCt;
  const grundpreisMonat = grundpreisAusStaffel(eintrag.grundpreisStaffel, verbrauchKwh);
  const gesamtJahr = (arbeitspreisCt / 100) * verbrauchKwh + (grundpreisMonat + LESEKOPF_MIETE_MONAT) * 12;

  return {
    ...ergebnis,
    verbrauchKwh,
    verbrauchAngehoben: eingegeben < VERBRAUCH_MIN,
    preisCommunityCt,
    preisRestCt,
    arbeitspreisCt,
    grundpreisMonat,
    gesamtJahr,
    vergleich: vergleiche(istpreisRoh, istGrundpreisRoh, verbrauchKwh, gesamtJahr),
  };
}

function zahl(wert, stellen = 2) {
  return wert.toLocaleString("de-DE", { minimumFractionDigits: stellen, maximumFractionDigits: stellen });
}

function zahlWieEingegeben(wert) {
  return wert.toLocaleString("de-DE", { maximumFractionDigits: 2 });
}

function regionText(r) {
  if (r.quelle === "treffer") return `Gerechnet mit den Netzentgelten für ${r.stadt}.`;
  if (r.quelle === "referenz") {
    return "Für diese Postleitzahl haben wir noch keine Regionaldaten. Gerechnet wird mit Viersen als Beispiel.";
  }
  return "Gib deine Postleitzahl ein. Bis dahin rechnen wir mit Viersen als Beispiel.";
}

function hinweise(r) {
  const saetze = [];
  if (r.verbrauchAngehoben) saetze.push(`Gerechnet mit ${zahl(VERBRAUCH_MIN, 0)} kWh, dem kleinsten Wert.`);
  const v = r.vergleich;
  if (!v && r.grundpreisUnplausibel) {
    saetze.push(`Mehr als ${ISTGRUNDPREIS_PLAUSIBEL} € Grundpreis im Monat? Steht auf deiner Rechnung ein Jahresbetrag, teil ihn durch 12.`);
    return saetze;
  }
  if (!v) {
    saetze.push("Für den Vergleich trag deinen heutigen Arbeitspreis und Grundpreis ein – beides steht auf deiner Stromrechnung.");
    return saetze;
  }
  if (v.istpreisHinweis === "euro") saetze.push(`Preis unter 1 als Euro gelesen: gerechnet mit ${zahlWieEingegeben(v.istpreisCt)} ct.`);
  if (v.istpreisHinweis === "min") saetze.push(`Gerechnet mit ${ISTPREIS_MIN} ct, dem kleinsten Wert.`);
  if (v.istpreisHinweis === "max") saetze.push(`Gerechnet mit ${ISTPREIS_MAX} ct, dem größten Wert.`);
  return saetze;
}

function ersparnisTexte(vergleich) {
  if (!vergleich) return { label: "Ersparnis im Jahr", wert: "–" };
  const differenz = vergleich.ersparnisJahr;
  if (Math.abs(differenz) < ETWA_GLEICH_EURO) return { label: "Unterschied im Jahr", wert: "etwa gleich" };
  if (differenz > 0) return { label: "Ersparnis im Jahr", wert: `${zahl(differenz, 0)} €` };
  return { label: "Mehrkosten im Jahr", wert: `${zahl(-differenz, 0)} €` };
}

// Alle Texte, die der Rechner auf die Seite schreibt, nach Element-ID
export function anzeige(r) {
  const strich = "–";
  if (r.status !== "ok") {
    const status = r.status === "grossverbrauch"
      ? "Über 100.000 kWh im Jahr erstellen wir dir ein individuelles Angebot – schreib uns an info@robingut-strom.de."
      : "Gib deinen Verbrauch im Jahr als ganze Zahl in kWh ein, zum Beispiel 2.500.";
    return {
      "r-preis": strich, "r-monat": strich,
      "r-ersparnis-label": "Ersparnis im Jahr", "r-ersparnis": strich,
      "r-community": strich, "r-rest": strich, "r-grundpreis": strich, "r-lesekopf": strich,
      "r-status": status,
    };
  }
  const ersparnis = ersparnisTexte(r.vergleich);
  return {
    "r-preis": `${zahl(r.arbeitspreisCt)} ct`,
    "r-monat": `${zahl(r.gesamtJahr / 12)} €`,
    "r-ersparnis-label": ersparnis.label,
    "r-ersparnis": ersparnis.wert,
    "r-community": `${zahl(r.preisCommunityCt)} ct/kWh`,
    "r-rest": `${zahl(r.preisRestCt)} ct/kWh`,
    "r-grundpreis": `${zahl(r.grundpreisMonat)} €`,
    "r-lesekopf": `${zahl(LESEKOPF_MIETE_MONAT)} €`,
    "r-status": [regionText(r), ...hinweise(r)].join(" "),
  };
}

function verbindeSeite() {
  const feld = (id) => document.getElementById(id);
  const form = feld("r-form");
  if (!form) return;

  const ausgeben = () => {
    const r = berechne(feld("r-plz").value, feld("r-verbrauch").value,
      feld("r-istpreis").value, feld("r-istgrundpreis").value);
    for (const [id, text] of Object.entries(anzeige(r))) {
      const ziel = feld(id);
      if (ziel) ziel.textContent = text;
    }
  };

  form.addEventListener("input", ausgeben);
  form.addEventListener("submit", (ereignis) => {
    ereignis.preventDefault();
    ausgeben();
  });
  ausgeben();
}

if (typeof document !== "undefined") verbindeSeite();
