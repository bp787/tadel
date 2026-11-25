# Tadelverwaltung · Blueprint · v0.36

> **Regel für die KI (bitte zuerst lesen):**
> 1. Diese Datei ist das Gedächtnis des Projekts.
> 2. Beim ersten Einlesen: Falls es im Projekt noch keine `AGENTS.md` und `CLAUDE.md` gibt, lege sie an.
>    `AGENTS.md` (die Regeln, gilt für alle KI-Werkzeuge):
>    ```
>    Lies zuerst BLUEPRINT.md: Es ist das Gedächtnis dieses Projekts.
>    @BLUEPRINT.md
>    Nach jeder Änderung am Projekt aktualisierst du BLUEPRINT.md und ergänzt den Changelog (Version hochzählen), im selben Commit wie die Änderung.
>    ```
>    `CLAUDE.md` (verweist nur auf `AGENTS.md`, damit Claude Code dieselben Regeln liest):
>    ```
>    @AGENTS.md
>    ```
> 3. Nach jeder Änderung am Projekt aktualisierst du diese Datei und ergänzt den Changelog.
> 4. Keine Passwörter oder API-Keys in diese Datei.

## 1. Warum

An der Schule kommen Listen (auf Papier) mit den Schülern, die zur Reflexionsstunde müssen (wer, wann, welcher Raum), und mit den Klassenbucheinträgen. Heute muss man das von Hand übertragen und den Überblick behalten:
- Wer kommt wann in welchen Raum?
- Wie viele Tadel und Einträge hat ein Schüler über das Schuljahr schon gesammelt?
- Wer ist zur Reflexionsstunde erschienen, und wer hat die Rückantwort zum Tadel unterschrieben abgegeben?

Das ist mühsam und fehleranfällig.

## 2. Für wen

Nur für mich (Lehrkraft). Keine anderen Nutzer in der ersten Version.

## 3. Was

**Hauptziel:** Ich sehe auf einen Blick, wer zur Reflexionsstunde muss, und hake ab, ob er da war und ob er die Rückantwort hat unterschreiben lassen. Alles andere ist nebensächlich.

Was das Tool können soll:
- **Hauptliste (Startseite):** Alle Termine zur Reflexionsstunde als Tabelle mit den Spalten in dieser Reihenfolge und so sortiert:
  **Datum → Uhrzeit → Raum → Name → Klasse**, dazu zwei Haken-Spalten **„erschienen“** und **„unterschrieben“**. Die Art des Eintrags steht *nicht* in der Hauptliste.
- **Erschienen abhaken:** Pro Termin hake ich von Hand ab, ob der Schüler erschienen ist.
- **Unterschrieben abhaken:** Pro Termin hake ich von Hand ab, ob die Rückantwort unterschrieben zurückgekommen ist.
- **Schülerdetail:** Ein Klick auf einen Schüler zeigt seine Einträge, nach Datum sortiert, und die Summen pro Art. Mögliche Arten:
  - Gelbe Karte Handy
  - Gelbe Karte stört
  - Gelbe Karte Streitschlichter
  - Rote Karte
  - Keine Hausaufgaben
  - Ohne Material
  - Sonstiges
- **Mehrere Schüler auf einmal (umgesetzt):** Beim neuen Termin trage ich beliebig viele Schüler untereinander ein (Name + Klasse, „+ weiterer Schüler“). Alle bekommen dasselbe Datum, dieselbe Uhrzeit und denselben Raum. Die Klasse der vorigen Zeile wird vorgeschlagen. Einträge laut Blatt gibt es nur bei genau einem Schüler, bei mehreren ergänze ich sie danach pro Schüler über ✎.
- **Schülerdetail (umgesetzt):** Ein Tipp auf den Namen öffnet die Übersicht: Klasse, Anzahl Tadel, wie oft erschienen und unterschrieben; die Halbjahres-Zusammenfassung vom neuesten Blatt (7 Kacheln, gelbe Karten gelb, Rote Karte rot; die Kacheln stehen **immer** da, ohne erfasste Zahlen mit „–“ und dem Knopf „✎ Zahlen vom Blatt eintragen“); darunter der Verlauf aller Tadel, neueste oben, jeweils mit den Einträgen der Woche, der Reflexionsstunde und dem Stand der Haken. Die Zahlen gebe ich beim Termin unter „Einträge und Halbjahr laut Blatt“ ein (der Bereich ist immer aufgeklappt); später füllt sie die Fotoerkennung (Phase 4).
- **Foto einlesen:** Ich fotografiere das gedruckte DIN-A4-Blatt, und die App erkennt daraus die Termine (Datum, Uhrzeit, Raum, Name, Klasse) und die Einträge. Vor dem Speichern prüfe und korrigiere ich das Ergebnis.
- **Foto einlesen (umgesetzt, Phase 4):** Knopf „📷 Foto“ oben → Kamera oder Fotomediathek. Die App liest das Blatt auf dem Gerät aus (dauert wenige Sekunden; beim allerersten Mal werden Programm und deutsche Sprachdaten aus dem Internet geladen, danach aus dem Browser-Speicher). Danach öffnet sich der Termin-Dialog vorausgefüllt mit einem gelben Hinweis „Bitte prüfen“. Nicht erkannte Felder sind rot umrandet. Unplausible Zahlen werden ebenfalls rot markiert (Halbjahr kleiner als Woche, oder die Wochensumme passt nicht zu „folgende N Klassenbucheinträge“). Handschriftliche Änderungen werden **nicht** erkannt, die korrigiere ich von Hand. Das Foto selbst wird nicht gespeichert (Schwärzen + Archiv: Phase 5/6). PDF-Scans werden seit Phase 7 angenommen.
- **Einlesen aus allen Quellen (umgesetzt, v0.22):** Knopf „📷 Einlesen“ oben öffnet „Blatt einlesen“: zuerst **Was?** (Tadel-Blatt oder Rückantwort), dann **Woher?** mit drei Knöpfen: **Kamera** (direkt fotografieren), **Fotos / Mediathek** (schon aufgenommenes Foto) und **Dateien** (Bild oder PDF aus der Dateien-App, iCloud, OneDrive, USB-Stick, Downloads usw.). Am PC oder iPad kann man ein Bild/PDF auch ins Fenster **ziehen** oder mit **Einfügen** (Strg+V / ⌘V) übernehmen; das gilt als Tadel-Blatt (bzw. als die im offenen Fenster gewählte Art). „📎 Rückantwort einlesen“ im Termin zeigt dieselbe Quellenauswahl ohne die Frage „Was?“. Andere Dateiarten werden mit einem Hinweis abgelehnt.
- **Foto schwärzen (umgesetzt, Phase 5):** Nach dem Auslesen erscheint „Foto schwärzen“: Adresse und Nachname (bis auf den ersten Buchstaben, z. B. „Sophie T▇▇▇“) sind schon schwarz. Ein grüner bzw. roter Hinweis sagt, ob beides gefunden wurde. Mit dem Finger ziehe ich weitere schwarze Rechtecke, „↶ Letzte rückgängig“ entfernt das letzte eigene Rechteck. **Zoom (v0.26):** „−/+“ vergrößert das Blatt (100–400 %), „✋ Verschieben“ schaltet um, sodass der Finger den Ausschnitt bewegt statt zu schwärzen. **Feste Namensregel (v0.26):** In der Zeile nach „An die Erziehungsberechtigten von“ bleibt das 1. Wort (Vorname), vom 2. Wort (Nachname) nur der Anfangsbuchstabe, weitere Wörter werden ganz geschwärzt; in „Rückantwort für Vorname Nachname, 05c“ bleiben „für“ und der Vorname, vom Nachnamen nur der Anfangsbuchstabe (die Klasse bleibt). Das gilt auch, wenn die Erkennung den Namen sonst nicht findet; danach wird jedes weitere Vorkommen des Nachnamens (z. B. im Text) ebenso gekürzt. Mit „Weiter“ geht es zum Termin. Erst beim Speichern des Termins wird **nur das geschwärzte Bild** gespeichert, das Original wird verworfen. Über „📄 Blatt ansehen“ (im Termin-Dialog und im Verlauf der Schülerübersicht) öffne ich es wieder. Beim Löschen eines Termins wird sein Foto mitgelöscht.
- **Foto automatisch schwärzen:** Beim Einpflegen schwärzt die App das Foto automatisch, bevor sie es speichert:
  - Die **Adresszeilen** (Straße, PLZ, Ort) werden ganz geschwärzt.
  - Der **Nachname** wird überall auf dem Blatt (Adressfeld, Anrede, Rückantwort) bis auf den ersten Buchstaben geschwärzt, sodass nur „Vorname N.“ lesbar bleibt.
  - Die App zeigt mir das geschwärzte Foto zur Kontrolle. Mit dem Finger oder der Maus kann ich zusätzliche Stellen schwärzen, falls etwas übersehen wurde.
  - Gespeichert wird **nur das geschwärzte Foto**, das Original wird sofort verworfen.
