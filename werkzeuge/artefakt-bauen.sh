#!/usr/bin/env bash
# Baut artefakt.html (die Seite fürs Claude-Artefakt) aus index.html.
# claude.ai legt beim Veröffentlichen selbst <!doctype>, <html>, <head> und <body> herum,
# deshalb werden diese Hüllen-Tags entfernt; Inhalt, Skripte und Stile bleiben gleich.
# Aufruf im Projektordner:  bash werkzeuge/artefakt-bauen.sh
set -euo pipefail
cd "$(dirname "$0")/.."

{
  echo '<!-- Automatisch erzeugt aus index.html mit werkzeuge/artefakt-bauen.sh – nicht von Hand ändern -->'
  sed -E \
    -e '/^<!doctype html>$/Id' \
    -e '/^<html[^>]*>$/d' \
    -e '/^<\/html>$/d' \
    -e '/^<head>$/d' \
    -e '/^<\/head>$/d' \
    -e '/^<body>$/d' \
    -e '/^<\/body>$/d' \
    -e '/<meta charset=/d' \
    -e '/<meta name="viewport"/d' \
    -e 's#^(\s*)<title>(.*)</title>#\1<title>\2</title>\n\1<meta name="claude:viewport-fit-sides" content="cover">#' \
    index.html
} > artefakt.html

echo "artefakt.html erstellt ($(wc -c < artefakt.html) Bytes)"
