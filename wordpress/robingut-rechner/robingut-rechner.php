<?php
/**
 * Plugin Name: ROBIN GUT Preisrechner
 * Description: Preisrechner von ROBIN GUT Strom als Klickstrecke (Strom beziehen, einspeisen, Zubehör; Preisbildung wie beim Partner) mit den Live-Werten des Stromlieferanten. Einbinden mit [robingut_rechner rolle="beziehen|einspeisen|zubehoer" anrede="du|sie"].
 * Version: 1.2.0
 * Requires at least: 6.4
 * Requires PHP: 8.0
 * Author: KlassenMedia
 * License: GPL-2.0-or-later
 * Text Domain: robingut-rechner
 */

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

const RGR_VERSION = '1.2.0';
const RGR_DATEI = __FILE__;

require_once __DIR__ . '/includes/logik.php';
require_once __DIR__ . '/includes/rest.php';
require_once __DIR__ . '/includes/shortcode.php';