- **Ablauf:** Ich fotografiere bzw. kopiere jedes Blatt, **bevor** es an den Schüler geht. So habe ich die Informationen auch dann, wenn das Blatt verloren geht. Die Unterschrift ist auf dem Foto deshalb noch nicht zu sehen; „unterschrieben“ hake ich später von Hand ab, wenn die Rückantwort zurückkommt.
- **Archiv (erledigte Termine, umgesetzt):** Sobald bei einem Termin **beide** Haken gesetzt sind (erschienen **und** unterschrieben), verschwindet er von der Startseite „Aktuell“ und steht im „Archiv“, neueste Tage oben. Ein Hinweis mit „Rückgängig“ erscheint für 6 Sekunden. Wird im Archiv ein Haken entfernt, kommt der Termin zurück nach „Aktuell“.
- **Blatt-Archiv (umgesetzt, Phase 6):** Dritte Ansicht **„Blätter“** neben „Aktuell“ und „Archiv“: alle gespeicherten (geschwärzten) Blätter als Vorschaubilder, nach Monat gruppiert, neueste oben (sortiert nach Tadel-Datum), mit Name, Klasse, Datum und Stand der Haken; die Suche funktioniert auch hier. Ein Tipp öffnet das Blatt groß, darunter „👤 Schülerübersicht“ und „✎ Termin“. Umgekehrt: 📄 neben dem Namen in der Hauptliste, „📄 Blatt ansehen“ im Termin und im Verlauf der Schülerübersicht. Vorschaubilder werden erst geladen, wenn sie ins Bild scrollen.
- **Rückantwort ablegen (umgesetzt, Phase 7):** Zwei Wege: (1) „📷“ oben → „📎 Rückantwort“ → Foto oder Scan wählen. Die App liest Name, Klasse und „Den Tadel vom …“, schwärzt den Nachnamen (bis auf die Initiale) und schlägt im Fenster „Rückantwort zuordnen“ den passenden Termin vor (gleicher Name + Klasse + Tadel-Datum zuerst). Per Auswahlliste lässt sich ein anderer Termin wählen, „Als unterschrieben abhaken“ ist vorausgewählt. (2) Im Termin (✎) → „📎 Rückantwort einlesen“: wird direkt diesem Termin zugeordnet und abgehakt, danach öffnet sich der Termin wieder. Wird der Termin dadurch erledigt, wandert er ins Archiv (Hinweis unten). Die handschriftliche Unterschrift wird **nicht** automatisch geschwärzt. Ansehen: 📎 neben dem Namen in der Liste, „📎 Rückantwort“ in Termin, Schülerübersicht, Blätter-Ansicht (📎-Zeichen) und in der großen Ansicht (Umschalten zwischen Tadel-Blatt und Rückantwort). **PDF-Scans** (z. B. „Dokumente scannen“ in der Dateien-App) werden angenommen, die erste Seite wird ausgewertet.
- **Halbjahres-Zusammenfassung:** Das Blatt enthält schon eine Zusammenfassung für das ganze Halbjahr. Die App übernimmt sie, statt selbst über alle Blätter zu summieren.
- **Datensicherung (umgesetzt, Phase 8):** Unten auf der Seite „💾 Datensicherung“. **Sichern:** „Sicherung erstellen“ packt alle Termine, Haken, Einträge und geschwärzten Bilder in eine Datei mit **immer gleichem Namen** `tadel-sicherung.json` (seit v0.25), damit die neue Sicherung am selben Ort die alte ersetzt („Ersetzen“ wählen) und sich keine Dateien ansammeln; das Datum steht in der Datei und wird beim Öffnen angezeigt; auf dem iPhone über „📤 Sichern / Teilen“ (Teilen-Menü → „In Dateien sichern“ oder AirDrop), sonst „⬇ Herunterladen“. **Wiederherstellen/Übertragen:** „Sicherung öffnen“ zeigt, was in der Datei steckt; „Zusammenführen“ ergänzt/aktualisiert (nach ID, keine Doppelten), „Alles ersetzen“ löscht vorher alles auf dem Gerät (mit Rückfrage). **Erinnerung:** Gibt es Daten und war die letzte Sicherung nie oder vor 14+ Tagen, erscheint oben ein gelber Hinweis mit „Jetzt sichern“. Der Dialog zeigt außerdem Anzahl, Speicherbedarf und ob der Browser den dauerhaften Speicher zugesichert hat.

### Aufbau des Tadel-Blatts (aus dem Beispielfoto, ohne Namen)

**Ein Blatt pro Schüler und Woche** (Brief an die Erziehungsberechtigten), keine Sammelliste. Ein Foto ergibt also einen Termin.

| Feld auf dem Blatt | Beispiel | Hinweis |
|---|---|---|
| Klasse | 05c | oben rechts |
| Datum des Tadels | 11.11.2026 | oben rechts |
| Schülername | Vorname Nachname | in der Anrede und in der Rückantwort |
| Anzahl Einträge dieser Woche | 2 | im Text und in der Tabelle |
| Tabelle „vergangene Schulwoche“ | 7 Spalten (die Eintragsarten) | gedruckte Zahlen |
| Zeile „In diesem Halbjahr“ | 7 Zahlen | = Halbjahres-Zusammenfassung |
| Reflexionsstunde: Uhrzeit und Raum | „07:30 bis 08:10 Uhr in R0.54“ | **wird teils handschriftlich durchgestrichen und geändert** (z. B. 13:30–14:20) |
| Reflexionsstunde: Datum | 2026-11-20 | gedruckt |
| Rückantwort: KW, Zeitraum | KW 2026-45, 2026-11-02 bis 2026-11-08 | Abschnitt unten zum Abschneiden |
| Rückantwort: „zurück an Klassenleitung“ | Kürzel der Klassenleitung | |
| Unterschrift der Eltern, Ort/Datum | handschriftlich | → Haken „unterschrieben“ |

Folgerung: Die Fotoerkennung muss gedruckten Text lesen. Handschriftliche Änderungen (Uhrzeit/Raum) korrigiere ich auf dem Prüf-Bildschirm von Hand.

### Erweiterung: digitales Klassenbuch für mich (geplant, ab Phase 9)

Die App bekommt oben drei **Reiter: Tadel · Klassenbuch · Listen**. Gemeinsame Grundlage sind **Klassen mit ihren Schülern** und den **Fächern, die ich in der Klasse unterrichte**. Ein Tipp auf einen Namen öffnet überall dieselbe Schülerübersicht.

