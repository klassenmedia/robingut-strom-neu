<?php
// Shortcode [robingut_rechner]: Formular und Ergebnisfläche; gerechnet wird im Browser.

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

const RGR_ANMELDE_URL = 'https://weshareenergy.de/stromcommunitys/neukunde/robin-gut-strom';
const RGR_PERSONEN = [2 => 2500, 3 => 3500, 4 => 4000];   // Stromspiegel 2025, siehe SCHLANK.md §14
const RGR_VORBELEGUNG_KWH = 2500;

add_shortcode('robingut_rechner', 'rgr_shortcode');

function rgr_lade_dateien(): void
{
    $basis = plugin_dir_url(RGR_DATEI) . 'assets/';
    wp_enqueue_style('robingut-rechner', $basis . 'rechner.css', [], RGR_VERSION);
    wp_enqueue_script('robingut-rechnung', $basis . 'rechnung.js', [], RGR_VERSION, ['in_footer' => true]);
    wp_enqueue_script('robingut-rechner', $basis . 'rechner.js', ['robingut-rechnung'], RGR_VERSION, ['in_footer' => true]);
}

function rgr_shortcode(): string
{
    rgr_lade_dateien();
    $id = wp_unique_id('rgr-');
    ob_start();
    ?>
<div class="rgr" data-rest="<?php echo esc_attr(wp_make_link_relative(rest_url('robingut-rechner/v1/'))); ?>">
  <form class="rgr-form" novalidate>
    <div class="rgr-felder">
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
      <button type="submit" class="rgr-knopf rgr-knopf-haupt">Preis berechnen</button>
    </div>
    <div class="rgr-ort rgr-zusatz" hidden>
      <p class="rgr-hinweis">Zu dieser Postleitzahl gehören mehrere Orte. Bitte wähle deinen.</p>
      <div class="rgr-feld">
        <label for="<?php echo esc_attr($id); ?>-ort">Ort</label>
        <select id="<?php echo esc_attr($id); ?>-ort" name="ort">
          <option value="">Bitte wählen</option>
        </select>
      </div>
    </div>
    <div class="rgr-adresse rgr-zusatz" hidden>
      <p class="rgr-hinweis">Für diese Postleitzahl gibt es mehrere Netzgebiete. Mit deiner Straße finden wir das richtige. Straße und Hausnummer geben wir nur für die Preisabfrage an unseren Partner weiter.</p>
      <div class="rgr-felder">
        <div class="rgr-feld rgr-feld-breit">
          <label for="<?php echo esc_attr($id); ?>-strasse">Straße</label>
          <input id="<?php echo esc_attr($id); ?>-strasse" name="strasse" type="text" maxlength="100" autocomplete="address-line1" list="<?php echo esc_attr($id); ?>-strassen">
          <datalist id="<?php echo esc_attr($id); ?>-strassen"></datalist>
        </div>
        <div class="rgr-feld">
          <label for="<?php echo esc_attr($id); ?>-hausnummer">Hausnummer</label>
          <input id="<?php echo esc_attr($id); ?>-hausnummer" name="hausnummer" type="text" maxlength="20">
        </div>
      </div>
    </div>
    <details class="rgr-heute">
      <summary>Was zahlst du heute? Dann zeigen wir dir deine Ersparnis.</summary>
      <div class="rgr-feld">
        <label for="<?php echo esc_attr($id); ?>-abschlag">Dein Abschlag im Monat (€)</label>
        <input id="<?php echo esc_attr($id); ?>-abschlag" name="abschlag" type="text" inputmode="decimal" maxlength="7" placeholder="z. B. 95">
      </div>
    </details>
  </form>
  <p class="rgr-status" role="status" aria-live="polite"></p>
  <div class="rgr-ergebnis" hidden>
    <p class="rgr-label">So viel zahlst du im Monat</p>
    <p class="rgr-betrag">ca. <strong data-feld="monat"></strong></p>
    <p class="rgr-jahr">Im Jahr <span data-feld="jahr"></span><span data-feld="ort"></span></p>
    <div class="rgr-vergleich" hidden>
      <strong data-feld="vergleich-titel"></strong>
      <span data-feld="vergleich-text"></span>
    </div>
    <dl class="rgr-details">
      <div><dt>Arbeitspreis</dt><dd data-feld="arbeitspreis"></dd></div>
      <div><dt>Plattformgebühr</dt><dd data-feld="gebuehr"></dd></div>
      <div><dt>Grundpreis im Monat</dt><dd data-feld="grundpreis"></dd></div>
    </dl>
    <p class="rgr-klein">Preise unseres Partners für ROBIN GUT Strom, inklusive Umsatzsteuer. Dazu kommt der Lesekopf: <span data-feld="lesekopf"></span>. Unverbindliche Berechnung, verbindlich ist der Preis bei der Anmeldung.</p>
    <p><a class="rgr-knopf rgr-knopf-haupt" href="<?php echo esc_url(RGR_ANMELDE_URL); ?>" rel="noopener noreferrer">Jetzt wechseln <span aria-hidden="true">↗</span></a></p>
    <p class="rgr-klein">Preis und Anmeldung findest du auf der Seite unseres Partners.</p>
  </div>
  <noscript><p class="rgr-status">Der Rechner braucht JavaScript. Deinen Preis zeigt dir auch <a href="<?php echo esc_url(RGR_ANMELDE_URL); ?>" rel="noopener noreferrer">unser Partner</a>.</p></noscript>
</div>
    <?php
    return (string) ob_get_clean();
}
