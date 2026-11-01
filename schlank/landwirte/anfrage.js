// Anfrage-Link für den Technik-Check. Ein Aktionscode aus der Adresse
// (Flyer, Messe, Brief) wandert in Betreff und Mailtext, damit sich jede
// Anfrage ihrem Kanal zuordnen lässt. Die Seite selbst speichert nichts.

export const ANFRAGE_MAIL = "info@robingut-strom.de";
const CODE_MUSTER = /^(?=.*[A-Za-z0-9])[A-Za-z0-9-]{2,24}$/;
// Nur vergebene Codes gelten, sonst ließe sich z. B. „500-EURO-BONUS“ als Code auf die Seite schreiben.
export const BEKANNTE_CODES = Object.freeze(["MESSE", "FLYER", "BRIEF", "NEWSLETTER", "PARTNER"]);
const BETREFF = "Technik-Check Hofanlage";

export function codeAusAdresse(suche) {
  const werte = new URLSearchParams(String(suche ?? "")).getAll("code");
  if (werte.length !== 1 || !CODE_MUSTER.test(werte[0])) return null;
  const code = werte[0].toUpperCase();
  return BEKANNTE_CODES.includes(code) ? code : null;
}

function mailtext(code) {
  return [
    "Guten Tag,",
    "",
    "ich interessiere mich für den Technik-Check für meine PV-Anlage.",
    "",
    "Name:",
    "Ort des Hofs:",
    "Leistung der Anlage (kWp):",
    "Inbetriebnahme (Jahr):",
    "Telefon für den Rückruf:",
    "",
    "ROBIN GUT darf meine Anfrage für die Prüfung an den Partner weitergeben.",
    "Bitte streichen Sie, was nicht zutrifft: ja / nein",
    ...(code ? ["", `Code: ${code}`] : []),
  ].join("\r\n");
}

export function anfrageLink(code) {
  const gueltig = typeof code === "string" && BEKANNTE_CODES.includes(code) ? code : null;
  const betreff = gueltig ? `${BETREFF} · Code ${gueltig}` : BETREFF;
  return `mailto:${ANFRAGE_MAIL}?subject=${encodeURIComponent(betreff)}&body=${encodeURIComponent(mailtext(gueltig))}`;
}

export function verbindeSeite(dokument, suche) {
  const code = codeAusAdresse(suche);
  if (!code) return;
  for (const link of dokument.querySelectorAll("a[data-anfrage]")) link.href = anfrageLink(code);
  const hinweis = dokument.getElementById("code-hinweis");
  if (hinweis) {
    hinweis.textContent = `Ihre Anfrage-Kennung: ${code}. Nennen Sie sie gern auch am Telefon.`;
    hinweis.hidden = false;
  }
}

if (typeof document !== "undefined") verbindeSeite(document, window.location.search);