- **Klassen anlegen:** Schülernamen per Screenshot aus WebUntis (Texterkennung, lokal) oder als eingefügter Text; Prüf-Bildschirm vor dem Speichern. Gespeichert wird weiter nur Vorname + Initiale.
- **Umgesetzt (Phase 9):** Reiter unter der Kopfzeile (auf dem iPhone ohne Symbole). Reiter „Klassenbuch“: Klassen-Auswahl, Schüler als Kacheln mit Tadel-Zahl, Tipp öffnet die Schülerübersicht, Suche über alle Klassen; Hinweis auf Tadel, deren Name nicht in der Klassenliste steht. Reiter „Listen“: Klassen-Auswahl, Listen folgen in Phase 10. „+ Klasse“ oben bzw. „✎ Bearbeiten“ öffnet das Klassen-Fenster: Klasse, Fächer (Komma), Namen als Text (eine Zeile pro Schüler) oder „📷 Aus Screenshot lesen“; Reihenfolge „Vorname Nachname“ / „Nachname Vorname“ wählbar („Nachname, Vorname“ mit Komma wird erkannt, Partikel wie „von“ gehören zum Nachnamen); Vorschau der Kürzel, unterschiedene Namen blau. Beim Tadel-Termin wird das Kürzel aus der Klassenliste übernommen (z. B. „Max Mü.“). Tadel und Klassenschüler werden über Name + Klasse verbunden („05c“ = „5c“; „Max M.“ passt zu „Max Mü.“, wenn es eindeutig ist).
- **Schüler ergänzen/entfernen (umgesetzt, v0.29):** „+ Schüler“ neben „✎ Bearbeiten“ fügt einen einzelnen Schüler hinzu (Kürzel nach derselben Regel); im Klassen-Fenster entfernt × an einem Namen oder Löschen der Zeile einen Schüler. Neue Schüler stehen sofort in allen Listen der Klasse.
- **Listen (umgesetzt, Phase 10):** Reiter „Listen“ → Klasse wählen → Listen nach **Bereich** gruppiert („Allgemein“ zuerst, dann z. B. „Schwimmen“ oder ein Fach). Karte zeigt „Noch offen: x von n“, Frist und Fortschrittsbalken. „+ Liste“: Titel, Bereich (Vorschläge: Allgemein, Schwimmen, Fächer der Klasse), Frist, „Spalten übernehmen von“ (Vorlage, auch aus anderen Klassen), Spalten frei: ☑ Haken (rot/grün), ✎ Text, € Geld (optional Soll-Betrag: ein Tipp trägt ihn ein; Summe „x € von y €“), 📅 Datum (ein Tipp = heute). „Offen“ zählt Haken-, Geld- und Datum-Spalten, nicht Text. In der Liste: „📋 Wer fehlt noch?“ (kopiert die Namen, sonst Anzeige zum Markieren), „✎ Bearbeiten“, „📦 Archivieren“ / „↩ Zurückholen“, „🗑 Löschen“; Archiv eingeklappt unter den Listen. **Erinnerung:** Ab einen Tag vor der Frist steht oben in allen Reitern „⏰ Tanzgeld (5c): 4 noch offen · Frist morgen“ mit „Öffnen“ (rot, wenn abgelaufen). Wird eine Klasse gelöscht, werden ihre Listen mitgelöscht (mit Rückfrage).
- **Entscheidung 2026-11-22:** Das Einlesen der Klassenbuch-Einträge (Sammlungen) nutze ich **vorerst nicht**. Der Code bleibt drin und kann später wieder aufgegriffen werden.
- **Klassenbuch-Sammlung (umgesetzt, Phase 11):** Reiter „Klassenbuch“ → Klasse → „Einträge sammeln“ → „+ Sammlung“ (Titel, z. B. „Elternsprechtag 1. HJ“). In der Sammlung: „📥 Datei einlesen“ nimmt **CSV** (TeacherTool; Trennzeichen ; , oder Tab, auch Windows-Zeichensatz), **PDF** (WebUntis-Bericht „Klassenbucheinträge“, alle Seiten, Text direkt aus dem PDF) und **Screenshots** (lokale Texterkennung). Die App baut daraus eine Tabelle und schlägt im Fenster „Einträge übernehmen“ vor, welche Spalte was ist (Name oder Vor-/Nachname, Datum, Stunde oder Uhrzeit, Fach, Lehrkraft, Kategorie, Text); Vorschau der ersten Zeilen; „Fach für alle Zeilen“ und **„Fach je Lehrkraft“** (WebUntis nennt nur den „Benutzer“, nicht das Fach; die Zuordnung merkt sich das Gerät). Untis-Fachkürzel (D, E, M, BI …) werden zu Fachnamen. Namen werden über das Kürzel der Klassenliste zugeordnet; unbekannte Namen stehen mit „?“ unten. Doppelte Einträge (gleicher Schüler, Tag, Textanfang) werden übersprungen, auch über Quellen hinweg. Dazu „+ Eintrag“ von Hand; die **Tadel aus der App** erscheinen automatisch (Fach „Tadel“). **„Welche Fächer gehören dazu?“**: Haken pro Fach (vorausgewählt: meine Fächer der Klasse + Tadel), andere Fächer lassen sich dazunehmen. Übersicht aller Schüler mit Anzahl pro Fach, Namenssuche; Tipp auf einen Schüler: Einträge nach Fach gruppiert, innerhalb nach Datum und Uhrzeit/Stunde sortiert, Umschalter „Alle / Deutsch / …“; Quelle als Kürzel (TT, U, ✎, ⚠), Lehrkraft dahinter. Sammlung umbenennen oder löschen (z. B. nach dem Elternsprechtag).
- **TeacherTool-Schülerseite als Screenshot (umgesetzt, v0.31):** TeacherTool (iPad) zeigt pro Schüler und Kurs eine Seite (dunkler Hintergrund): oben Avatar-Kürzel, „Nachname Vorname“, „Kurs "5c Mint"“ (nur auf der ersten Seite), Kacheln (Endnote, Bemerkungen, Halbjahr 1/2, Somi 1–3, Checklisten) und darunter eine Baumliste wie „04.11.26 3 ( 📄 Gut beteiligt, eher lesen ) △1“ oder „13.10.26 2 △1“, unten Fehlzeiten. Pro Kurs ein Screenshot (wischen = nächster Kurs; im Beispiel 1 = Mint, 2 = Biologie). „📥 Datei einlesen“ nimmt **mehrere Screenshots auf einmal**; erkennt die App eine Schülerseite, öffnet sich „Schülerseite übernehmen“: Schüler (aus der Kopfzeile vorgeschlagen), pro Screenshot das Fach (aus „Kurs …“ vorgeschlagen, sonst eintragen) und die gefundenen Einträge als „Note 3 – Kommentar“ zum Korrigieren/Abwählen. Gelesen werden nur Zeilen mit Datum und Note bzw. Kommentar; Kachel und Liste zeigen dasselbe, es wird nur einmal übernommen. Die Texterkennung kehrt dunkle Bilder vorher um und vergrößert kleine Bilder.
- **Aufbau WebUntis-PDF (vom Beispiel 2026-11-22, ohne Namen):** Seitenkopf (Schule, Schuljahr, „Klassenbucheinträge“, „Klasse 05c, Schüler*innen …, Zeitraum“), Spalten Name (Nachname Vorname), Datum (TT.MM.JJ), Zeit (HH:MM), Benutzer, Eintragskategorie (2×), Text; lange Texte und Kategorien („gelbe Karte (stört)“) über mehrere Zeilen; Fußzeile mit Benutzer, Datum, „Seite x von y“; Seite 2 wiederholt den Kopf.
- **Wunsch für Phase 11 (2026-11-22, umgesetzt):** Beim Erstellen der Zusammenfassung der Einträge **Fächer zum Ankreuzen**: standardmäßig meine Fächer der Klasse, auf Wunsch weitere Fächer dazunehmen, um Einträge in anderen Fächern mit zu erwähnen. WebUntis liefert Klassenbucheinträge auch als **PDF-Bericht** („ClassregEvent…pdf“); das Einlesen soll PDFs annehmen (pdf.js ist schon da).
- **Gleiche Namen (entschieden):** Sind zwei Kürzel gleich, kommen weitere Buchstaben des Nachnamens dazu, bis sie sich unterscheiden („Max Me.“ / „Max Mü.“). Steckt ein Nachname ganz im anderen (Meyer / Meyerstedt), werden sie nummeriert: „Max M. 1“ und „Max M. 2“.
- **Listen (Checklisten) pro Klasse:** Zeilen = Schüler, Spalten lege ich selbst an (z. B. Tanzgeld, Fahrkarte, Wichtelgeschenk). Spaltenarten: **Haken**, **Text**, optional **Geld mit Summe** (z. B. „18 × 12 € = 216 €“), Datum. Oben „Noch offen: 4 von 27“, „Wer fehlt noch?“ als Text zum Kopieren. Erledigte Listen: **wahlweise archivieren oder löschen**. Vorlagen zum Wiederverwenden. **Erinnerung** mit Frist (Hinweis in der App, z. B. „Tanzgeld: 4 offen, Frist morgen“).
- **Klassenbuch-Sammlung (nur zu Stichtagen):** Kein dauerhaftes Einspeisen. Vor Notengebung oder Elternsprechtag lese ich alles auf einmal ein: **TeacherTool als CSV-Datei** (bietet TeacherTool an), **Untis per Screenshots**, dazu die Tadel aus der App. Doppelte Einträge werden erkannt. Eine Sammlung kann danach wieder gelöscht werden.
- **Ansicht der Einträge:** pro Schüler, **nach Unterrichtsfach gruppiert** (nur Fächer, die ich in der Klasse unterrichte), innerhalb des Fachs **nach Datum und Stunde sortiert**; zwischen den Fächern direkt umschalten oder alle zusammen sehen. Namenssuche: Eintippen → komplette Übersicht des Schülers.
- **Elternsprechtag:** pro Schüler eine Seite mit allen Einträgen, Tadeln und Halbjahreszahlen, Notizfeld fürs Gespräch, Druckansicht.
- **Zufallsauswahl:** animiert wie eine Verlosung, im Vollbild für den Beamer; dazu Gruppen bilden.
- **Erinnerungen in der App:** z. B. „Rückantwort fehlt seit 7 Tagen“, Listen-Fristen (keine Push-Nachrichten, sondern Hinweis beim Öffnen).
- **Datenschutz:** Verhaltensnotizen sind heikler als die Tadel-Liste; vor echtem Einsatz mit der Schulleitung klären (dienstliche Daten auf privatem Gerät).

