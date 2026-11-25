'use strict';

/*
 * Phase 11: Klassenbuch-Sammlung zu Stichtagen (Notengebung, Elternsprechtag).
 * Einlesen aus TeacherTool (CSV), Untis/WebUntis (PDF-Bericht oder Screenshot) und von Hand;
 * die Tadel aus der App kommen automatisch dazu. Alles wird lokal gelesen.
 * Gespeichert werden nur Kürzel, Datum, Stunde, Fach, Text und Quelle – nie die Datei.
 * Eintrag: { id, schuelerId, name, datum, stunde, fach, text, quelle: 'teachertool'|'untis'|'andere'|'hand' }
 */

const QUELLEN_NAMEN = { teachertool: 'TT', untis: 'U', andere: '•', hand: '✎', tadel: '⚠' };
const QUELLEN_TITEL = { teachertool: 'TeacherTool', untis: 'Untis', andere: 'andere Quelle', hand: 'von Hand', tadel: 'Tadel aus der App' };
const OHNE_FACH = 'Ohne Fach';
const TADEL_FACH = 'Tadel';

let offeneSammlungId = null;
let sammlungSchueler = null; // Schlüssel des geöffneten Schülers
let sammlungFach = 'alle';
let sammlungSuche = '';

/* ---------- Fächer ---------- */

// Übliche Untis-Kürzel; passt dann zu den Fächern der Klasse („D“ -> „Deutsch“)
const FACH_KURZ = {
  D: 'Deutsch', DE: 'Deutsch', E: 'Englisch', EN: 'Englisch', M: 'Mathematik', MA: 'Mathematik',
  BI: 'Biologie', BIO: 'Biologie', GE: 'Geschichte', G: 'Geschichte', EK: 'Erdkunde', GEO: 'Erdkunde',
  PH: 'Physik', CH: 'Chemie', KU: 'Kunst', MU: 'Musik', SP: 'Sport', REL: 'Religion', KR: 'Religion',
  ER: 'Religion', PP: 'Praktische Philosophie', PL: 'Philosophie', PK: 'Politik', PO: 'Politik', SW: 'Sozialwissenschaften',
  F: 'Französisch', FR: 'Französisch', L: 'Latein', LA: 'Latein', S: 'Spanisch', IF: 'Informatik', INF: 'Informatik',
  NW: 'Naturwissenschaften', GL: 'Gesellschaftslehre', TC: 'Technik', WP: 'Wahlpflicht', KL: 'Klassenleitung',
};

function fachName(roh, klasse) {
  const t = String(roh || '').trim();
  if (!t) return '';
  const voll = FACH_KURZ[t.toUpperCase().replace(/[^A-ZÄÖÜ]/g, '')] || t;
  // An die Schreibweise der Klassen-Fächer angleichen („Mathe“ ~ „Mathematik“, „Engl.“ ~ „Englisch“)
  const kurz = voll.toLowerCase().replace(/\.$/, '');
  const treffer = (klasse?.faecher || []).find((f) => {
    const x = f.toLowerCase();
    return x === kurz || x.startsWith(kurz) || kurz.startsWith(x);
  });
  return treffer || voll;
}

/* ---------- Werte lesen ---------- */

function datumAus(text, bezug = heuteIso()) {
  const t = String(text || '');
  let m = t.match(/(20\d{2})-(\d{1,2})-(\d{1,2})/);
  if (m) return isoAusDeutsch(m[3], m[2], m[1]) || '';
  m = t.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (m) return isoAusDeutsch(m[1], m[2], m[3].length === 2 ? `20${m[3]}` : m[3]) || '';
  m = t.match(/(\d{1,2})\.(\d{1,2})\./);
  if (m) {
    // Ohne Jahr: das Jahr nehmen, bei dem das Datum nicht in der Zukunft liegt
    const jahr = Number(bezug.slice(0, 4));
    let iso = isoAusDeutsch(m[1], m[2], jahr);
    if (iso && iso > bezug) iso = isoAusDeutsch(m[1], m[2], jahr - 1);
    return iso || '';
  }
  return '';
}

function stundeAus(text) {
  const m = String(text || '').match(/\b(\d{1,2})\b/);
  return m && Number(m[1]) <= 12 ? Number(m[1]) : null;
}

const normText = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ß]/g, '');

/* ---------- Dateien in eine Tabelle verwandeln ---------- */

function dekodiere(puffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(puffer).replace(/^﻿/, '');
  } catch {
    // Ältere Windows-Programme speichern CSV als Windows-1252
    return new TextDecoder('windows-1252').decode(puffer);
  }
}

function leseCsv(text) {
  const ersteZeile = text.split(/\r?\n/).find((z) => z.trim()) || '';
  const zaehle = (z) => ersteZeile.split(z).length - 1;
  const trenner = [';', '\t', ','].sort((a, b) => zaehle(b) - zaehle(a))[0];
  const zeilen = [];
  let zeile = [];
  let feld = '';
  let inAnf = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inAnf) {
      if (c === '"' && text[i + 1] === '"') { feld += '"'; i++; } else if (c === '"') inAnf = false; else feld += c;
    } else if (c === '"') inAnf = true;
    else if (c === trenner) { zeile.push(feld); feld = ''; } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      zeile.push(feld); feld = '';
      if (zeile.some((x) => x.trim())) zeilen.push(zeile.map((x) => x.trim()));
      zeile = [];
    } else feld += c;
  }
  zeile.push(feld);
  if (zeile.some((x) => x.trim())) zeilen.push(zeile.map((x) => x.trim()));
  return zeilen;
}

// Wörter/Textstücke mit Position (x, x2, Zeichenhöhe) einer Zeile zu Zellen zusammenfassen
function zellenAusStuecken(stuecke) {
  const sortiert = [...stuecke].sort((a, b) => a.x - b.x);
  const zellen = [];
  for (const s of sortiert) {
    const letzte = zellen[zellen.length - 1];
    // Abstand größer als etwa 1,2 Zeichenhöhen -> neue Spalte
    if (letzte && s.x - letzte.x2 < s.h * 1.2) {
      letzte.text += (s.x - letzte.x2 > s.h * 0.15 ? ' ' : '') + s.text;
      letzte.x2 = Math.max(letzte.x2, s.x2);
    } else zellen.push({ x: s.x, x2: s.x2, text: s.text });
  }
  return zellen.filter((z) => z.text.trim());
}

