<?php
// Shortcode [robingut_rechner rolle="beziehen|einspeisen|zubehoer" anrede="du|sie"]:
// Klickstrecke Rolle → Daten → Ergebnis; gerechnet wird im Browser.

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

const RGR_ANMELDE_URL = 'https://weshareenergy.de/stromcommunitys/neukunde/robin-gut-strom';
// Eingebettete Strecke des Partners wie auf der alten Seite; der Knopf lädt sie erst beim Klick.
const RGR_WSE_STRECKE = RGR_ANMELDE_URL . '?iframe=1&buttonColor=0e670e&borderRadius=9999px&fontFamily=NotoSans';
// Zubehör-Reiter des Partners (geprüft 09.11.2026): beide Leseköpfe zum gleichen Preis.
const RGR_LESEKOEPFE = ['IOmeter-Lesekopf', 'WSE-Lesekopf'];
const RGR_LESEKOPF_KAUF = '89,00 €';
const RGR_LESEKOPF_MIETE = '3,90 € im Monat';
const RGR_PERSONEN = [2 => 2500, 3 => 3500, 4 => 4000];   // Stromspiegel 2025, siehe SCHLANK.md §14
const RGR_VORBELEGUNG_KWH = 2500;
const RGR_ROLLEN = [
    'beziehen' => ['Strom beziehen', 'Ich bin Verbraucher'],
    'einspeisen' => ['Strom einspeisen', 'Ich habe eine Anlage'],
    'zubehoer' => ['Zubehör', 'Lesekopf kaufen oder mieten'],
];
const RGR_ANMELDE_TEXT = ['beziehen' => 'Jetzt Community beitreten', 'einspeisen' => 'Als Erzeuger anmelden', 'zubehoer' => 'Jetzt Community beitreten'];
const RGR_ANLAGEN_NAMEN = ['pv' => 'Photovoltaik', 'wind' => 'Wind', 'wasser' => 'Wasserkraft', 'biogas' => 'Biogas'];
const RGR_TEXTE = [
    'du' => [
        'schritt1' => 'Was möchtest du?', 'schritt2' => 'Deine Daten', 'schritt3' => 'Dein Ergebnis',
        'leer' => 'Gib deine Daten ein, dann siehst du hier dein Ergebnis.',
        'ort' => 'Zu dieser Postleitzahl gehören mehrere Orte. Bitte wähle deinen.',
        'adresse' => 'Für diese Postleitzahl gibt es mehrere Netzgebiete. Mit deiner Straße finden wir das richtige. Straße und Hausnummer gehen nur für die Preisabfrage an den Stromlieferanten.',
        'heute' => 'Was zahlst du heute? Dann zeigen wir dir deine Ersparnis.',
        'abschlag' => 'Dein Abschlag im Monat (€)',
        'abschlag_hinweis' => 'Steht auf deinem Kontoauszug oder deiner letzten Stromrechnung.',
        'monat' => 'So viel zahlst du im Monat',
        'bleibt' => 'Bleibt für dich',
        'wunsch' => 'Dein Wunschpreis',
        'eigene' => 'Fernwirktechnik ab 25 kW stellst du selbst.',
        'anteil' => 'Community-Anteil deines Verbrauchs',
        'anteil_hinweis' => 'So viel deines Stroms kommt zeitgleich aus der Community, den Rest liefert Reststrom (Ökostrom).',
        'mischpreis' => 'Dein voraussichtlicher Strompreis',
        'zubehoer' => 'Für Energy Sharing brauchst du einen Lesekopf an deinem digitalen Stromzähler. Du wählst ihn bei der Anmeldung aus.',
        'wse' => 'Die Anmeldung läuft bei unserem Partner WeShareEnergy. Gib dort deine Postleitzahl und deinen Verbrauch bitte noch einmal ein.',
        'wse_erzeuger' => 'Die Anmeldung läuft bei unserem Partner WeShareEnergy. Wechsle dort oben auf „Für Einspeiser“, dann geht es zur Anmeldung als Erzeuger.',
        'geschaetzt' => 'im Monat, geschätzt',
    ],
    'sie' => [
        'schritt1' => 'Was möchten Sie?', 'schritt2' => 'Ihre Daten', 'schritt3' => 'Ihr Ergebnis',
        'leer' => 'Geben Sie Ihre Daten ein, dann sehen Sie hier Ihr Ergebnis.',
        'ort' => 'Zu dieser Postleitzahl gehören mehrere Orte. Bitte wählen Sie Ihren.',
        'adresse' => 'Für diese Postleitzahl gibt es mehrere Netzgebiete. Mit Ihrer Straße finden wir das richtige. Straße und Hausnummer gehen nur für die Preisabfrage an den Stromlieferanten.',
        'heute' => 'Was zahlen Sie heute? Dann zeigen wir Ihnen Ihre Ersparnis.',
        'abschlag' => 'Ihr Abschlag im Monat (€)',
        'abschlag_hinweis' => 'Steht auf Ihrem Kontoauszug oder Ihrer letzten Stromrechnung.',
        'monat' => 'So viel zahlen Sie im Monat',
        'bleibt' => 'Bleibt für Sie',
        'wunsch' => 'Ihr Wunschpreis',
        'eigene' => 'Fernwirktechnik ab 25 kW stellen Sie selbst.',
        'anteil' => 'Community-Anteil Ihres Verbrauchs',
        'anteil_hinweis' => 'So viel Ihres Stroms kommt zeitgleich aus der Community, den Rest liefert Reststrom (Ökostrom).',
        'mischpreis' => 'Ihr voraussichtlicher Strompreis',
        'zubehoer' => 'Für Energy Sharing brauchen Sie einen Lesekopf an Ihrem digitalen Stromzähler. Sie wählen ihn bei der Anmeldung aus.',
        'wse' => 'Die Anmeldung läuft bei unserem Partner WeShareEnergy. Bitte geben Sie dort Postleitzahl und Verbrauch noch einmal ein.',
        'wse_erzeuger' => 'Die Anmeldung läuft bei unserem Partner WeShareEnergy. Bitte wechseln Sie dort oben auf „Für Einspeiser“, dann geht es zur Anmeldung als Erzeuger.',
        'geschaetzt' => 'im Monat, geschätzt',
    ],
];