Nicht Teil der ersten Version (später vielleicht):
- Mehrere Lehrkräfte bzw. gemeinsame Nutzung
- Automatische Erinnerungen (z. B. „Rückantwort fehlt seit 7 Tagen“)
- Ausdruck/PDF-Berichte pro Schüler oder Klasse
- Synchronisation zwischen mehreren Geräten

## 4. Woran merke ich, dass es klappt?

Ich öffne die App und sehe sofort, nach Datum und Uhrzeit sortiert, wer in welchen Raum zur Reflexionsstunde muss. Mit zwei Klicks hake ich ab, ob er da war und ob er unterschrieben hat. Ein neues Blatt habe ich in unter einer Minute fotografiert, geprüft und gespeichert.

## 5. Design-Richtung

*(Vorschlag der KI, bitte anpassen)*
- Stimmung: ruhig, sachlich, übersichtlich (wie ein gutes Notenbuch)
- Farben: neutrales Grau/Weiß, ein Akzent in Blau. **Haken: Grün mit ✓ = erledigt, Rot = noch nicht abgehakt** (immer, unabhängig vom Datum). Gelbe Karten (Handy, stört, Streitschlichter) sind gelb unterlegt, die Rote Karte rot.
- Gerät: **iPhone als Hauptgerät** (Safari, hochkant: jede Zeile ist eine Karte mit zwei großen Haken-Knöpfen nebeneinander), daneben iPad und PC (Tabelle). Große Tipp-Flächen (mind. 44 px).
- Vorbild: **offen**

## 6. Technik

*(Vorschlag der KI, noch nicht final)*

- **Eine Web-App, die im Browser läuft** (HTML + JavaScript, ohne Server). Das ist am einfachsten: nichts installieren, sie läuft auf PC, Tablet und Handy.
- **Daten bleiben auf dem Gerät** (im Browser-Speicher, IndexedDB, weil die Fotos dafür groß genug sind), dazu Export/Import als Datei. Das ist gut für den Datenschutz, weil keine Schülerdaten in einer Cloud liegen. **Ausnahme seit v0.33:** Im Claude-Artefakt zusätzlich privat bei claude.ai (siehe unten).
- **Auf das Tablet bringen:** Damit die App auf dem Tablet läuft, muss die Programmdatei (nur der Code, **keine** Schülerdaten) unter einer Internetadresse liegen. Dafür bietet sich ein kostenloser Webspace für statische Seiten an (z. B. GitHub Pages). Auf dem Tablet lege ich die App dann wie eine normale App auf den Startbildschirm. Die Schülerdaten bleiben trotzdem nur auf dem Tablet.
- **Claude-Artefakt (umgesetzt, zum Testen):** Die App ist als privates Artefakt veröffentlicht: https://claude.ai/artifact/AUbJBD96zQiGGM5bDqYE3u (nur für mich sichtbar, Anmeldung bei claude.ai nötig). Besonderheiten dort: Browser-Speicher ist weniger verlässlich (deshalb Sicherungen machen); `alert`/`confirm` gibt es nicht (die App nutzt eigene Fenster `frage()`/`meldung()`); Dateien speichern nur über die Fähigkeit `downloads` (Knopf „💾 Datei speichern“); Teilen-Menü und Kamera-Schnittstelle sind gesperrt, Fotos kommen über die normale Dateiauswahl (iPhone: Foto aufnehmen / Mediathek / Dateien); Bibliotheken dürfen nicht aus dem Netz nachgeladen werden (deshalb `vendor/`). **Aktualisieren:** `bash werkzeuge/artefakt-bauen.sh`, dann `artefakt.html` mit denselben Begleitdateien erneut veröffentlichen (gleicher Link). Fähigkeiten beim Veröffentlichen: `downloads`, `db`, `user`.
- **Speicher bei claude.ai (umgesetzt, v0.33, Entscheidung 2026-11-22):** Im Artefakt gingen eingepflegte Daten nach dem Schließen verloren (Safari löscht den Speicher eingebetteter Seiten). Deshalb legt die App im Artefakt jede Änderung zusätzlich im **privaten Speicher des Artefakts bei claude.ai** ab (Fähigkeit `db`, Pfad `data/users/<eigene ID>/…`, nur für mich lesbar) und holt beim Öffnen alles zurück; so sind die Daten auch auf iPhone und iPad gleich (Abgleich beim Öffnen und beim Zurückkehren in die App nach mehr als 1 Minute). Unten auf der Seite steht „☁ Bei claude.ai gespeichert“ oder rot „⚠ Nicht bei claude.ai gespeichert … Bitte eine Datensicherung machen“. **Datenschutz:** Damit liegen Kürzel, Haken, Einträge und geschwärzte Blätter auf Servern von claude.ai (Anthropic), nicht mehr nur auf dem Gerät; vor echtem Einsatz mit der Schule klären. Außerhalb des Artefakts (Testserver, später GitHub Pages) bleibt alles nur auf dem Gerät.
- **Weitergabe an Kollegen (v0.34, Entscheidung 2026-11-25):** Jede Lehrkraft öffnet denselben Artefakt-Link mit ihrem **eigenen claude.ai-Konto auf ihren eigenen Geräten**. Weil alles unter `data/users/<eigene ID>/` liegt, sieht jede Person nur ihre eigenen Daten, auch ich als Besitzer sehe die Daten der Kollegen nicht und umgekehrt; die eigenen Geräte (z. B. mein iPhone und iPad) gleichen sich weiter ab. Freigabe über das Teilen-Menü des Artefakts als **„Mitwirkender“** (Contributor): Betrachter/Kommentatoren und Personen außerhalb der eigenen Organisation dürfen nichts speichern; dann zeigt die App unten rot „Du hast für diese App nur Lesezugriff …“. **Nicht als „Bearbeiter“ (Editor) freigeben:** Bearbeiter können neue Versionen der App veröffentlichen und damit die Speicherregeln ändern. Gemeinsam genutzte Geräte sind nicht vorgesehen.
- **Erkenntnis 2026-11-25:** Im Teilen-Menü meines Artefakts gibt es nur „Bearbeiter“ und „Kommentator“, **keinen „Mitwirkenden“** (privates Konto, keine Organisation). Kommentatoren dürfen nichts speichern, Bearbeiter dürften die App selbst ändern. Außerdem läuft das Artefakt nur auf der claude.ai-Seite. **Wunsch:** eine eigene, vernünftige Adresse, die Kollegen als App auf den Startbildschirm / in Chrome legen, jede Person mit eigenem Zugang, Abgleich zwischen den eigenen Geräten, Klassen mit einer Kollegin teilen. Damit ist das Artefakt für die Weitergabe ungeeignet; nächster Schritt: eigene Adresse (z. B. GitHub Pages) + eigener Speicher mit Anmeldung (Vorschlag: Supabase, Rechenzentrum Frankfurt), noch nicht entschieden.
- **Teilen-Code für Klassen (in Arbeit, nicht veröffentlicht):** In `wolke.js` (Abschnitt „Geteilte Klassen“) und `klassen.js` (Knöpfe „🔗 Teilen“, „🔗 Code eingeben“, Löschen einer geteilten Klasse) gebaut: Klasse, Schülerliste und Listen unter `geteilt/<code>`, Haken zellenweise zusammengeführt, live mithören, Teilen beenden / verlassen. Test mit nachgebautem Speicher: Teilen und Beitreten per Code klappen; offen: eine gleichzeitige Änderung der anderen Person kam im Test nicht an. Wird beim Umzug auf den eigenen Speicher wieder aufgegriffen.
- **iPhone-/iPad-Besonderheiten (gilt für beide, gleiches Safari):**
  - Die App wird in Safari über „Teilen → Zum Home-Bildschirm“ installiert. **Das ist wichtig:** Safari kann Daten normaler Webseiten nach längerer Nichtbenutzung löschen, Apps auf dem Home-Bildschirm sind davon ausgenommen. Zusätzlich erinnert die App an regelmäßige Datensicherungen.
  - Die Scan-Funktion von iPhone/iPad (Dateien- oder Notizen-App: „Dokumente scannen“) speichert meist als **PDF**. Die App nimmt deshalb neben Fotos (JPG/PNG/HEIC) auch PDFs an und wandelt die erste Seite in ein Bild um (mit pdf.js).