// Zeilen aus Zellen -> Tabelle (Spalten nach der Überschrift ausgerichtet; umbrochene Texte zusammengeführt)
function tabelleAusZeilen(zeilen) {
  if (!zeilen.length) return [];
  let kopf = 0;
  zeilen.slice(0, 15).forEach((z, i) => { if (z.length > zeilen[kopf].length) kopf = i; });
  const anker = zeilen[kopf].map((z) => z.x);
  const kopfText = normText(zeilen[kopf].map((z) => z.text).join(''));
  const tabelle = [];
  for (const z of zeilen.slice(kopf)) {
    // Wiederholte Überschrift (z. B. auf Seite 2) überspringen
    if (tabelle.length && normText(z.map((c) => c.text).join('')) === kopfText) continue;
    const reihe = anker.map(() => '');
    for (const zelle of z) {
      // Zur nächstgelegenen Spalte (Spaltenanfang der Überschrift); Werte stehen nicht immer genau darunter
      let idx = 0;
      anker.forEach((a, i) => { if (Math.abs(a - zelle.x) < Math.abs(anker[idx] - zelle.x)) idx = i; });
      reihe[idx] = reihe[idx] ? `${reihe[idx]} ${zelle.text}` : zelle.text;
    }
    const vorige = tabelle[tabelle.length - 1];
    // Erste Spalte leer: Fortsetzung der vorigen Zeile (umbrochener Text)
    if (!reihe[0] && vorige && tabelle.length > 1) {
      reihe.forEach((wert, i) => { if (wert) vorige[i] = vorige[i] ? `${vorige[i]} ${wert}` : wert; });
    } else tabelle.push(reihe);
  }
  return tabelle;
}

async function pdfTabelle(datei) {
  await ladePdfJs();
  const pdf = await window.pdfjsLib.getDocument({ data: await datei.arrayBuffer() }).promise;
  const seiten = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const alleZeilen = [];
    seiten.push(alleZeilen);
    const seite = await pdf.getPage(p);
    const { items } = await seite.getTextContent();
    const stuecke = items
      .filter((i) => i.str && i.str.trim())
      .map((i) => ({ x: i.transform[4], x2: i.transform[4] + i.width, y: -i.transform[5], h: Math.abs(i.transform[3]) || 10, text: i.str }));
    // Nach Höhe in Zeilen gruppieren
    stuecke.sort((a, b) => a.y - b.y || a.x - b.x);
    const zeilen = [];
    for (const s of stuecke) {
      const z = zeilen[zeilen.length - 1];
      if (z && Math.abs(z.y - s.y) < s.h * 0.5) z.stuecke.push(s); else zeilen.push({ y: s.y, stuecke: [s] });
    }
    for (const z of zeilen) alleZeilen.push(zellenAusStuecken(z.stuecke));
  }
  pdf.destroy();
  // Ab Seite 2: Seitenkopf (Schule, Titel, Klasse …) bis einschließlich der wiederholten Überschrift weglassen
  const ersteSeite = seiten[0].filter((z) => z.length);
  let kopf = 0;
  ersteSeite.slice(0, 15).forEach((z, i) => { if (z.length > ersteSeite[kopf].length) kopf = i; });
  const kopfText = ersteSeite[kopf] ? normText(ersteSeite[kopf].map((c) => c.text).join('')) : '';
  const alle = [...ersteSeite];
  for (const seite of seiten.slice(1)) {
    const zeilen = seite.filter((z) => z.length);
    const idx = zeilen.findIndex((z) => normText(z.map((c) => c.text).join('')) === kopfText);
    alle.push(...(idx >= 0 ? zeilen.slice(idx + 1) : zeilen));
  }
  return tabelleAusZeilen(alle);
}

async function bildLesen(datei) {
  const { ocr, farbe } = await bereiteBildVor(datei);
  farbe.width = farbe.height = 0;
  const worker = await holeWorker();
  const { data } = await worker.recognize(ocr);
  ocr.width = ocr.height = 0;
  return data;
}

function bildTabelle(data) {
  const zeilen = (data.lines || []).map((l) => zellenAusStuecken((l.words || []).map((w) => ({
    x: w.bbox.x0, x2: w.bbox.x1, h: (w.bbox.y1 - w.bbox.y0) || 20, text: w.text,
  })))).filter((z) => z.length);
  return tabelleAusZeilen(zeilen);
}

/* ---------- TeacherTool: Schülerseite als Screenshot ---------- */

/*
 * Die Schülerseite zeigt oben „Nachname Vorname“ und „Kurs "5c Mint"“ (nur auf der ersten Seite),
 * darunter Kacheln und eine Liste wie „04.11.26 3 ( Gut beteiligt, eher lesen ) △1“ oder „13.10.26 2 △1“.
 * Gelesen werden nur Zeilen mit Datum und Note und/oder Kommentar in Klammern.
 */
