#!/usr/bin/env bash
# Baut das ZIP für den Plugin-Upload in WordPress aus einer festen Dateiliste (ohne Tests).
# Bei jeder Änderung an PHP oder Assets die Version im Plugin-Kopf und in RGR_VERSION erhöhen,
# sonst behalten Browser mit langem Cache die alten Dateien.
#
#   bash werkzeuge/rechner-plugin-zip.sh
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
HAUPT="$REPO/wordpress/robingut-rechner/robingut-rechner.php"
KOPF_VERSION="$(sed -nE 's/^ \* Version: ([0-9.]+)$/\1/p' "$HAUPT")"
KONST_VERSION="$(sed -nE "s/^const RGR_VERSION = '([0-9.]+)';$/\1/p" "$HAUPT")"
if [ -z "$KOPF_VERSION" ] || [ "$KOPF_VERSION" != "$KONST_VERSION" ]; then
  echo "FEHLER: Version im Kopf ($KOPF_VERSION) und RGR_VERSION ($KONST_VERSION) passen nicht" >&2
  exit 1
fi

DATEIEN=(
  robingut-rechner/robingut-rechner.php
  robingut-rechner/includes/logik.php
  robingut-rechner/includes/rest.php
  robingut-rechner/includes/shortcode.php
  robingut-rechner/assets/rechnung.js
  robingut-rechner/assets/rechner.js
  robingut-rechner/assets/rechner.css
)
ZIEL="$REPO/werkzeuge/ausgabe/robingut-rechner-$KOPF_VERSION.zip"
mkdir -p "$REPO/werkzeuge/ausgabe"
rm -f "$ZIEL"
cd "$REPO/wordpress"
zip -q "$ZIEL" "${DATEIEN[@]}"

echo "$ZIEL"
unzip -Z1 "$ZIEL" | sed 's/^/  /'
if [ "$(unzip -Z1 "$ZIEL" | wc -l | tr -d ' ')" != "${#DATEIEN[@]}" ]; then
  echo "FEHLER: ZIP enthält nicht genau die erlaubten Dateien" >&2
  exit 1
fi