- **Handy und Tablet gleichzeitig:** Das ist in der ersten Version nicht vorgesehen, weil die Daten pro Gerät getrennt liegen. Übergangsweise geht es über Export auf dem einen und Import auf dem anderen Gerät. Eine echte Synchronisation bräuchte einen Server bzw. eine Cloud und ist für später geplant (Datenschutz klären).
- **Texterkennung vom Foto: entschieden, Variante A, lokal (Tesseract.js).** Sie ist kostenlos, braucht kein Konto, und keine Daten verlassen das Gerät (auf dem Blatt stehen Name und Adresse). Gedruckter Text wird ordentlich erkannt; handschriftliche Änderungen korrigiere ich auf dem Prüf-Bildschirm. Variante B (KI im Netz) bleibt nur eine Option für später, falls A zu ungenau ist. **Am 2026-11-22 erneut bestätigt:** Auch für Handschrift kein KI-Lesen, alles bleibt lokal; handschriftliche Änderungen werden von Hand korrigiert.
- **Automatisches Schwärzen:** Die Texterkennung (Tesseract.js) liefert zu jedem erkannten Wort auch seine Position im Bild. So findet die App die Wörter zuverlässig, auch wenn das Foto schief oder verschieden zugeschnitten ist (feste Bildbereiche würden das nicht schaffen):
  - **Adresse:** Das sind die Zeilen zwischen „An die Erziehungsberechtigten von“ und „Sehr geehrte“, ohne die Namenszeile.
  - **Nachname:** Die App erkennt ihn in der Namenszeile und schwärzt danach jedes Vorkommen dieses Worts bis auf den ersten Buchstaben.
  - Das Schwärzen passiert lokal im Browser auf einer Zeichenfläche (Canvas), es geht nichts ins Netz.
- **Namen: entschieden.** Gespeichert und angezeigt werden nur **Vorname + Initiale des Nachnamens** (z. B. „Max M.“). Die App kürzt den erkannten vollen Namen automatisch, bevor sie ihn speichert. Die Adresse wird nicht übernommen.

### Dateien im Projekt

| Datei | Zweck |
|---|---|
| `index.html` | Aufbau der Seite (Hauptliste, Dialog „Termin“) |
| `styles.css` | Aussehen; Hell-/Dunkelmodus; ab 720 px Breite Tabelle mit festen Spaltenbreiten (iPad, iPhone quer, PC), darunter Karten (iPhone hochkant) |
| `app.js` | Logik: Speicher (IndexedDB, Datenbank `tadelverwaltung`, Ablage `termine`), Sortierung, Filter, Namenskürzung, Abhaken |
| `foto.js` | Phase 4: Foto einlesen. Lädt Tesseract.js 5.1.1 erst beim ersten Foto, alle Teile aus `vendor/tesseract/` (kein Nachladen aus dem Netz); Bildvorbereitung (verkleinern auf max. 2400 px, Graustufen, Schattenausgleich per adaptiver Schwelle, Tabellenlinien entfernen); `werteBlattAus(text)` liest Name, Klasse, Tadel-Datum, Uhrzeit von/bis, Raum, Datum der Reflexionsstunde, Wochen- und Halbjahreszahlen und die Anzahl „folgende N Klassenbucheinträge“ |
| `foto.js` (Phase 5) | `findeSchwaerzungen()` sucht über die Wortpositionen der Texterkennung das Adressfeld (Zeilen zwischen „An die Erziehungsberechtigten von“ + Namenszeile und „Sehr geehrte“, nur linke 60 % der Seite) und jedes Vorkommen des Nachnamens (auch mit 1 Lesefehler) und schwärzt ihn ab dem 2. Buchstaben; `schwaerzenDialog()` zeigt das Ergebnis, Rechtecke per Finger ergänzen, „Letzte rückgängig“; Speicherung als JPEG, max. 1600 px, ca. 70 KB |
| `foto.js` (Phase 7) | Auswahl „Tadel-Blatt / Rückantwort“ und Quelle Kamera/Mediathek/Dateien (`dlg-foto-wahl`, drei Dateifelder `foto-kamera` mit `capture`, `foto-mediathek`, `foto-datei`; `nimmDatei()` für Auswahl, Ziehen und Einfügen), PDF über pdf.js 3.11.174 (aus `vendor/pdfjs/`, wird erst bei einem PDF geladen), `rueckantwortKandidaten()` + `zuordnenDialog()`, `starteFotoEingabe(art, terminId)`. Bildvorbereitung ohne globales Kontraststrecken (verdickte sonst Buchstaben bei textarmen Bildern); Linien-Entfernung misst an der langen Bildseite |
| `klassen.js` | Phase 9: Reiter (`zeichneReiter`), Klassenbuch- und Listen-Ansicht, Klassen-Fenster, `zerlegeName()`, `namenAusText()` (Namen aus dem Screenshot-Text, ohne Überschriften, Daten, Geschlecht m/w/d). Die Namensregel `bildeKuerzel()`, `kuerzelInKlasse()`, `gehoertZu()` und die Ablage `klassen` stehen in `app.js` |
| `listen.js` | Phase 10: Listen-Übersicht pro Klasse (nach Bereich), Listen-Tabelle mit Zellen je Spaltenart, Summen, „Wer fehlt noch?“, Archiv, Fenster „Liste“ mit Spalten-Editor und Vorlage, Erinnerungen (`zeichneErinnerungen`). Ablage `listen` (Datenbank-Version 4) und Eingabefenster `eingabe()` stehen in `app.js` |
| `sammlung.js` | Phase 11: Sammlungen. `leseCsv`/`dekodiere` (CSV), `pdfTabelle` (pdf.js-Text mit Positionen, Seitenkopf ab Seite 2 weg), `bildTabelle` (Tesseract-Wortpositionen), `zellenAusStuecken` + `tabelleAusZeilen` (Spalten nach Überschrift, nächstgelegene Spalte, umbrochene Zeilen zusammenführen), `rateZuordnung`, `zeileAlsEintrag`, `fachName` (Untis-Kürzel), Fenster „Einträge übernehmen“ und „Eintrag hinzufügen“, Ansicht Übersicht/Schüler. Gemerkt im Browser: `lehrerFach` (Lehrkraft → Fach) |
| `wolke.js` | v0.33: Abgleich mit dem Speicher bei claude.ai (nur im Artefakt). `wolkeMerke(ablage, obj)` / `wolkeVergiss(ablage, id)` werden nach jedem lokalen Speichern/Löschen in `app.js` aufgerufen (Warteschlange, nacheinander, 1 Wiederholung); Aufbau `data/users/<uid>/<ablage>/e/<id>` = `{ k, zeit, daten }` bzw. `{ k, zeit, geloescht: true }` (Löschmarke, damit ein anderes Gerät es nicht wieder hochlädt); Bilder getrennt unter `bilder` als Base64 (über 240 000 Zeichen wird verkleinert, ein Dokument darf höchstens 256 KiB haben). `wolkeAbgleich()` beim Start: claude.ai gewinnt, außer bei noch nicht bestätigten eigenen Änderungen (`localStorage: wolkeOffen`); nur lokal Vorhandenes wird hochgeladen. `wolkeNachImport(ersetzen)` nach dem Einspielen einer Sicherung |
| `sicherung.js` | Phase 8: Datensicherung. Dateiformat: `{ format: "tadelverwaltung-sicherung", version: 1, erstellt, termine: [...], fotos: [{ id, terminId, art, erstellt, bild: "data:image/jpeg;base64,…" }] }`. Import prüft das Format, schreibt Termine und Fotos in einer gemeinsamen Speicher-Transaktion. Datum der letzten Sicherung im Browser (`localStorage: letzteSicherung`, nur Komfort) |
| `serve.ps1` | Kleiner Testserver für den PC (`http://localhost:8080`), wird auf iPhone/iPad nicht gebraucht |
| `vendor/` | Mitgelieferte Bibliotheken (unverändert heruntergeladen am 2026-11-22): `tesseract/tesseract.min.js` + `worker.min.js` (tesseract.js 5.1.1), `tesseract-core-simd-lstm.wasm.js` + `tesseract-core-lstm.wasm.js` (tesseract.js-core 5.1.1), `tesseract/lang/deu.traineddata.gz.wasm` (= `@tesseract.js-data/deu` 1.0.0, 4.0.0_best_int, gzip; umbenannt, weil claude.ai keine .gz ausliefert; `legeSprachdatenBereit()` legt sie in den Tesseract-Zwischenspeicher), `pdfjs/pdf.min.js` + `pdf.worker.min.js` (pdf.js 3.11.174) |
| `artefakt.html` | Die Seite fürs Claude-Artefakt, **automatisch erzeugt** aus `index.html` mit `bash werkzeuge/artefakt-bauen.sh` (entfernt nur die Hüllen-Tags, die claude.ai selbst setzt). Nie von Hand ändern |
| `werkzeuge/artefakt-bauen.sh` | Baut `artefakt.html` |
| `.claude/launch.json` | Startet den Testserver aus Claude Code heraus |