add_shortcode('robingut_rechner', 'rgr_shortcode');

function rgr_lade_dateien(): void
{
    $basis = plugin_dir_url(RGR_DATEI) . 'assets/';
    wp_enqueue_style('robingut-rechner', $basis . 'rechner.css', [], RGR_VERSION);
    wp_enqueue_script('robingut-rechnung', $basis . 'rechnung.js', [], RGR_VERSION, ['in_footer' => true]);
    wp_enqueue_script('robingut-rechner', $basis . 'rechner.js', ['robingut-rechnung'], RGR_VERSION, ['in_footer' => true]);
}

// Nur Werte aus den Listen; alles andere fällt auf die Vorgabe zurück.
function rgr_shortcode_werte($atts): array
{
    $roh = shortcode_atts(['rolle' => 'beziehen', 'anrede' => 'du'], is_array($atts) ? $atts : [], 'robingut_rechner');
    $rolle = is_string($roh['rolle']) && array_key_exists($roh['rolle'], RGR_ROLLEN) ? $roh['rolle'] : 'beziehen';
    $anrede = $roh['anrede'] === 'sie' ? 'sie' : 'du';
    return [$rolle, $anrede];
}

function rgr_shortcode($atts = []): string
{
    rgr_lade_dateien();
    [$rolle, $anrede] = rgr_shortcode_werte($atts);
    $t = RGR_TEXTE[$anrede];
    $id = wp_unique_id('rgr-');
    $mit_bezug = $rolle === 'beziehen';
    $mit_erzeugung = $rolle === 'einspeisen';
    $mit_zubehoer = $rolle === 'zubehoer';
    ob_start();
    ?>
<div class="rgr" data-rest="<?php echo esc_attr(wp_make_link_relative(rest_url('robingut-rechner/v1/'))); ?>" data-anrede="<?php echo esc_attr($anrede); ?>">
  <form class="rgr-form" novalidate>
    <div class="rgr-schritte">
      <fieldset class="rgr-schritt rgr-schritt-1">
        <legend class="rgr-schritt-titel"><span class="rgr-nr" aria-hidden="true">1</span> <?php echo esc_html($t['schritt1']); ?></legend>
        <?php foreach (RGR_ROLLEN as $wert => [$titel, $unter]) : ?>
          <label class="rgr-rolle">
            <input type="radio" name="rolle" value="<?php echo esc_attr($wert); ?>"<?php echo $wert === $rolle ? ' checked' : ''; ?>>
            <span class="rgr-rolle-text"><strong><?php echo esc_html($titel); ?></strong><span><?php echo esc_html($unter); ?></span></span>
          </label>
        <?php endforeach; ?>
      </fieldset>

      <div class="rgr-schritt rgr-schritt-2">
        <p class="rgr-schritt-titel"><span class="rgr-nr" aria-hidden="true">2</span> <?php echo esc_html($t['schritt2']); ?></p>
        <div class="rgr-teil rgr-teil-bezug"<?php echo $mit_bezug ? '' : ' hidden'; ?>>
          <div class="rgr-feld">
            <label for="<?php echo esc_attr($id); ?>-plz">Postleitzahl</label>
            <input id="<?php echo esc_attr($id); ?>-plz" name="plz" type="text" inputmode="numeric" maxlength="5" autocomplete="postal-code" placeholder="z. B. 41747" required>
          </div>
          <div class="rgr-feld">
            <label for="<?php echo esc_attr($id); ?>-kwh">Verbrauch im Jahr (kWh)</label>
            <input id="<?php echo esc_attr($id); ?>-kwh" name="kwh" type="text" inputmode="numeric" maxlength="7" value="<?php echo esc_attr((string) RGR_VORBELEGUNG_KWH); ?>" required>
            <div class="rgr-personen" role="group" aria-label="Typischer Verbrauch">
              <?php foreach (RGR_PERSONEN as $personen => $kwh) : ?>
                <button type="button" class="rgr-person" data-kwh="<?php echo esc_attr((string) $kwh); ?>" aria-pressed="<?php echo $kwh === RGR_VORBELEGUNG_KWH ? 'true' : 'false'; ?>"><?php echo esc_html($personen . ' Personen'); ?></button>
              <?php endforeach; ?>
            </div>
          </div>
          <div class="rgr-ort rgr-zusatz" hidden>
            <p class="rgr-hinweis"><?php echo esc_html($t['ort']); ?></p>
            <div class="rgr-feld">
              <label for="<?php echo esc_attr($id); ?>-ort">Ort</label>
              <select id="<?php echo esc_attr($id); ?>-ort" name="ort">
                <option value="">Bitte wählen</option>
              </select>
            </div>
          </div>
          <div class="rgr-adresse rgr-zusatz" hidden>
            <p class="rgr-hinweis"><?php echo esc_html($t['adresse']); ?></p>
            <div class="rgr-feld">
              <label for="<?php echo esc_attr($id); ?>-strasse">Straße</label>
              <div class="rgr-kombi">
                <input id="<?php echo esc_attr($id); ?>-strasse" name="strasse" type="text" maxlength="100" autocomplete="off" placeholder="Anfang tippen, z. B. Köl" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="<?php echo esc_attr($id); ?>-strassen">
                <ul id="<?php echo esc_attr($id); ?>-strassen" class="rgr-vorschlaege" role="listbox" aria-label="Vorschläge für die Straße" hidden></ul>
                <p class="rgr-ansage" aria-live="polite"></p>
              </div>
            </div>
            <div class="rgr-feld">
              <label for="<?php echo esc_attr($id); ?>-hausnummer">Hausnummer</label>
              <input id="<?php echo esc_attr($id); ?>-hausnummer" name="hausnummer" type="text" maxlength="20">
            </div>
          </div>
          <details class="rgr-heute">
            <summary><?php echo esc_html($t['heute']); ?></summary>
            <div class="rgr-feld">
              <label for="<?php echo esc_attr($id); ?>-abschlag"><?php echo esc_html($t['abschlag']); ?></label>
              <input id="<?php echo esc_attr($id); ?>-abschlag" name="abschlag" type="text" inputmode="decimal" maxlength="7" placeholder="z. B. 95" aria-describedby="<?php echo esc_attr($id); ?>-abschlag-hinweis">
              <p id="<?php echo esc_attr($id); ?>-abschlag-hinweis" class="rgr-klein rgr-feldhinweis"><?php echo esc_html($t['abschlag_hinweis']); ?></p>
            </div>
          </details>
        </div>

        <div class="rgr-teil rgr-teil-erzeugung"<?php echo $mit_erzeugung ? '' : ' hidden'; ?>>
          <div class="rgr-feld">
            <label for="<?php echo esc_attr($id); ?>-art">Art der Anlage</label>
            <select id="<?php echo esc_attr($id); ?>-art" name="art">
              <?php foreach (RGR_ANLAGEN_NAMEN as $wert => $name) : ?>
                <option value="<?php echo esc_attr($wert); ?>"><?php echo esc_html($name); ?></option>
              <?php endforeach; ?>
            </select>
          </div>
          <div class="rgr-feld">
            <label for="<?php echo esc_attr($id); ?>-kwp">Leistung (kWp)</label>
            <input id="<?php echo esc_attr($id); ?>-kwp" name="kwp" type="text" inputmode="decimal" maxlength="7" placeholder="z. B. 100">
          </div>
          <div class="rgr-feld">
            <label for="<?php echo esc_attr($id); ?>-ueberschuss">Überschuss im Jahr (kWh)</label>
            <input id="<?php echo esc_attr($id); ?>-ueberschuss" name="ueberschuss" type="text" inputmode="numeric" maxlength="10" placeholder="z. B. 66.500">
          </div>
          <fieldset class="rgr-feld rgr-wahl">
            <legend>Einspeisung</legend>
            <label><input type="radio" name="einspeisung" value="teil" checked> Überschuss (Teileinspeisung)</label>
            <label><input type="radio" name="einspeisung" value="voll"> Alles (Volleinspeisung)</label>
          </fieldset>
          <fieldset class="rgr-feld rgr-wahl">
            <legend>Noch EEG-Förderung?</legend>
            <label><input type="radio" name="foerderung" value="nein" checked> Nein</label>
            <label><input type="radio" name="foerderung" value="ja"> Ja</label>
          </fieldset>
          <div class="rgr-feld">
            <label for="<?php echo esc_attr($id); ?>-wunschpreis"><?php echo esc_html($t['wunsch']); ?>: <strong class="rgr-wunschpreis-wert">10,0 ct/kWh</strong></label>
            <input id="<?php echo esc_attr($id); ?>-wunschpreis" name="wunschpreis" type="range" min="7" max="11" step="0.5" value="10">
            <p class="rgr-klein rgr-feldhinweis">Empfehlung 7–11 ct je kWh, frei vereinbar.</p>
          </div>
        </div>
        <div class="rgr-teil rgr-zubehoer"<?php echo $mit_zubehoer ? '' : ' hidden'; ?>>
          <p class="rgr-hinweis"><?php echo esc_html($t['zubehoer']); ?></p>
          <table class="rgr-zubehoer-liste">
            <thead><tr><th scope="col">Lesekopf</th><th scope="col">Kauf</th><th scope="col">Miete</th></tr></thead>
            <tbody>
              <?php foreach (RGR_LESEKOEPFE as $lesekopf) : ?>
                <tr><th scope="row"><?php echo esc_html($lesekopf); ?></th><td><?php echo esc_html(RGR_LESEKOPF_KAUF); ?> einmalig</td><td><?php echo esc_html(RGR_LESEKOPF_MIETE); ?></td></tr>
              <?php endforeach; ?>
            </tbody>
          </table>
        </div>
        <button type="submit" class="rgr-knopf rgr-knopf-haupt rgr-weiter"<?php echo $mit_zubehoer ? ' hidden' : ''; ?>>Weiter</button>
      </div>

      <div class="rgr-schritt rgr-schritt-3">
        <p class="rgr-schritt-titel"><span class="rgr-nr" aria-hidden="true">3</span> <?php echo esc_html($t['schritt3']); ?></p>
        <p class="rgr-status rgr-status-bezug" role="status" aria-live="polite"></p>
        <p class="rgr-status rgr-status-erzeugung" role="status" aria-live="polite"></p>
        <p class="rgr-leer rgr-klein"<?php echo $mit_zubehoer ? ' hidden' : ''; ?>><?php echo esc_html($t['leer']); ?></p>
        <div class="rgr-ergebnis" hidden>
          <p class="rgr-label"><?php echo esc_html($t['monat']); ?></p>
          <p class="rgr-betrag"><strong data-feld="monat"></strong> <span class="rgr-zzgl">zzgl. Lesekopf</span></p>
          <p class="rgr-geschaetzt" hidden>Mit <span data-feld="anteil-kurz"></span> Community-Anteil voraussichtlich <strong data-feld="monat-community"></strong> <?php echo esc_html($t['geschaetzt']); ?></p>
          <p class="rgr-jahr">Im Jahr <span data-feld="jahr"></span><span data-feld="ort"></span></p>
          <div class="rgr-vergleich" hidden>
            <strong data-feld="vergleich-titel"></strong>
            <span data-feld="vergleich-text"></span>
          </div>
          <div class="rgr-preisbildung" hidden>
            <div class="rgr-regel">
              <label for="<?php echo esc_attr($id); ?>-community">Strompreis Community <strong data-feld="community"></strong></label>
              <p class="rgr-klein" data-feld="community-teile"></p>
              <input id="<?php echo esc_attr($id); ?>-community" name="community" type="range" step="0.01">
              <p class="rgr-skala rgr-klein" aria-hidden="true"><span data-feld="community-min"></span><span data-feld="community-max"></span></p>
            </div>
            <div class="rgr-regel">
              <label for="<?php echo esc_attr($id); ?>-anteil"><?php echo esc_html($t['anteil']); ?> <strong data-feld="anteil"></strong></label>
              <input id="<?php echo esc_attr($id); ?>-anteil" name="anteil" type="range" min="0" max="100" step="1" value="50" aria-describedby="<?php echo esc_attr($id); ?>-anteil-hinweis">
              <p id="<?php echo esc_attr($id); ?>-anteil-hinweis" class="rgr-klein"><?php echo esc_html($t['anteil_hinweis']); ?></p>
            </div>
            <p class="rgr-mischpreis"><span><?php echo esc_html($t['mischpreis']); ?> <span class="rgr-zzgl">zzgl. Plattformgebühr</span></span> <strong data-feld="mischpreis"></strong></p>
          </div>
          <dl class="rgr-details">
            <div><dt>Grundpreis im Monat</dt><dd data-feld="grundpreis"></dd></div>
            <div><dt>Reststrom</dt><dd data-feld="reststrom"></dd></div>
            <div><dt>Plattformgebühr</dt><dd data-feld="gebuehr"></dd></div>
          </dl>
          <p class="rgr-klein">Preise für ROBIN GUT Strom inklusive Umsatzsteuer. Community-Anteil und Community-Preis sind Schätzwerte wie im Rechner unseres Partners WeShareEnergy. Dazu kommt der Lesekopf: <span data-feld="lesekopf"></span>. Unverbindliche Berechnung, verbindlich ist der Preis bei der Anmeldung.</p>
        </div>
        <div class="rgr-ergebnis-erzeuger" hidden>
          <p class="rgr-label">Ergebnis im Jahr (Beispiel)</p>
          <dl class="rgr-details">
            <div><dt>Erlös <span data-feld="erloes-rechnung"></span></dt><dd data-feld="erloes"></dd></div>
            <div><dt>Grundpreis <span data-feld="grund-rechnung"></span></dt><dd data-feld="grund"></dd></div>
            <div><dt>Vermarktungsentgelt <span data-feld="vermarktung-rechnung"></span></dt><dd data-feld="vermarktung"></dd></div>
            <div class="rgr-summe"><dt><?php echo esc_html($t['bleibt']); ?></dt><dd data-feld="bleibt"></dd></div>
            <div class="rgr-anschluss"><dt>Zum Vergleich: Anschlussvergütung</dt><dd data-feld="anschluss"></dd></div>
          </dl>
          <p class="rgr-klein rgr-hinweis-foerderung" hidden>Läuft die feste Einspeisevergütung noch, bleibt sie meist bis zum Förderende die bessere Wahl.</p>
          <p class="rgr-klein">Einmalig <span data-feld="einrichtung"></span> Einrichtung.<span class="rgr-fernwirk" hidden> <?php echo esc_html($t['eigene']); ?></span> Alle Preise netto, unverbindliche Beispielrechnung, verbindlich ist der Preis bei der Anmeldung.</p>
        </div>
        <p><a class="rgr-knopf rgr-knopf-haupt rgr-anmelden" href="<?php echo esc_url(RGR_ANMELDE_URL); ?>" data-wse="<?php echo esc_attr(RGR_WSE_STRECKE); ?>" rel="noopener noreferrer"><?php echo esc_html(RGR_ANMELDE_TEXT[$rolle]); ?></a></p>
        <p class="rgr-klein rgr-anmelden-hinweis">Öffnet hier die Anmeldung unseres Partners WeShareEnergy (weshareenergy.de).</p>
      </div>
    </div>
  </form>
  <div class="rgr-wse" hidden>
    <p class="rgr-hinweis rgr-wse-bezug"><?php echo esc_html($t['wse']); ?></p>
    <p class="rgr-hinweis rgr-wse-erzeuger" hidden><?php echo esc_html($t['wse_erzeuger']); ?></p>
    <p class="rgr-klein"><a class="rgr-wse-tab" href="<?php echo esc_url(RGR_ANMELDE_URL); ?>" target="_blank" rel="noopener noreferrer">Anmeldung lieber in einem neuen Tab öffnen</a></p>
  </div>
  <noscript><p class="rgr-status">Der Rechner braucht JavaScript. Zur Anmeldung geht es <a href="<?php echo esc_url(RGR_ANMELDE_URL); ?>" rel="noopener noreferrer">hier</a>.</p></noscript>
</div>
    <?php
    return (string) ob_get_clean();
}