function leseSchuelerseite(text) {
  const zeilen = text.split('\n').map((z) => z.trim()).filter(Boolean);
  let name = '';
  let fach = '';
  zeilen.forEach((z, i) => {
    const kurs = z.match(/Kurs\s*["„“”'«»]?\s*([^"“”'«»]+?)\s*["“”'«»]?\s*$/i);
    if (kurs && !fach) {
      // „5c Mint“ -> „Mint“ (Klasse vorne weglassen)
      fach = kurs[1].replace(/^\d{1,2}\s?[a-z]\b\s*/i, '').trim();
      if (i > 0) {
        name = zeilen[i - 1].replace(/[^\p{L}\s'-]/gu, ' ').replace(/\s+/g, ' ').trim()
          // Avatar-Kürzel davor („IbQu“) weglassen
          .replace(/^(\p{Lu}\p{Ll}?\p{Lu}\p{Ll}?|\p{L}{1,2})\s+(?=\p{L}{3})/u, '');
      }
    }
  });
  const gefunden = new Map();
  for (const z of zeilen) {
    if (/stand dieser|fehlzeit|fehlstunden|verspätung/i.test(z)) continue;
    // Datum TT.MM.JJ; die Erkennung klebt oft die Baumstriche davor („1104.11.26“) und die Note dahinter („263(“) an
    const m = z.match(/(\d{2})\.\s?(\d{2})\.\s?(20\d{2}|\d{2})(?![\d.])?\s*(.*)$/) || z.match(/(\d{2})\.\s?(\d{2})\.\s?(\d{2})(.*)$/);
    if (!m) continue;
    const datum = isoAusDeutsch(m[1], m[2], m[3].length === 2 ? `20${m[3]}` : m[3]);
    if (!datum) continue;
    const rest = m[4];
    const n = rest.match(/^([1-6]\s?[+-]?)(?=\s|\(|$)/);
    const note = n ? n[1].replace(/\s/g, '') : '';
    let kommentar = '';
    const auf = rest.indexOf('(');
    if (auf >= 0) {
      const zu = rest.lastIndexOf(')');
      kommentar = rest.slice(auf + 1, zu > auf ? zu : undefined)
        .replace(/^[^\p{L}\d]+/u, '') // Symbol (📄) vorne …
        .replace(/^(\p{L}|\p{Lu}{2})[^\p{L}\s]*\s+(?=\p{L}{2})/u, '') // … oder als Buchstaben gelesen („D Gut …“, „RB Meldungen“)
        .replace(/^[^\p{L}\d]+/u, '')
        .replace(/\s+/g, ' ').trim();
    }
    if (!note && !kommentar) continue;
    // Kachel und Liste zeigen denselben Eintrag: nur einmal, die längere Fassung behalten
    const schl = `${datum}|${note}`;
    const alt = gefunden.get(schl);
    if (!alt || kommentar.length > alt.kommentar.length) gefunden.set(schl, { datum, note, kommentar });
  }
  return { name, fach, eintraege: [...gefunden.values()].sort((a, b) => a.datum.localeCompare(b.datum)) };
}

const istSchuelerseite = (text, ergebnis) => ergebnis.eintraege.length >= 1
  && (/Kurs\s*["„“”']/i.test(text) || /Endnote|Halbjahr|Somi|Leistungen/i.test(text));

const dlgTT = document.getElementById('dlg-tt');

function oeffneSchuelerseiten(seiten) {
  const s = sammlungen.find((x) => x.id === offeneSammlungId);
  const k = klassen.find((x) => x.id === s?.klasseId);
  if (!s || !k) return;
  // Schüler aus der Kopfzeile erkennen (TeacherTool: „Nachname Vorname“, sonst andersherum)
  const kopfName = seiten.map((x) => x.name).find(Boolean) || '';
  let vorschlag = null;
  for (const reihe of ['nv', 'vn']) {
    const p = kopfName && zerlegeName(kopfName, reihe);
    if (p && !p.fehler) {
      const t = findeSchueler(`${p.vorname} ${p.nachname}`, k);
      if (t.schuelerId) { vorschlag = t.schuelerId; break; }
    }
  }
  const auswahl = document.getElementById('tt-schueler');
  auswahl.replaceChildren(el('option', { value: '' }, '– bitte wählen –'),
    ...[...k.schueler].sort((a, b) => vergleich.compare(a.name, b.name)).map((x) => el('option', { value: x.id }, x.name)));
  auswahl.value = vorschlag || (sammlungSchueler && k.schueler.some((x) => x.id === sammlungSchueler) ? sammlungSchueler : '');
  document.getElementById('tt-info').textContent = vorschlag
    ? 'Schüler aus der Kopfzeile erkannt. Bitte prüfen.'
    : 'Bitte den Schüler wählen (der Name stand nicht oder nicht lesbar auf dem Screenshot).';
  document.getElementById('im-faecher').replaceChildren(...[...new Set([...(k.faecher || []), ...Object.values(FACH_KURZ)])].map((f) => el('option', { value: f })));
  const box = document.getElementById('tt-bilder');
  box.replaceChildren(...seiten.map((seite, i) => {
    const fach = el('input', { type: 'text', class: 'tt-fach', list: 'im-faecher', autocomplete: 'off', placeholder: 'Fach dieses Screenshots' });
    fach.value = seite.fach ? fachName(seite.fach, k) : '';
    const liste = el('div', { class: 'tt-eintraege' }, ...seite.eintraege.map((e) => {
      const text = el('input', { type: 'text', class: 'tt-text', autocomplete: 'off', 'aria-label': `Eintrag vom ${datumKurz(e.datum)}` });
      text.value = e.note ? `Note ${e.note}${e.kommentar ? ` – ${e.kommentar}` : ''}` : e.kommentar;
      const haken = el('input', { type: 'checkbox', class: 'tt-haken', 'aria-label': 'übernehmen' });
      haken.checked = true;
      return el('label', { class: 'tt-zeile', 'data-datum': e.datum }, haken, el('span', { class: 'tt-datum' }, datumKurz(e.datum).slice(0, 6)), text);
    }));
    return el('section', { class: 'tt-bild' },
      el('h3', { class: 'kl-zwischen' }, `Screenshot ${i + 1}${seite.dateiname ? ` (${seite.dateiname})` : ''}: ${seite.eintraege.length} Einträge`),
      el('label', { class: 'im-fach-fest' }, 'Fach', fach),
      seite.eintraege.length ? liste : el('p', { class: 'hinweis' }, 'Keine Einträge mit Datum erkannt.'));
  }));
  document.getElementById('tt-fehler').textContent = '';
  dlgTT.showModal();
}

document.getElementById('tt-abbrechen').addEventListener('click', () => dlgTT.close());
document.getElementById('tt-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const s = sammlungen.find((x) => x.id === offeneSammlungId);
  const k = klassen.find((x) => x.id === s?.klasseId);
  const fehler = document.getElementById('tt-fehler');
  const schueler = k?.schueler.find((x) => x.id === document.getElementById('tt-schueler').value);
  if (!schueler) { fehler.textContent = 'Bitte den Schüler wählen.'; return; }
  const neu = [];
  for (const bild of document.querySelectorAll('#tt-bilder .tt-bild')) {
    const fach = fachName(bild.querySelector('.tt-fach').value, k);
    for (const z of bild.querySelectorAll('.tt-zeile')) {
      const text = z.querySelector('.tt-text').value.trim();
      if (!z.querySelector('.tt-haken').checked || !text) continue;
      neu.push({ id: neueId(), schuelerId: schueler.id, name: schueler.name, datum: z.dataset.datum, stunde: null, zeit: null, fach, von: null, text, quelle: 'teachertool' });
    }
  }
  const vorhanden = new Set(s.eintraege.map(eintragsSchluessel));
  const uebernommen = neu.filter((x) => !vorhanden.has(eintragsSchluessel(x)) && vorhanden.add(eintragsSchluessel(x)));
  dlgTT.close();
  sammlungSchueler = schueler.id;
  await aktualisiereSammlung({ ...s, eintraege: [...s.eintraege, ...uebernommen] });
  meldung(`${uebernommen.length} Einträge für ${schueler.name} übernommen${neu.length - uebernommen.length ? `, ${neu.length - uebernommen.length} doppelte übersprungen` : ''}.`);
});

/* ---------- Spalten zuordnen ---------- */

// WebUntis-Bericht „Klassenbucheinträge“: Name (Nachname Vorname), Datum (TT.MM.JJ), Zeit (HH:MM),
// Benutzer (Lehrkraft, kein Fach!), Eintragskategorie (2×), Text – lange Texte über mehrere Zeilen.
const FELDER = [
  { key: 'name', name: 'Name (ganzer Name)', muster: /^(sch(ü|ue)ler(in)?|name|person|sch(ü|ue)ler\/in|sch(ü|ue)ler\*innen)$/i },
  { key: 'vorname', name: 'Vorname', muster: /vorname|rufname/i },
  { key: 'nachname', name: 'Nachname', muster: /nachname|familienname|zuname/i },
  { key: 'datum', name: 'Datum', muster: /datum|date|^tag$|wann/i },
  { key: 'stunde', name: 'Stunde oder Uhrzeit', muster: /^(stunde|std\.?|h|ue|einheit|lesson|stunden|zeit|uhrzeit|beginn)$/i },
  { key: 'fach', name: 'Fach', muster: /fach|kurs|subject|unterricht|lehrfach/i },
  { key: 'lehrer', name: 'Lehrkraft (Benutzer)', muster: /benutzer|lehrer|lehrkraft|erfasst|verfasser/i },
  { key: 'art', name: 'Art / Kategorie', muster: /kategorie|eintragskat|^art$|^typ$|^grund$/i },
  { key: 'text', name: 'Eintrag / Text', muster: /^text$|^eintrag$|bemerkung|notiz|kommentar|inhalt|beschreibung|vermerk|anmerkung/i },
];

// Lehrkraft -> Fach (WebUntis nennt kein Fach); wird auf dem Gerät gemerkt
const ladeLehrerFach = () => { try { return JSON.parse(lokal('lehrerFach') || '{}'); } catch { return {}; } };

function rateZuordnung(tabelle, mitKopf) {
  const zuordnung = {};
  const spalten = tabelle[0]?.length || 0;
  const daten = mitKopf ? tabelle.slice(1) : tabelle;
  if (mitKopf) {
    for (const f of FELDER) {
      const idx = tabelle[0].findIndex((k, i) => f.muster.test(k.trim()) && !Object.values(zuordnung).includes(i));
      if (idx >= 0) zuordnung[f.key] = idx;
    }
  }
  // Nach Inhalt raten, was noch fehlt
  const anteil = (i, test) => daten.slice(0, 30).filter((r) => test(r[i] || '')).length / Math.max(1, Math.min(30, daten.length));
  const frei = () => [...Array(spalten).keys()].filter((i) => !Object.values(zuordnung).includes(i));
  if (zuordnung.datum == null) {
    const i = frei().find((x) => anteil(x, (v) => !!datumAus(v)) > 0.6);
    if (i != null) zuordnung.datum = i;
  }
  if (zuordnung.name == null && zuordnung.vorname == null) {
    const i = frei().find((x) => anteil(x, (v) => /^\p{Lu}[\p{L}'-]+,?\s+\p{Lu}[\p{L}'-]+/u.test(v)) > 0.6);
    if (i != null) zuordnung.name = i;
  }
  if (zuordnung.stunde == null) {
    const i = frei().find((x) => anteil(x, (v) => /^(\d{1,2}\.?(\s*-\s*\d{1,2}\.?)?|\d{1,2}:\d{2})$/.test(v.trim())) > 0.6);
    if (i != null) zuordnung.stunde = i;
  }
  if (zuordnung.text == null) {
    const laenge = (i) => daten.slice(0, 30).reduce((s, r) => s + (r[i] || '').length, 0);
    const i = frei().sort((a, b) => laenge(b) - laenge(a))[0];
    if (i != null && laenge(i) > 0) zuordnung.text = i;
  }
  return zuordnung;
}

// Name aus der Datei -> Schüler der Klasse (über das Kürzel); volle Namen werden nicht gespeichert
function findeSchueler(voll, klasse) {
  const kuerzel = kuerzelInKlasse(voll, klasse.name);
  const genau = klasse.schueler.find((s) => s.name === kuerzel);
  if (genau) return { schuelerId: genau.id, name: genau.name };
  const basis = klasse.schueler.filter((s) => basisName(s.name) === basisName(kuerzel));
  if (basis.length === 1) return { schuelerId: basis[0].id, name: basis[0].name };
  return { schuelerId: null, name: kuerzel };
}

function zeileAlsEintrag(reihe, zuordnung, klasse, { reihenfolge, fachFest, quelle, lehrerFach = {} }) {
  const wert = (k) => (zuordnung[k] != null ? (reihe[zuordnung[k]] || '').trim() : '');
  let voll = '';
  if (wert('vorname') || wert('nachname')) voll = `${wert('vorname')} ${wert('nachname')}`.trim();
  else if (wert('name')) {
    const p = zerlegeName(wert('name'), reihenfolge);
    if (p && !p.fehler) voll = p.fertig || `${p.vorname} ${p.nachname}`;
  }
  const datum = datumAus(wert('datum'));
  const textTeile = [wert('art'), wert('text')].filter(Boolean);
  if (!voll || voll.split(' ').length < 2 || !datum || !textTeile.length) return null;
  // „Zeit“ (08:15) oder „Stunde“ (3.)
  const sw = wert('stunde');
  const uhr = sw.match(/\b(\d{1,2}):(\d{2})\b/);
  const lehrer = wert('lehrer');
  return {
    id: neueId(),
    ...findeSchueler(voll, klasse),
    datum,
    stunde: uhr ? null : stundeAus(sw),
    zeit: uhr ? `${uhr[1].padStart(2, '0')}:${uhr[2]}` : null,
    fach: fachName(wert('fach') || lehrerFach[lehrer] || fachFest, klasse),
    von: lehrer || null,
    text: textTeile.join(': '),
    quelle,
  };
}

const eintragsSchluessel = (e) => `${e.schuelerId || e.name}|${e.datum}|${normText(e.text).slice(0, 25)}`;

// Felder „Fach je Lehrkraft“ (nur wenn eine Lehrkraft-Spalte, aber keine Fach-Spalte zugeordnet ist)
function baueLehrerFach() {
  const box = document.getElementById('im-lehrer');
  const z = leseZuordnung();
  box.replaceChildren();
  if (z.lehrer == null || z.fach != null) return;
  const { mitKopf } = importEinstellungen();
  const daten = mitKopf ? importTabelle.slice(1) : importTabelle;
  const namen = [...new Set(daten.map((r) => (r[z.lehrer] || '').trim()).filter(Boolean))].sort(vergleich.compare);
  if (!namen.length) return;
  const gemerkt = ladeLehrerFach();
  box.append(el('p', { class: 'kl-vorschau-titel' }, 'Fach je Lehrkraft (die Datei nennt kein Fach):'));
  for (const n of namen) {
    const feld = el('input', { type: 'text', list: 'im-faecher', autocomplete: 'off', 'data-lehrer': n, placeholder: 'Fach' });
    feld.value = gemerkt[n] || '';
    feld.addEventListener('input', zeigeImportVorschau);
    box.append(el('label', { class: 'im-feld' }, el('span', {}, n), feld));
  }
}

function leseLehrerFach() {
  const m = {};
  document.querySelectorAll('#im-lehrer input[data-lehrer]').forEach((f) => { if (f.value.trim()) m[f.dataset.lehrer] = f.value.trim(); });
  return m;
}

/* ---------- Fenster „Einträge übernehmen“ ---------- */

const dlgImport = document.getElementById('dlg-import');
let importTabelle = null;

function importEinstellungen() {
  return {
    mitKopf: document.getElementById('im-kopf').checked,
    reihenfolge: dlgImport.querySelector('input[name="im-reihe"]:checked')?.value || 'vn',
    fachFest: document.getElementById('im-fach').value.trim(),
    quelle: document.getElementById('im-quelle').value,
    lehrerFach: leseLehrerFach(),
  };
}

function leseZuordnung() {
  const z = {};
  dlgImport.querySelectorAll('.im-feld select').forEach((s) => { if (s.value !== '') z[s.dataset.feld] = Number(s.value); });
  return z;
}

function baueZuordnung(zuordnung) {
  const box = document.getElementById('im-zuordnung');
  const { mitKopf } = importEinstellungen();
  const kopf = importTabelle[0] || [];
  const beispiel = importTabelle[mitKopf ? 1 : 0] || [];
  const optionen = kopf.map((k, i) => {
    const titel = mitKopf && k ? k : `Spalte ${i + 1}`;
    const probe = (beispiel[i] || '').slice(0, 24);
    return { wert: String(i), text: probe && probe !== titel ? `${titel} (${probe})` : titel };
  });
  box.replaceChildren(...FELDER.map((f) => {
    const sel = el('select', { 'data-feld': f.key, 'aria-label': f.name },
      el('option', { value: '' }, '– keine –'), ...optionen.map((o) => el('option', { value: o.wert }, o.text)));
    sel.value = zuordnung[f.key] != null ? String(zuordnung[f.key]) : '';
    sel.addEventListener('change', () => { baueLehrerFach(); zeigeImportVorschau(); });
    return el('label', { class: 'im-feld' }, el('span', {}, f.name), sel);
  }));
}

function zeigeImportVorschau() {
  const s = sammlungen.find((x) => x.id === offeneSammlungId);
  const k = klassen.find((x) => x.id === s?.klasseId);
  const box = document.getElementById('im-vorschau');
  if (!s || !k) return;
  const einst = importEinstellungen();
  const zuordnung = leseZuordnung();
  const daten = einst.mitKopf ? importTabelle.slice(1) : importTabelle;
  const eintraege = daten.map((r) => zeileAlsEintrag(r, zuordnung, k, einst));
  const gut = eintraege.filter(Boolean);
  const unbekannt = gut.filter((e) => !e.schuelerId).length;
  box.replaceChildren(
    el('p', { class: 'hinweis' }, `${gut.length} von ${daten.length} Zeilen werden übernommen${unbekannt ? `, davon ${unbekannt} mit Namen, die nicht in der Klassenliste stehen (?)` : ''}.`
      + (gut.length < daten.length ? ' Zeilen ohne Name, Datum oder Text werden übersprungen.' : '')),
    el('div', { class: 'li-huelle' }, el('table', { class: 'li-tabelle im-tabelle' },
      el('thead', {}, el('tr', {}, ...['Name', 'Datum', 'Zeit', 'Fach', 'Eintrag'].map((t) => el('th', {}, t)))),
      el('tbody', {}, ...gut.slice(0, 6).map((e) => el('tr', {},
        el('td', {}, e.name + (e.schuelerId ? '' : ' ?')), el('td', {}, datumKurz(e.datum)), el('td', {}, e.zeit || (e.stunde != null ? `${e.stunde}.` : '')),
        el('td', {}, e.fach || '–'), el('td', { class: 'im-text' }, e.text))))),
    ),
  );
}

const istBild = (d) => /^image\//.test(d.type) || /\.(png|jpe?g|heic|heif|webp)$/i.test(d.name);

async function starteImport(datei, gelesen = null) {
  const s = sammlungen.find((x) => x.id === offeneSammlungId);
  if (!s) return;
  const status = (t) => zeigeToast(t);
  let tabelle;
  let quelle = 'andere';
  try {
    if (istPdf(datei)) {
      status('PDF wird gelesen …');
      tabelle = await pdfTabelle(datei);
      quelle = 'untis';
    } else if (istBild(datei)) {
      if (!gelesen) status('Bild wird gelesen … (beim ersten Mal etwas länger)');
      tabelle = bildTabelle(gelesen || await bildLesen(datei));
      quelle = 'untis';
    } else {
      tabelle = leseCsv(dekodiere(await datei.arrayBuffer()));
      quelle = 'teachertool';
    }
  } catch (err) {
    meldung(`Die Datei konnte nicht gelesen werden: ${err?.message || err}`);
    return;
  }
  if (!tabelle?.length) { meldung('In der Datei wurde keine Tabelle gefunden.'); return; }
  const breite = Math.max(...tabelle.map((r) => r.length));
  importTabelle = tabelle.map((r) => [...r, ...Array(breite - r.length).fill('')]);
  const k = klassen.find((x) => x.id === s.klasseId);
  document.getElementById('im-info').textContent = `„${datei.name}“: ${importTabelle.length} Zeilen, ${breite} Spalten. Prüfe die Zuordnung und die Vorschau.`;
  document.getElementById('im-quelle').value = quelle;
  document.getElementById('im-fach').value = '';
  document.getElementById('im-fehler').textContent = '';
  document.getElementById('im-faecher').replaceChildren(...[...new Set([...(k.faecher || []), ...Object.values(FACH_KURZ)])].map((f) => el('option', { value: f })));
  const kopfErkannt = importTabelle[0].some((z) => FELDER.some((f) => f.muster.test(z)));
  document.getElementById('im-kopf').checked = kopfErkannt;
  // WebUntis schreibt „Nachname Vorname“
  const reihe = quelle === 'untis' ? 'nv' : (lokal('namenReihe') === 'nv' ? 'nv' : 'vn');
  dlgImport.querySelector(`input[name="im-reihe"][value="${reihe}"]`).checked = true;
  baueZuordnung(rateZuordnung(importTabelle, kopfErkannt));
  baueLehrerFach();
  zeigeImportVorschau();
  dlgImport.showModal();
}

document.getElementById('im-kopf').addEventListener('change', () => { baueZuordnung(leseZuordnung()); zeigeImportVorschau(); });
dlgImport.querySelectorAll('input[name="im-reihe"]').forEach((r) => r.addEventListener('change', zeigeImportVorschau));
document.getElementById('im-fach').addEventListener('input', zeigeImportVorschau);
document.getElementById('im-quelle').addEventListener('change', zeigeImportVorschau);
document.getElementById('im-abbrechen').addEventListener('click', () => { importTabelle = null; dlgImport.close(); });

document.getElementById('im-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const s = sammlungen.find((x) => x.id === offeneSammlungId);
  const k = klassen.find((x) => x.id === s?.klasseId);
  if (!s || !k) return;
  const einst = importEinstellungen();
  const zuordnung = leseZuordnung();
  if (zuordnung.datum == null) { document.getElementById('im-fehler').textContent = 'Bitte die Spalte „Datum“ zuordnen.'; return; }
  if (zuordnung.name == null && zuordnung.vorname == null && zuordnung.nachname == null) { document.getElementById('im-fehler').textContent = 'Bitte die Namens-Spalte zuordnen.'; return; }
  if (zuordnung.text == null && zuordnung.art == null) { document.getElementById('im-fehler').textContent = 'Bitte die Spalte mit dem Eintrag zuordnen.'; return; }
  const daten = einst.mitKopf ? importTabelle.slice(1) : importTabelle;
  const neu = daten.map((r) => zeileAlsEintrag(r, zuordnung, k, einst)).filter(Boolean);
  // Zuordnung Lehrkraft -> Fach für das nächste Mal merken
  if (Object.keys(einst.lehrerFach).length) lokal('lehrerFach', JSON.stringify({ ...ladeLehrerFach(), ...einst.lehrerFach }));
  // Doppelte (gleicher Schüler, gleicher Tag, gleicher Textanfang) nur einmal, auch über Quellen hinweg
  const vorhanden = new Set(s.eintraege.map(eintragsSchluessel));
  const uebernommen = [];
  let doppelt = 0;
  for (const eintrag of neu) {
    const schl = eintragsSchluessel(eintrag);
    if (vorhanden.has(schl)) { doppelt++; continue; }
    vorhanden.add(schl);
    uebernommen.push(eintrag);
  }
  await aktualisiereSammlung({ ...s, eintraege: [...s.eintraege, ...uebernommen] });
  importTabelle = null;
  dlgImport.close();
  meldung(`${uebernommen.length} Einträge übernommen${doppelt ? `, ${doppelt} doppelte übersprungen` : ''}.`
    + (daten.length - neu.length ? ` ${daten.length - neu.length} Zeilen ohne Name, Datum oder Text wurden übersprungen.` : ''));
});

// Screenshots: erst prüfen, ob es TeacherTool-Schülerseiten sind (mehrere auf einmal möglich), sonst als Tabelle
async function liesScreenshots(bilder) {
  const seiten = [];
  const andere = [];
  for (const [i, d] of bilder.entries()) {
    zeigeToast(`Screenshot ${i + 1} von ${bilder.length} wird gelesen … (beim ersten Mal etwas länger)`);
    try {
      const data = await bildLesen(d);
      const erg = leseSchuelerseite(data.text);
      if (istSchuelerseite(data.text, erg)) seiten.push({ ...erg, dateiname: bilder.length > 1 ? d.name : '' });
      else andere.push({ d, data });
    } catch (err) {
      meldung(`„${d.name}“ konnte nicht gelesen werden: ${err?.message || err}`);
      return;
    }
  }
  if (seiten.length) {
    oeffneSchuelerseiten(seiten);
    if (andere.length) zeigeToast(`${andere.length} Screenshot(s) waren keine Schülerseite und wurden übergangen.`);
  } else if (andere.length === 1) {
    starteImport(andere[0].d, andere[0].data);
  } else {
    meldung('In den Screenshots wurden keine Einträge erkannt. Tipp: Bei einer Tabelle (z. B. Untis) einen Screenshot nach dem anderen einlesen.');
  }
}

document.getElementById('sa-datei').addEventListener('change', (e) => {
  const dateien = [...(e.target.files || [])];
  if (!dateien.length) return;
  if (dateien.every(istBild)) { liesScreenshots(dateien); return; }
  if (dateien.length > 1) zeigeToast('Mehrere Dateien auf einmal gehen nur bei Screenshots – es wird die erste gelesen.');
  starteImport(dateien[0]);
});

/* ---------- Speichern ---------- */

async function aktualisiereSammlung(s) {
  await speichereSammlung(s);
  sammlungen = await ladeSammlungen();
  zeichne();
}

/* ---------- Ansicht im Reiter „Klassenbuch“ ---------- */

const offeneSammlung = () => {
  const s = sammlungen.find((x) => x.id === offeneSammlungId);
  return s && klassen.some((k) => k.id === s.klasseId) ? s : null;
};

function sammlungsBereich(k) {
  const meine = sammlungen.filter((s) => s.klasseId === k.id).sort((a, b) => (b.erstellt || '').localeCompare(a.erstellt || ''));
  const box = el('section', { class: 'sammlungen' },
    el('div', { class: 'listen-kopf' },
      el('h3', {}, 'Einträge sammeln'),
      el('button', { type: 'button', class: 'btn btn-primary btn-klein', onclick: () => neueSammlung(k) }, '+ Sammlung')),
    el('p', { class: 'hinweis' }, 'Vor Notengebung oder Elternsprechtag: Einträge aus TeacherTool (CSV), Untis (PDF-Bericht oder Screenshot) und die Tadel zusammenführen, pro Schüler nach Fach und Stunde sortiert. Danach kannst du die Sammlung wieder löschen.'),
  );
  if (meine.length) {
    box.append(el('div', { class: 'listen-raster' }, ...meine.map((s) => el('button', {
      type: 'button', class: 'liste-karte fertig sammlung-karte',
      onclick: () => { offeneSammlungId = s.id; sammlungSchueler = null; sammlungFach = 'alle'; sammlungSuche = ''; zeichne(); window.scrollTo(0, 0); },
    }, el('span', { class: 'lk-titel' }, s.titel), el('span', { class: 'lk-frist' }, `${s.eintraege.length} Einträge · angelegt ${datumKurz(s.erstellt.slice(0, 10))}`)))));
  }
  return box;
}

async function neueSammlung(k) {
  const titel = await eingabe(`Neue Sammlung für ${k.name} – Titel:`, { wert: `Sammlung vom ${datumKurz(heuteIso())}`, platzhalter: 'z. B. Elternsprechtag 1. Halbjahr' });
  if (!titel) return;
  const s = { id: neueId(), klasseId: k.id, titel, erstellt: new Date().toISOString(), faecherAuswahl: null, eintraege: [] };
  offeneSammlungId = s.id;
  sammlungSchueler = null;
  await aktualisiereSammlung(s);
}

// Tadel aus der App als Einträge (werden nicht gespeichert, sondern immer aktuell berechnet)
function tadelEintraege(k) {
  const erg = [];
  for (const t of termine) {
    const s = k.schueler.find((x) => gehoertZu(t, x.name, k.name));
    if (!s && klassenSchluessel(t.klasse) !== klassenSchluessel(k.name)) continue;
    const woche = t.woche ? ARTEN.filter((a) => t.woche[a.key]).map((a) => `${a.name} ${t.woche[a.key]}`).join(', ') : '';
    const refl = t.erschienen ? 'Reflexionsstunde besucht' : 'Reflexionsstunde nicht besucht';
    erg.push({
      id: `tadel-${t.id}`, schuelerId: s?.id || null, name: s?.name || t.name, datum: tadelDatumVon(t), stunde: null,
      fach: TADEL_FACH, text: `Tadel${woche ? ` (Woche: ${woche})` : ''} · ${refl}`, quelle: 'tadel',
    });
  }
  return erg;
}

function alleFaecher(s, k, eintraege) {
  const eigene = (k.faecher || []).map((f) => fachName(f, k));
  const vorkommend = eintraege.map((e) => e.fach || OHNE_FACH);
  return [...new Set([...eigene, ...vorkommend])].sort((a, b) => {
    const rang = (x) => (x === TADEL_FACH ? 2 : x === OHNE_FACH ? 3 : eigene.includes(x) ? 0 : 1);
    return rang(a) - rang(b) || vergleich.compare(a, b);
  });
}

function gewaehlteFaecher(s, k, faecher) {
  if (Array.isArray(s.faecherAuswahl)) return new Set(s.faecherAuswahl);
  // Vorauswahl: meine Fächer + Tadel; hat die Klasse keine Fächer eingetragen, alle
  const eigene = (k.faecher || []).map((f) => fachName(f, k));
  if (!eigene.length) return new Set(faecher);
  return new Set([...eigene, TADEL_FACH]);
}

function zeichneSammlung(bereich, s) {
  const k = klassen.find((x) => x.id === s.klasseId);
  const alle = [...s.eintraege, ...tadelEintraege(k)];
  const faecher = alleFaecher(s, k, alle);
  const auswahl = gewaehlteFaecher(s, k, faecher);
  const sichtbar = alle.filter((e) => auswahl.has(e.fach || OHNE_FACH));

  bereich.append(
    el('button', { type: 'button', class: 'btn btn-klein zurueck', onclick: () => { offeneSammlungId = null; zeichne(); } }, `← Klasse ${k.name}`),
    el('div', { class: 'liste-titel' },
      el('h2', {}, s.titel),
      el('p', { class: 'hinweis' }, `Klasse ${k.name} · ${s.eintraege.length} eingelesene Einträge · ${alle.length - s.eintraege.length} Tadel · angelegt ${datumKurz(s.erstellt.slice(0, 10))}`)),
    el('div', { class: 'liste-knoepfe' },
      el('button', { type: 'button', class: 'btn btn-primary btn-klein', onclick: () => { const f = document.getElementById('sa-datei'); f.value = ''; f.click(); } }, '📥 Datei einlesen'),
      el('button', { type: 'button', class: 'btn btn-klein', onclick: () => oeffneEintrag(s, k) }, '+ Eintrag'),
      el('button', {
        type: 'button', class: 'btn btn-klein', onclick: async () => {
          const titel = await eingabe('Neuer Titel der Sammlung:', { wert: s.titel });
          if (titel) await aktualisiereSammlung({ ...s, titel });
        },
      }, '✎ Umbenennen'),
      el('button', {
        type: 'button', class: 'btn btn-klein btn-gefahr', onclick: async () => {
          if (!(await frage(`Sammlung „${s.titel}“ mit ${s.eintraege.length} Einträgen löschen? Die Tadel bleiben erhalten.`, { ja: 'Löschen', gefahr: true }))) return;
          await entferneSammlung(s.id);
          sammlungen = await ladeSammlungen();
          offeneSammlungId = null;
          zeichne();
        },
      }, '🗑 Löschen'),
    ),
    el('p', { class: 'hinweis' }, '📥 nimmt CSV (TeacherTool), PDF (WebUntis-Bericht) und Screenshots an – bei TeacherTool-Schülerseiten auch mehrere Screenshots auf einmal (ein Screenshot pro Kurs).'),
  );

  // Fächer ankreuzen
  const zaehle = (f) => alle.filter((e) => (e.fach || OHNE_FACH) === f).length;
  const fachBox = el('fieldset', { class: 'fach-auswahl' }, el('legend', {}, 'Welche Fächer gehören dazu?'));
  for (const f of faecher) {
    const haken = el('input', { type: 'checkbox' });
    haken.checked = auswahl.has(f);
    haken.addEventListener('change', async () => {
      const neu = new Set(auswahl);
      if (haken.checked) neu.add(f); else neu.delete(f);
      if (sammlungFach !== 'alle' && !neu.has(sammlungFach)) sammlungFach = 'alle';
      await aktualisiereSammlung({ ...s, faecherAuswahl: [...neu] });
    });
    fachBox.append(el('label', { class: `fach-haken${(k.faecher || []).some((x) => fachName(x, k) === f) ? ' eigen' : ''}` }, haken, ` ${f} `, el('small', {}, `(${zaehle(f)})`)));
  }
  bereich.append(fachBox);

  if (sammlungSchueler) zeichneSammlungsSchueler(bereich, s, k, sichtbar, faecher.filter((f) => auswahl.has(f)));
  else zeichneSammlungsUebersicht(bereich, s, k, sichtbar);
}

const schuelerSchluessel = (e) => e.schuelerId || `?${e.name}`;

function zeichneSammlungsUebersicht(bereich, s, k, sichtbar) {
  const suche = el('input', { type: 'search', class: 'suche', placeholder: 'Name eintippen …', autocomplete: 'off', 'aria-label': 'Schüler suchen' });
  suche.value = sammlungSuche;
  const liste = el('div', { class: 'sammlung-schueler' });
  const zeichneListe = () => {
    liste.replaceChildren();
    const text = sammlungSuche.trim().toLowerCase();
    // Alle Schüler der Klasse, dazu Namen aus den Einträgen, die nicht in der Klassenliste stehen
    const eintraege = new Map();
    for (const e of sichtbar) {
      const schl = schuelerSchluessel(e);
      if (!eintraege.has(schl)) eintraege.set(schl, []);
      eintraege.get(schl).push(e);
    }
    const personen = [
      ...k.schueler.map((x) => ({ schl: x.id, name: x.name, bekannt: true })),
      ...[...eintraege.keys()].filter((x) => x.startsWith('?')).map((x) => ({ schl: x, name: x.slice(1), bekannt: false })),
    ].filter((p) => !text || p.name.toLowerCase().includes(text))
      .sort((a, b) => (a.bekannt === b.bekannt ? vergleich.compare(a.name, b.name) : a.bekannt ? -1 : 1));
    if (!personen.length) { liste.append(el('p', { class: 'leer' }, 'Kein Schüler gefunden.')); return; }
    for (const p of personen) {
      const seine = eintraege.get(p.schl) || [];
      const proFach = new Map();
      for (const e of seine) proFach.set(e.fach || OHNE_FACH, (proFach.get(e.fach || OHNE_FACH) || 0) + 1);
      liste.append(el('button', {
        type: 'button', class: 'sammlung-zeile',
        onclick: () => { sammlungSchueler = p.schl; sammlungFach = 'alle'; zeichne(); window.scrollTo(0, 0); },
      },
      el('span', { class: 'sz-name' }, p.name + (p.bekannt ? '' : ' ?')),
      el('span', { class: 'sz-zahl' }, String(seine.length)),
      el('span', { class: 'sz-faecher' }, ...[...proFach].map(([f, n]) => el('span', { class: `sz-fach${f === TADEL_FACH ? ' tadel' : ''}` }, `${f} ${n}`)))));
    }
  };
  suche.addEventListener('input', () => { sammlungSuche = suche.value; zeichneListe(); });
  bereich.append(el('section', { class: 'werkzeuge' }, suche), liste);
  zeichneListe();
}

const wochentag = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('de-DE', { weekday: 'short' });
// Sortierung: Datum, dann Uhrzeit bzw. Stunde (Stunde n ≈ eine Uhrzeit, damit beides zusammen passt)
const zeitSchluessel = (e) => e.zeit || (e.stunde != null ? `${String(7 + e.stunde).padStart(2, '0')}:00` : '99:99');
const nachZeit = (a, b) => a.datum.localeCompare(b.datum) || zeitSchluessel(a).localeCompare(zeitSchluessel(b));

function zeichneSammlungsSchueler(bereich, s, k, sichtbar, faecher) {
  const seine = sichtbar.filter((e) => schuelerSchluessel(e) === sammlungSchueler);
  const name = k.schueler.find((x) => x.id === sammlungSchueler)?.name || sammlungSchueler.replace(/^\?/, '');
  bereich.append(
    el('button', { type: 'button', class: 'btn btn-klein zurueck', onclick: () => { sammlungSchueler = null; zeichne(); } }, '← Alle Schüler'),
    el('h3', { class: 'sammlung-name' }, `${name} · ${seine.length} ${seine.length === 1 ? 'Eintrag' : 'Einträge'}`),
  );
  // Zwischen den Fächern umschalten oder alle zusammen sehen
  const vorhandene = faecher.filter((f) => seine.some((e) => (e.fach || OHNE_FACH) === f));
  if (sammlungFach !== 'alle' && !vorhandene.includes(sammlungFach)) sammlungFach = 'alle';
  bereich.append(el('div', { class: 'chips fach-chips' },
    ...['alle', ...vorhandene].map((f) => el('button', {
      type: 'button', class: 'chip', 'aria-pressed': String(sammlungFach === f),
      onclick: () => { sammlungFach = f; zeichne(); },
    }, f === 'alle' ? `Alle (${seine.length})` : `${f} (${seine.filter((e) => (e.fach || OHNE_FACH) === f).length})`))));
  if (!seine.length) { bereich.append(el('p', { class: 'leer' }, 'Keine Einträge in den angekreuzten Fächern.')); return; }
  const gruppen = sammlungFach === 'alle' ? vorhandene : [sammlungFach];
  for (const f of gruppen) {
    const liste = seine.filter((e) => (e.fach || OHNE_FACH) === f).sort(nachZeit);
    bereich.append(el('h4', { class: 'listen-bereich' }, `${f} (${liste.length})`), el('div', { class: 'eintrags-liste' }, ...liste.map((e) => el('div', { class: `eintrag${e.quelle === 'tadel' ? ' tadel' : ''}` },
      el('span', { class: 'ei-zeit' }, `${wochentag(e.datum)} ${datumKurz(e.datum).slice(0, 6)}${e.zeit ? ` · ${e.zeit}` : e.stunde != null ? ` · ${e.stunde}. Std.` : ''}`),
      el('span', { class: 'ei-text' }, e.text, e.von ? el('small', { class: 'ei-von' }, ` – ${e.von}`) : null),
      el('span', { class: 'ei-quelle', title: QUELLEN_TITEL[e.quelle] || '' }, QUELLEN_NAMEN[e.quelle] || ''),
      e.quelle === 'tadel' ? el('span') : el('button', {
        type: 'button', class: 'z-weg', 'aria-label': 'Eintrag löschen', title: 'Eintrag löschen',
        onclick: async () => {
          if (!(await frage('Diesen Eintrag aus der Sammlung löschen?', { ja: 'Löschen', gefahr: true }))) return;
          await aktualisiereSammlung({ ...s, eintraege: s.eintraege.filter((x) => x.id !== e.id) });
        },
      }, '×'),
    ))));
  }
}

/* ---------- Eintrag von Hand ---------- */

const dlgEintrag = document.getElementById('dlg-eintrag');

function oeffneEintrag(s, k) {
  const auswahl = document.getElementById('et-schueler');
  auswahl.replaceChildren(...[...k.schueler].sort((a, b) => vergleich.compare(a.name, b.name)).map((x) => el('option', { value: x.id }, x.name)));
  if (sammlungSchueler && k.schueler.some((x) => x.id === sammlungSchueler)) auswahl.value = sammlungSchueler;
  document.getElementById('et-datum').value = heuteIso();
  document.getElementById('et-stunde').value = '';
  document.getElementById('et-fach').value = sammlungFach !== 'alle' ? sammlungFach : (k.faecher?.[0] || '');
  document.getElementById('et-text').value = '';
  document.getElementById('et-fehler').textContent = '';
  document.getElementById('im-faecher').replaceChildren(...[...new Set([...(k.faecher || []), ...Object.values(FACH_KURZ)])].map((f) => el('option', { value: f })));
  dlgEintrag.showModal();
  document.getElementById('et-form').onsubmit = async (e) => {
    e.preventDefault();
    const schueler = k.schueler.find((x) => x.id === auswahl.value);
    const datum = document.getElementById('et-datum').value;
    const text = document.getElementById('et-text').value.trim();
    if (!schueler || !datum || !text) { document.getElementById('et-fehler').textContent = 'Bitte Schüler, Datum und Eintrag angeben.'; return; }
    const eintrag = {
      id: neueId(), schuelerId: schueler.id, name: schueler.name, datum,
      stunde: stundeAus(document.getElementById('et-stunde').value), fach: fachName(document.getElementById('et-fach').value, k), text, quelle: 'hand',
    };
    dlgEintrag.close();
    const aktuell = sammlungen.find((x) => x.id === s.id) || s;
    await aktualisiereSammlung({ ...aktuell, eintraege: [...aktuell.eintraege, eintrag] });
  };
}
document.getElementById('et-abbrechen').addEventListener('click', () => dlgEintrag.close());