**Ein Termin** wird so gespeichert: `id`, `datum` (Reflexionsstunde, JJJJ-MM-TT), `von`, `bis` (HH:MM), `raum`, `name` (schon gekürzt), `klasse`, `erschienen` (ja/nein), `unterschrieben` (ja/nein), `erstellt`, optional `tadelDatum` (Datum oben rechts auf dem Blatt), `woche` und `halbjahr` (je 7 Zahlen: `handy`, `stoert`, `streit`, `rot`, `hausaufgaben`, `material`, `sonstiges`; `null`, wenn nicht erfasst). optional `fotoId` und `rueckantwortId`. Ein Schüler wird über Name + Klasse erkannt. **Ein Foto** (Ablage `fotos`, seit Datenbank-Version 2): `id`, `terminId`, `art` („tadel“ oder „rueckantwort“), `bildDaten` (ArrayBuffer, JPEG, geschwärzt) + `bildTyp`, `erstellt`; ältere Fotos haben stattdessen `bild` (Blob), `fotoBild(f)` liefert beides als Blob. (Grund: Safari speichert in eingebetteten Seiten wie claude.ai Blobs teils nicht.) Namen werden schon im Termin-Fenster gekürzt (nach Fotoerkennung sofort, bei Handeingabe beim Verlassen des Feldes), passend zur Klassenliste. **Eine Klasse** (Ablage `klassen`, seit Datenbank-Version 3): `id`, `name` (z. B. „05c“), `faecher` (Liste), `schueler` (Liste aus `{ id, name }`, nur Kürzel), `erstellt`; in der Sicherungsdatei als `klassen` (ältere Sicherungen ohne Klassen bleiben gültig). **Eine Liste** (Ablage `listen`, seit Datenbank-Version 4): `id`, `klasseId`, `titel`, `bereich`, `frist` (oder `null`), `spalten` (`{ id, titel, art: haken|text|geld|datum, soll? }`), `werte` (`{ schuelerId: { spaltenId: true | Text | Betrag | JJJJ-MM-TT } }`), `archiviert`, `erstellt`; in der Sicherung als `listen`. **Eine Sammlung** (Ablage `sammlungen`, seit Datenbank-Version 5): `id`, `klasseId`, `titel`, `erstellt`, `faecherAuswahl` (Liste oder `null` = Vorauswahl), `eintraege` (`{ id, schuelerId (oder null), name (Kürzel), datum, stunde, zeit, fach, von (Lehrkraft), text, quelle: teachertool|untis|andere|hand }`); Tadel werden nicht gespeichert, sondern jedes Mal aus den Terminen berechnet; in der Sicherung als `sammlungen`.

**Am PC testen:** Im Projektordner `powershell -ExecutionPolicy Bypass -File serve.ps1` ausführen, dann im Browser `http://localhost:8080` öffnen. (Python/Node sind auf dem PC nicht installiert, deshalb ein PowerShell-Server.)

## 7. Manuelle Schritte (Phase 2: Einrichten)

*(Hängt von der Entscheidung in Abschnitt 6 ab)*

- [x] Aufbau der Liste beschreiben: gedrucktes DIN-A4-Blatt mit Terminen, Einträgen und Halbjahres-Zusammenfassung
- [x] Foto eines Beispielblatts bereitgestellt (Aufbau siehe Abschnitt 3; das Foto selbst wird nicht im Projekt gespeichert)
- [x] Entscheiden: Texterkennung lokal (A) oder per KI (B) → **A, lokal**
- [x] Entscheiden: Klarnamen oder Kürzel → **Vorname + Initiale des Nachnamens**
- [x] Entscheiden: Hauptgerät → **iPhone** (geändert am 2026-11-22, vorher Tablet); iPad bleibt nutzbar
- [x] Tablet-Typ angeben → **iPad**
- [x] Kostenloses GitHub-Konto anlegen
- [ ] **Später erledigen:** Wieder bei GitHub anmelden (Passwort + unbenutzter Wiederherstellungscode), dann sofort Google Authenticator als zweiten Faktor einrichten (Settings → Password and authentication → Authenticator app → Edit, QR-Code scannen) und neue Wiederherstellungscodes holen
- [x] Benutzernamen der KI mitteilen → **bp787**
- [x] Repository `tadel` auf GitHub anlegen (öffentlich) → https://github.com/bp787/tadel (2026-11-25)
- [x] GitHub Pages einschalten (Branch `main`, Ordner `/`) → **https://bp787.github.io/tadel/** (2026-11-25)
- [x] ~~Nur bei Variante B: API-Schlüssel anlegen~~ → entfällt, weil Variante A gewählt ist
- [ ] Ggf. mit der Schulleitung bzw. dem Datenschutzbeauftragten klären, ob die Speicherung so in Ordnung ist

## 8. Bauphasen (Phase 3: Bauen)

| Phase | Was entsteht | So teste ich es | Status |
|---|---|---|---|
| 1 | Hauptliste: Termine von Hand anlegen (Datum, Uhrzeit, Raum, Name, Klasse), sortiert anzeigen, Daten bleiben nach Neuladen erhalten | Zwei Termine eintragen, Reihenfolge prüfen, Seite neu laden, die Daten sind noch da | **fertig** (v0.10) |
| 2 | Abhaken: „erschienen“ und „unterschrieben“ pro Termin | Haken setzen, neu laden, die Haken sind noch da | **fertig** (v0.10) |
| 3 | Schülerdetail: Einträge (7 Arten) nach Datum, Summen bzw. Halbjahres-Zusammenfassung | Auf einen Schüler klicken und alle Einträge mit Summen sehen | **fertig** (v0.13) |
| 4 | Foto einlesen: Foto aufnehmen/hochladen, erkannte Zeilen prüfen und übernehmen | Beispielfoto einlesen, Ergebnis korrigieren, speichern | **fertig** (v0.15), mit Testblättern geprüft; Test mit echtem iPhone-Foto steht noch aus |
| 5 | Automatisch schwärzen: Adresse und Nachname (bis auf die Initiale) im Foto schwärzen, von Hand nachschwärzen, nur das geschwärzte Foto speichern | Beispielfoto einlesen: Nur „Vorname N.“ ist lesbar, die Adresse ist schwarz | **fertig** (v0.16), mit Testblatt geprüft |
| 6 | Archiv: alle geschwärzten Blätter nach Datum, Verknüpfung mit Termin und Schüler | Drei Blätter einlesen, im Archiv in der richtigen Reihenfolge sehen, vom Termin aus das Blatt öffnen | **fertig** (v0.17) |
| 7 | Rückantwort ablegen: Foto/Scan der Rückantwort beim Termin speichern (geschwärzt), Haken „unterschrieben“ wird gesetzt | Rückantwort scannen, beim Termin ablegen, Haken ist gesetzt, Bild im Archiv | **fertig** (v0.18), mit Test-Foto und Test-PDF geprüft |
| 8 | Datensicherung: Export/Import als Datei (inkl. Archiv-Fotos), auch zum Übertragen aufs Handy | Exportieren, Daten löschen, importieren, alles ist wieder da | **fertig** (v0.19), Sichern → Löschen → Wiederherstellen geprüft |
| 9 | Reiter Tadel/Klassenbuch/Listen; Klassen mit Schülern (Screenshot WebUntis oder Text) und meinen Fächern; eindeutige Kürzel bei gleichen Namen | Klasse per Screenshot anlegen, zwei „Max M.“ werden unterschieden | **fertig** (v0.28), mit Test-Screenshot und Testnamen geprüft; echter WebUntis-Screenshot steht noch aus |
| 10 | Listen: eigene Spalten (Haken, Text, Geld mit Summe, Datum), „Noch offen“, „Wer fehlt noch?“ kopieren, Vorlagen, archivieren oder löschen, Erinnerung mit Frist | Liste „Tanzgeld“ anlegen, abhaken, Summe stimmt, Liste archivieren | **fertig** (v0.29), am PC und in iPhone-Breite geprüft |
| 11 | Klassenbuch-Sammlung: TeacherTool-CSV, Untis-Screenshots, Tadel; Doppelte erkennen; Ansicht pro Schüler nach Fach, sortiert nach Datum + Stunde; Namenssuche; Sammlung löschen | CSV + 2 Screenshots einlesen, Schüler suchen, nach Fächern umschalten | **fertig** (v0.30), mit nachgebautem WebUntis-PDF (2 Seiten, umbrochene Texte) und TeacherTool-artiger CSV geprüft; echte TeacherTool-CSV steht noch aus |
| 12 | Elternsprechtag: Schülerseite mit Notizfeld und Druckansicht | Seite für einen Schüler drucken | geplant |
| 13 | Zufallsauswahl animiert (Beamer-Vollbild), Gruppen bilden; Erinnerungen in der App | Auswahl im Vollbild starten | geplant |

## 9. Offene Punkte und Ideen

- Später: Synchronisation zwischen Tablet und Handy (braucht Server/Cloud, Datenschutz vorher klären).
- Speicherplatz: Ein Foto belegt verkleinert ca. 200–400 KB, ein Schuljahr mit einigen hundert Blättern passt problemlos in den Browser-Speicher. Die Datensicherung (Phase 7) wird dadurch aber größer.
- Idee: Weil ein Blatt nur ca. 6 Werte für die Hauptliste liefert, ist auch Eintippen in ca. 20 Sekunden möglich. Das Foto ist eine Komfortfunktion.
- Umgesetzt: Ansichten „Aktuell“ (offene Termine), „Archiv“ (erledigte Termine) und „Blätter“ (gespeicherte Fotos) mit Zählern, Suche nach Name, Klasse oder Raum. Ein gesetzter Haken ist grün mit ✓; nicht abgehakte Felder sind immer rot; der heutige Tag ist blau.
- Git-Repository seit 2026-11-25: Commits als `bp787` mit der anonymen GitHub-Adresse `bp787@users.noreply.github.com` (nur in diesem Repository eingestellt). **Hochladen:** `git -c credential.gitHubAuthModes=device push` öffnet ein Windows-Fenster mit Code; den Code auf github.com/login/device eingeben und „Authorize“ (wird nach einigen Sekunden dunkelgrün). Der normale Browser-Weg blieb hängen. Nach dem Hochladen baut GitHub Pages die Seite in 1–2 Minuten neu. Der Ordner `zum-hochladen/` war nur eine Notlösung und wird nicht versioniert.

## Changelog

| Version | Datum | Änderung |
|---|---|---|
| 0.1 | 2026-11-22 | Blueprint erstellt, erste Anforderungen aus dem Gespräch eingetragen |
| 0.2 | 2026-11-22 | Hauptziel geschärft (abhaken: erschienen/unterschrieben), Spaltenreihenfolge Datum–Uhrzeit–Raum–Name–Klasse, 7 Eintragsarten, Halbjahres-Zusammenfassung vom Blatt übernehmen; AGENTS.md auf BLUEPRINTtadel.md umgestellt |
| 0.3 | 2026-11-22 | Aufbau des Tadel-Blatts aus dem Beispielfoto dokumentiert (ein Blatt pro Schüler, handschriftliche Änderungen möglich) |
| 0.4 | 2026-11-22 | Entschieden: Texterkennung lokal (Variante A), Namen nur als Vorname + Initiale des Nachnamens, API-Schlüssel entfällt |
| 0.5 | 2026-11-22 | Neue Funktion: Foto automatisch schwärzen (Adresse ganz, Nachname bis auf die Initiale), nur das geschwärzte Foto wird gespeichert; Bauphase 5 eingefügt |
| 0.6 | 2026-11-22 | Ablauf geklärt (Foto vor der Ausgabe an den Schüler), neue Funktion Archiv nach Datum, Bauphase 6 eingefügt |
| 0.7 | 2026-11-22 | Hauptgerät Tablet (später Handy), neue Funktion Rückantwort fotografieren/scannen (Bauphase 7), Technik: Webspace für die App, Synchronisation für später |
| 0.8 | 2026-11-22 | Tablet ist ein iPad: Installation über den Home-Bildschirm, PDF-Scans werden angenommen |
| 0.9 | 2026-11-22 | GitHub-Konto angelegt, Webspace-Einrichtung in Einzelschritte aufgeteilt |
| 0.10 | 2026-11-22 | Phase 1 + 2 gebaut: Hauptliste (nach Tagen gruppiert, sortiert Datum–Uhrzeit–Raum–Name), Termin anlegen/bearbeiten/löschen, Namenskürzung, Haken „erschienen“/„unterschrieben“, Filter und Suche, Testserver `serve.ps1`; GitHub-Anmeldung auf später verschoben |
| 0.11 | 2026-11-22 | Erledigte Termine (beide Haken) wandern automatisch von „Aktuell“ ins „Archiv“, mit Rückgängig-Hinweis; Filter „Alle/Ab heute/Offen“ durch „Aktuell/Archiv“ ersetzt |
| 0.12 | 2026-11-22 | Hauptgerät jetzt iPhone: Karten-Ansicht neu (Uhrzeit/Raum, Name/Klasse, zwei Haken-Knöpfe nebeneinander); Fehler behoben, durch den Haken- und Bearbeiten-Knöpfe in der Tabellenansicht übereinander lagen (feste Spaltenbreiten, Umschaltpunkt 720 px) |
| 0.13 | 2026-11-22 | Phase 3 gebaut: Schülerdetail (Halbjahres-Zusammenfassung vom neuesten Blatt, Verlauf aller Tadel), Einträge laut Blatt im Termin-Dialog (Tadel-Datum, Woche, Halbjahr); neuer Termin für mehrere Schüler auf einmal; nach dem Anlegen springt die Ansicht auf „Aktuell“ |
| 0.14 | 2026-11-22 | Einheitliche Farben: nicht abgehakte Felder (erschienen/unterschrieben) immer rot, statt teils grau, teils orange; gelbe Karten gelb und Rote Karte rot unterlegt (Halbjahres-Kacheln, Verlauf, Eingabefelder) |
| 0.15 | 2026-11-22 | Phase 4 gebaut: Foto einlesen mit lokaler Texterkennung (Tesseract.js), Schattenausgleich und Entfernen der Tabellenlinien, Termin-Dialog vorausgefüllt mit Prüf-Hinweis und Plausibilitätsprüfung; mit Testblättern (schief, Schatten) geprüft |
| 0.16 | 2026-11-22 | Phase 5 gebaut: Foto automatisch schwärzen (Adresse, Nachname bis auf die Initiale), Bildschirm zum Nachschwärzen, nur das geschwärzte Bild wird gespeichert (neue Ablage `fotos`), „Blatt ansehen“; AGENTS.md verweist wieder auf BLUEPRINT.md (Datei wurde umbenannt) |
| 0.17 | 2026-11-22 | Phase 6 gebaut: Ansicht „Blätter“ (Vorschaubilder nach Monat, neueste oben, Suche), große Ansicht mit Sprung zu Schülerübersicht und Termin, 📄-Symbol in der Hauptliste |
| 0.18 | 2026-11-22 | Phase 7 gebaut: Rückantwort per Foto oder PDF-Scan einlesen (über 📷 mit automatischer Zuordnung oder direkt im Termin), Nachname schwärzen, „unterschrieben“ abhaken, Anzeige in Liste/Termin/Übersicht/Blättern; Fehler behoben: Texterkennung verdickte Buchstaben bei textarmen Bildern |
| 0.19 | 2026-11-22 | Phase 8 gebaut: Datensicherung (Export als JSON-Datei inkl. geschwärzter Bilder, Teilen auf dem iPhone oder Download; Import mit „Zusammenführen“ oder „Alles ersetzen“; Erinnerung nach 14 Tagen). Damit sind alle 8 Bauphasen umgesetzt |
| 0.20 | 2026-11-22 | App als Claude-Artefakt veröffentlicht (zum Testen auf dem iPhone): Bibliotheken liegen jetzt in `vendor/`, eigene Rückfrage-/Meldefenster statt alert/confirm, Sicherung über die claude.ai-Speicherfunktion, Farben folgen auch der Hell/Dunkel-Wahl von claude.ai, Abstände für iPhone-Ränder; Bauskript `werkzeuge/artefakt-bauen.sh` |
| 0.21 | 2026-11-22 | Halbjahres-Felder in der Schülerübersicht immer sichtbar (auch ohne erfasste Zahlen, mit Knopf zum Eintragen); Bereich „Einträge und Halbjahr laut Blatt“ im Termin immer aufgeklappt; Artefakt aktualisiert (Version 2) |
| 0.22 | 2026-11-22 | Einlesen nicht nur per Kamera: Auswahl „Woher?“ mit Kamera, Fotos/Mediathek und Dateien (iCloud, OneDrive, USB, Downloads …), dazu Ziehen & Ablegen und Einfügen aus der Zwischenablage; Knopf heißt jetzt „📷 Einlesen“; Artefakt aktualisiert (Version 3) |
| 0.23 | 2026-11-22 | Fehler behoben: Speichern blieb seit v0.22 hängen (neue Auswahlknöpfe störten das Neuzeichnen der Liste); Speicherfehler werden jetzt angezeigt; Fotos werden als ArrayBuffer gespeichert (Safari/claude.ai); voller Nachname erscheint nicht mehr im Termin-Fenster (sofort „Vorname N.“); Erkennung toleranter bei durchgestrichener Uhrzeit (Uhrzeiten und Datum einzeln gesucht, „O“ statt 0). Handschrift erkennt die lokale Texterkennung weiterhin nicht. Artefakt Version 4 |
| 0.24 | 2026-11-22 | Entscheidung bestätigt: kein KI-Lesen für Handschrift, Texterkennung bleibt lokal |
| 0.25 | 2026-11-22 | Datensicherung hat einen festen Dateinamen `tadel-sicherung.json`, die neue ersetzt die alte; Hinweis im Dialog; Artefakt Version 5 |
| 0.26 | 2026-11-22 | Schwärzen: feste Namensregel für Adressfeld und Rückantwort (Vorname bleibt, Nachname nur Anfangsbuchstabe), auch ohne erkannten Namen; Zoom (−/+, 100–400 %) und Modus „Verschieben“ im Schwärzen-Fenster; mit Testblatt geprüft; Artefakt Version 6 |
| 0.27 | 2026-11-22 | Erweiterung geplant: digitales Klassenbuch mit Reitern Tadel/Klassenbuch/Listen, Klassen per WebUntis-Screenshot, Checklisten (Haken/Text/Geld mit Summe), Klassenbuch-Sammlung zu Stichtagen (TeacherTool-CSV, Untis-Screenshots) nach Fach und Stunde, Elternsprechtag, animierte Zufallsauswahl, Erinnerungen; Regel für gleiche Namen entschieden; Bauphasen 9–13 |
| 0.28 | 2026-11-22 | Phase 9 gebaut: Reiter Tadel/Klassenbuch/Listen, Klassen mit Fächern und Schülern (Text oder Screenshot, lokal gelesen), eindeutige Kürzel (weitere Buchstaben oder Nummern), Verbindung Tadel ↔ Klassenschüler, Klassen in der Datensicherung (Datenbank-Version 3); Artefakt Version 7 |
| 0.29 | 2026-11-22 | Phase 10 gebaut: Listen pro Klasse nach Bereich (Allgemein, Schwimmen, Fach …), Spalten Haken/Text/Geld (Soll + Summe)/Datum, „Noch offen“, „Wer fehlt noch?“, Vorlagen, Archivieren oder Löschen, Frist-Erinnerung; „+ Schüler“ und Entfernen per ×; Fehler behoben: Handy-Kartenansicht galt für alle Tabellen; Wünsche für Phase 11 notiert (Fächer ankreuzen, WebUntis-PDF); Datenbank-Version 4; Artefakt Version 8 |
| 0.30 | 2026-11-22 | Phase 11 gebaut: Klassenbuch-Sammlungen (CSV/TeacherTool, PDF/WebUntis-Bericht, Screenshot, von Hand, Tadel automatisch), Spalten-Zuordnung mit Vorschlag, Fach je Lehrkraft, Doppelte erkennen, Fächer ankreuzen, Ansicht pro Schüler nach Fach und Datum/Uhrzeit; Fehler behoben: App startete teils, bevor alle Skripte geladen waren; Datenbank-Version 5; Artefakt Version 9 |
| 0.31 | 2026-11-22 | TeacherTool-Schülerseiten per Screenshot (auch mehrere auf einmal, ein Fach pro Screenshot, Note + Kommentar), Texterkennung für dunkle Screenshots (Umkehren) und kleine Bilder (Vergrößern); Artefakt Version 10 |
| 0.32 | 2026-11-22 | Entscheidung: Einlesen der Klassenbuch-Einträge vorerst nicht nutzen (Funktion bleibt im Code) |
| 0.33 | 2026-11-22 | Daten gingen im Artefakt nach dem Neuöffnen verloren: App speichert dort jetzt zusätzlich privat bei claude.ai (Fähigkeit `db`) und gleicht beim Öffnen ab, mit Statusanzeige unten; neue Datei `wolke.js`; am PC mit nachgebautem Speicher geprüft (Hochladen, Wiederherstellen nach gelöschtem Browser-Speicher, Löschen, Fehleranzeige); Artefakt Version 11 |
| 0.34 | 2026-11-25 | Weitergabe an Kollegen: jede Person sieht über ihr eigenes Konto nur ihre eigenen Daten (war durch `data/users/<ID>` schon so, jetzt mit nachgebautem Speicher für zwei Konten geprüft); Hinweis bei Nur-Lesen-Zugang; Artefakt Version 12 |
| 0.35 | 2026-11-25 | Teilen-Code für Klassen begonnen (nicht veröffentlicht, ein Fehler beim Live-Abgleich offen); Erkenntnis: Artefakt bietet keine Rolle „Mitwirkender“ und keine eigene App-Adresse, deshalb Umzug auf eigene Adresse mit eigenem Speicher geplant |
| 0.36 | 2026-11-25 | App läuft unter eigener Adresse https://bp787.github.io/tadel/ (GitHub Pages, Repository bp787/tadel); dort liegen die Daten vorerst nur auf dem jeweiligen Gerät (kein Abgleich, kein Teilen), das Artefakt bleibt für den eigenen Abgleich iPhone/iPad; geprüft: Seite, Texterkennung und pdf.js werden ausgeliefert |
