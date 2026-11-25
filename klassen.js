'use strict';

/*
 * Phase 9: Reiter (Tadel · Klassenbuch · Listen) und Klassen mit Schülern.
 * Eine Klasse: { id, name: '05c', faecher: ['Deutsch', …], schueler: [{ id, name: 'Max M.' }], erstellt }.
 * Schülernamen kommen per Screenshot (z. B. WebUntis) oder als Text; gespeichert wird nur das Kürzel
 * (Regel in bildeKuerzel, app.js). Volle Namen und Bilder werden nie gespeichert.
 */

const REITER = {
  tadel: { titel: 'Reflexionsstunden' },
  klassenbuch: { titel: 'Klassenbuch' },
  listen: { titel: 'Listen' },
};
let reiter = REITER[lokal('reiter')] ? lokal('reiter') : 'tadel';
let gewaehlteKlasse = lokal('klasse');
let klassenSuche = '';

const sortierteKlassen = () => [...klassen].sort((a, b) => vergleich.compare(a.name, b.name));
const aktuelleKlasse = () => klassen.find((k) => k.id === gewaehlteKlasse) || sortierteKlassen()[0] || null;
const tadelAnzahl = (schuelerName, klasse) => termine.filter((t) => gehoertZu(t, schuelerName, klasse)).length;

/* ---------- Reiter ---------- */

function zeichneReiter() {
  document.querySelectorAll('.reiter-knopf').forEach((k) => k.setAttribute('aria-pressed', String(k.dataset.reiter === reiter)));
  for (const name of Object.keys(REITER)) document.getElementById(`bereich-${name}`).hidden = name !== reiter;
  document.getElementById('titel').textContent = REITER[reiter].titel;
  document.title = reiter === 'tadel' ? 'Tadelverwaltung' : `${REITER[reiter].titel} · Tadelverwaltung`;
  // Kopf-Knöpfe passend zum Reiter
  document.getElementById('btn-foto').hidden = reiter !== 'tadel';
  document.getElementById('btn-neu').hidden = reiter !== 'tadel';
  document.getElementById('btn-klasse-neu').hidden = reiter === 'tadel';
  if (typeof zeichneErinnerungen === 'function') zeichneErinnerungen();
  if (reiter === 'klassenbuch') zeichneKlassenbuch();
  if (reiter === 'listen') zeichneListen();
}

document.querySelectorAll('.reiter-knopf').forEach((k) => k.addEventListener('click', () => {
  reiter = k.dataset.reiter;
  lokal('reiter', reiter);
  zeichne(); // zeichnet auch die Reiter
  window.scrollTo(0, 0);
}));
document.getElementById('btn-klasse-neu').addEventListener('click', () => oeffneKlasse(null));

/* ---------- Bausteine ---------- */

function keineKlasse(bereich, text) {
  bereich.append(el('div', { class: 'leer-karte' },
    el('p', {}, text),
    el('button', { type: 'button', class: 'btn btn-primary', onclick: () => oeffneKlasse(null) }, '+ Klasse anlegen'),
    codeKnopf(),
  ));
}

// „🔗 Code eingeben“: geteilte Klasse einer Kollegin übernehmen (wolke.js)
function codeKnopf() {
  if (typeof kannTeilen !== 'function' || !kannTeilen()) return null;
  return el('button', { type: 'button', class: 'btn btn-klein', onclick: () => trittGeteiltBei() }, '🔗 Code eingeben');
}

function klassenWahl(k) {
  const leiste = el('div', { class: 'chips klassen-chips', role: 'group', 'aria-label': 'Klasse wählen' });
  for (const x of sortierteKlassen()) {
    leiste.append(el('button', {
      type: 'button',
      class: 'chip',
      'aria-pressed': String(x.id === k.id),
      onclick: () => { gewaehlteKlasse = x.id; lokal('klasse', x.id); zeichneReiter(); },
    }, x.geteilt ? `${x.name} 🔗` : x.name));
  }
  const code = codeKnopf();
  if (code) leiste.append(code);
  return leiste;
}

function klassenKopf(k) {
  const kopf = el('div', { class: 'klasse-kopf' },
    el('div', {},
      el('h2', {}, `Klasse ${k.name}`),
      el('p', { class: 'hinweis' }, `${k.schueler.length} Schüler${k.faecher?.length ? ` · ${k.faecher.join(', ')}` : ' · noch keine Fächer eingetragen'}`),
    ),
    el('div', { class: 'klasse-kopf-knoepfe' },
      el('button', { type: 'button', class: 'btn btn-klein', onclick: () => schuelerHinzufuegen(k) }, '+ Schüler'),
      el('button', { type: 'button', class: 'btn btn-klein', onclick: () => oeffneKlasse(k) }, '✎ Bearbeiten'),
      // Teilen-Code (wolke.js), nur in der App bei claude.ai
      typeof kannTeilen === 'function' && kannTeilen()
        ? el('button', {
          type: 'button',
          class: `btn btn-klein${k.geteilt ? ' btn-geteilt' : ''}`,
          onclick: () => (k.geteilt ? geteiltMenue(k) : teileKlasse(k)),
        }, k.geteilt ? (k.geteiltVon === wolke.uid ? '🔗 Geteilt' : '🔗 Mit dir geteilt') : '🔗 Teilen')
        : null,
    ),
  );
  return kopf;
}

// Einzelnen Schüler ergänzen (z. B. neu im Schuljahr). Kürzel nach derselben Regel wie beim Anlegen.
async function schuelerHinzufuegen(k) {
  const reihe = lokal('namenReihe') === 'nv' ? 'nv' : 'vn';
  const voll = await eingabe(`Neuer Schüler in Klasse ${k.name} (${reihe === 'nv' ? 'Nachname Vorname' : 'Vorname Nachname'}):`, {
    platzhalter: reihe === 'nv' ? 'Mustermann Max' : 'Max Mustermann',
  });
  if (!voll) return;
  const neu = zerlegeName(voll, reihe);
  if (!neu || neu.fehler) { meldung('Bitte Vor- und Nachnamen eingeben.'); return; }
  const vorhandene = k.schueler.map((s) => zerlegeName(s.name, 'vn'));
  const kuerzel = bildeKuerzel([...vorhandene, neu]);
  const name = kuerzel[kuerzel.length - 1];
  if (k.schueler.some((s) => s.name === name)) {
    meldung(`„${name}“ gibt es in der Klasse schon. Über „✎ Bearbeiten“ kannst du die Namen anpassen (z. B. „${name.replace(/\.$/, '')} 2“ oder ein weiterer Buchstabe).`);
    return;
  }
  const klasse = { ...k, schueler: [...k.schueler, { id: neueId(), name }] };
  await speichereKlasse(klasse);
  klassen = await ladeKlassen();
  zeichne();
  zeigeToast(`${name} zur Klasse ${k.name} hinzugefügt.`);
}

function schuelerKnopf(s, k, mitKlasse = false) {
  const n = tadelAnzahl(s.name, k.name);
  return el('button', { type: 'button', class: 'schueler-knopf', onclick: () => oeffneSchueler(s.name, k.name) },
    el('span', { class: 'sk-name' }, s.name),
    mitKlasse ? el('span', { class: 'sk-klasse' }, k.name) : null,
    n ? el('span', { class: 'sk-tadel', title: `${n} Tadel` }, `${n} Tadel`) : null,
  );
}

/* ---------- Reiter „Klassenbuch“ ---------- */

function zeichneKlassenbuch() {
  const bereich = document.getElementById('bereich-klassenbuch');
  bereich.replaceChildren();
  if (!klassen.length) {
    keineKlasse(bereich, 'Lege zuerst eine Klasse an. Die Schülernamen kannst du per Screenshot aus WebUntis übernehmen oder als Text einfügen.');
    return;
  }
  // Eine geöffnete Sammlung füllt den ganzen Reiter
  const sammlung = offeneSammlung();
  if (sammlung) { zeichneSammlung(bereich, sammlung); return; }
  const suche = el('input', {
    type: 'search', class: 'suche', placeholder: 'Schüler suchen (alle Klassen)', autocomplete: 'off', 'aria-label': 'Schüler suchen',
  });
  suche.value = klassenSuche;
  const inhalt = el('div', { class: 'kb-inhalt' });
  suche.addEventListener('input', () => { klassenSuche = suche.value; zeichneKlassenbuchInhalt(inhalt); });
  bereich.append(el('section', { class: 'werkzeuge' }, suche), inhalt);
  zeichneKlassenbuchInhalt(inhalt);
}

function zeichneKlassenbuchInhalt(inhalt) {
  inhalt.replaceChildren();
  const text = klassenSuche.trim().toLowerCase();
  if (text) {
    const treffer = [];
    for (const k of sortierteKlassen()) {
      for (const s of k.schueler) if (s.name.toLowerCase().includes(text)) treffer.push({ s, k });
    }
    if (!treffer.length) { inhalt.append(el('p', { class: 'leer' }, `Kein Schüler gefunden für „${klassenSuche.trim()}“.`)); return; }
    inhalt.append(el('div', { class: 'schueler-raster' }, ...treffer.map(({ s, k }) => schuelerKnopf(s, k, true))));
    return;
  }
  const k = aktuelleKlasse();
  inhalt.append(klassenWahl(k), klassenKopf(k));
  if (!k.schueler.length) {
    inhalt.append(el('p', { class: 'leer' }, 'Noch keine Schüler. Über „✎ Bearbeiten“ per Screenshot oder Text eintragen.'));
  } else {
    const sortiert = [...k.schueler].sort((a, b) => vergleich.compare(a.name, b.name));
    inhalt.append(el('div', { class: 'schueler-raster' }, ...sortiert.map((s) => schuelerKnopf(s, k))));
  }
  // Tadel dieser Klasse, deren Name nicht in der Klassenliste steht (z. B. Tippfehler)
  const fremd = [...new Set(termine
    .filter((t) => klassenSchluessel(t.klasse) === klassenSchluessel(k.name))
    .filter((t) => !k.schueler.some((s) => gehoertZu(t, s.name, k.name)))
    .map((t) => t.name))];
  if (fremd.length) {
    inhalt.append(el('p', { class: 'hinweis kb-fremd' },
      `Tadel mit Namen, die nicht in der Klassenliste stehen: ${fremd.sort(vergleich.compare).join(', ')} – `
      + 'bitte die Schreibweise im Termin oder in der Klassenliste prüfen.'));
  }
  // Phase 11: Sammlungen der Klasse (sammlung.js)
  inhalt.append(sammlungsBereich(k));
}

/* ---------- Dialog „Klasse“ ---------- */

const dlgKlasse = document.getElementById('dlg-klasse');
const klNamen = document.getElementById('kl-namen');
let bearbeiteKlasse = null;

const PARTIKEL = /^(von|van|vom|de|del|della|der|den|du|zu|zur|zum|ter|ten|di|da|dos|el|al|la|le)$/i;

// Eine Zeile in Vor- und Nachname zerlegen. Schon gekürzte Namen („Max M.“) bleiben wie sie sind.
function zerlegeName(zeile, reihe) {
  const z = zeile.replace(/^[\s\d.)\-–•*]+/, '').replace(/\s+/g, ' ').trim();
  if (!z) return null;
  const fertig = z.match(/^(.*\S)\s+(\p{L}+)\.(?:\s+\d+)?$/u);
  if (fertig) return { vorname: fertig[1], nachname: fertig[2], fertig: kurzName(z) };
  let vorname;
  let nachname;
  if (z.includes(',')) {
    // „Nachname, Vorname“
    const [n, v] = z.split(',').map((s) => s.trim());
    nachname = n; vorname = v;
  } else {
    const w = z.split(' ');
    if (w.length < 2) return { fehler: z };
    if (reihe === 'nv') {
      // „von Berg Max“: Partikel gehören zum Nachnamen
      let i = 0;
      while (i < w.length - 1 && PARTIKEL.test(w[i])) i++;
      nachname = w.slice(0, i + 1).join(' ');
      vorname = w.slice(i + 1).join(' ');
    } else {
      let i = w.length - 1;
      while (i > 1 && PARTIKEL.test(w[i - 1])) i--;
      nachname = w.slice(i).join(' ');
      vorname = w.slice(0, i).join(' ');
    }
  }
  if (!vorname || !nachname) return { fehler: z };
  // Für das Kürzel zählt der Nachname ohne kleingeschriebene Partikel („von Berg“ -> „Berg“)
  const kern = nachname.split(' ').filter((x) => !PARTIKEL.test(x)).join(' ') || nachname;
  return { vorname, nachname: kern.replace(/\s+/g, '') };
}

function leseKlassenNamen() {
  const reihe = dlgKlasse.querySelector('input[name="kl-reihe"]:checked')?.value || 'vn';
  const personen = [];
  const fehler = [];
  klNamen.value.split('\n').forEach((zeile, nr) => {
    const p = zerlegeName(zeile, reihe);
    if (!p) return;
    if (p.fehler) fehler.push(p.fehler); else personen.push({ ...p, zeile: nr });
  });
  const kuerzel = bildeKuerzel(personen);
  return { personen, kuerzel, fehler };
}

function zeigeKlassenVorschau() {
  const box = document.getElementById('kl-vorschau');
  const { personen, kuerzel, fehler } = leseKlassenNamen();
  box.replaceChildren();
  if (!personen.length && !fehler.length) return;
  box.append(el('p', { class: 'kl-vorschau-titel' }, `Gespeichert wird (${kuerzel.length} Schüler):`));
  const liste = el('div', { class: 'kl-chips' });
  kuerzel.forEach((k, i) => {
    const besonders = !personen[i].fertig && k !== kurzName(`${personen[i].vorname} ${personen[i].nachname}`);
    liste.append(el('span', { class: `kl-chip${besonders ? ' besonders' : ''}`, title: besonders ? 'Gleicher Name in der Klasse, deshalb unterschieden' : '' },
      k,
      el('button', {
        type: 'button',
        class: 'kl-chip-weg',
        'aria-label': `${k} entfernen`,
        title: 'Aus der Klasse entfernen',
        onclick: () => {
          const zeilen = klNamen.value.split('\n');
          zeilen.splice(personen[i].zeile, 1);
          klNamen.value = zeilen.join('\n');
          zeigeKlassenVorschau();
        },
      }, '×')));
  });
  box.append(liste);
  const doppelt = kuerzel.filter((k, i) => kuerzel.indexOf(k) !== i);
  if (kuerzel.some((k, i) => !personen[i].fertig && k !== kurzName(`${personen[i].vorname} ${personen[i].nachname}`))) {
    box.append(el('p', { class: 'hinweis' }, 'Blau markiert: gleiche Namen, mit weiterem Buchstaben oder Nummer unterschieden.'));
  }
  if (doppelt.length) box.append(el('p', { class: 'fehler' }, `Doppelt: ${[...new Set(doppelt)].join(', ')}. Bitte einen der Einträge anpassen.`));
  if (fehler.length) box.append(el('p', { class: 'fehler' }, `Nicht verstanden (nur ein Wort?): ${fehler.join(', ')}`));
}

function oeffneKlasse(k) {
  bearbeiteKlasse = k;
  document.getElementById('kl-titel').textContent = k ? `Klasse ${k.name} bearbeiten` : 'Neue Klasse';
  document.getElementById('kl-name').value = k?.name || '';
  document.getElementById('kl-faecher').value = (k?.faecher || []).join(', ');
  klNamen.value = k ? [...k.schueler].sort((a, b) => vergleich.compare(a.name, b.name)).map((s) => s.name).join('\n') : '';
  const reihe = lokal('namenReihe') === 'nv' ? 'nv' : 'vn';
  dlgKlasse.querySelector(`input[name="kl-reihe"][value="${reihe}"]`).checked = true;
  document.getElementById('kl-loeschen').hidden = !k;
  document.getElementById('kl-fehler').textContent = '';
  document.getElementById('kl-status').textContent = '';
  zeigeKlassenVorschau();
  dlgKlasse.showModal();
  if (!k) document.getElementById('kl-name').focus();
}

function schliesseKlasse() {
  dlgKlasse.close();
  klNamen.value = ''; // volle Namen nicht im Speicher lassen
  document.getElementById('kl-vorschau').replaceChildren();
}

klNamen.addEventListener('input', zeigeKlassenVorschau);
dlgKlasse.querySelectorAll('input[name="kl-reihe"]').forEach((r) => r.addEventListener('change', () => {
  lokal('namenReihe', r.value);
  zeigeKlassenVorschau();
}));
document.getElementById('kl-abbrechen').addEventListener('click', schliesseKlasse);
dlgKlasse.addEventListener('cancel', (e) => { e.preventDefault(); schliesseKlasse(); });

document.getElementById('kl-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fehlerFeld = document.getElementById('kl-fehler');
  const name = document.getElementById('kl-name').value.replace(/\s+/g, '').toLowerCase();
  if (!name) { fehlerFeld.textContent = 'Bitte die Klasse eintragen (z. B. 05c).'; return; }
  const andere = klassen.find((x) => klassenSchluessel(x.name) === klassenSchluessel(name) && x.id !== bearbeiteKlasse?.id);
  if (andere) { fehlerFeld.textContent = `Die Klasse ${andere.name} gibt es schon.`; return; }
  const { kuerzel, fehler } = leseKlassenNamen();
  if (fehler.length) { fehlerFeld.textContent = 'Einige Zeilen sind keine vollständigen Namen. Bitte korrigieren oder löschen.'; return; }
  const doppelt = kuerzel.filter((k, i) => kuerzel.indexOf(k) !== i);
  if (doppelt.length) { fehlerFeld.textContent = `Doppelt: ${[...new Set(doppelt)].join(', ')}.`; return; }
  const faecher = [...new Set(document.getElementById('kl-faecher').value.split(/[,;\n]/).map((f) => f.trim()).filter(Boolean))];
  // Vorhandene Schüler behalten ihre ID (wichtig für spätere Listen)
  const bisher = new Map((bearbeiteKlasse?.schueler || []).map((s) => [s.name, s.id]));
  const klasse = {
    ...(bearbeiteKlasse || { id: neueId(), erstellt: new Date().toISOString() }),
    name,
    faecher,
    schueler: kuerzel.map((k) => ({ id: bisher.get(k) || neueId(), name: k })),
  };
  try {
    await speichereKlasse(klasse);
  } catch (err) {
    fehlerFeld.textContent = `Speichern fehlgeschlagen: ${err?.message || err}`;
    return;
  }
  klassen = await ladeKlassen();
  gewaehlteKlasse = klasse.id;
  lokal('klasse', klasse.id);
  schliesseKlasse();
  zeichne();
  zeigeToast(`Klasse ${klasse.name} gespeichert (${klasse.schueler.length} Schüler).`);
});

document.getElementById('kl-loeschen').addEventListener('click', async () => {
  const k = bearbeiteKlasse;
  if (!k) return;
  const ihreListen = listen.filter((l) => l.klasseId === k.id);
  const ihreSammlungen = sammlungen.filter((s) => s.klasseId === k.id);
  const mit = [ihreListen.length ? `${ihreListen.length} Listen` : '', ihreSammlungen.length ? `${ihreSammlungen.length} Sammlungen` : ''].filter(Boolean).join(' und ');
  const listenText = mit ? ` Auch ihre ${mit} werden gelöscht.` : '';
  if (k.geteilt && typeof loeseGeteilt === 'function') {
    // Geteilte Klasse: wer geteilt hat, beendet das Teilen; alle anderen entfernen sie nur bei sich
    const meine = k.geteiltVon === wolke?.uid;
    const text = meine
      ? `Klasse ${k.name} ist geteilt. Beim Löschen endet das Teilen, die andere Person verliert die Klasse und ihre Listen.${listenText} Die Tadel-Termine bleiben erhalten.`
      : `Klasse ${k.name} ist mit dir geteilt. Sie wird nur bei dir entfernt, für die andere Person bleibt sie erhalten.`;
    if (!(await frage(text, { ja: meine ? 'Löschen' : 'Entfernen', gefahr: true }))) return;
    await loeseGeteilt(k);
    klassen = await ladeKlassen();
    listen = await ladeListen();
    if (!meine) { schliesseKlasse(); zeichne(); return; }
  } else if (!(await frage(`Klasse ${k.name} mit ${k.schueler.length} Schülern löschen?${listenText} Die Tadel-Termine bleiben erhalten.`, { ja: 'Löschen', gefahr: true }))) return;
  await entferneKlasse(k.id);
  for (const l of ihreListen) await entferneListe(l.id);
  for (const s of ihreSammlungen) await entferneSammlung(s.id);
  klassen = await ladeKlassen();
  listen = await ladeListen();
  sammlungen = await ladeSammlungen();
  schliesseKlasse();
  zeichne();
});

/* ---------- Namen aus einem Screenshot lesen (lokal, Tesseract) ---------- */

const KEINE_NAMEN = /^(klasse|klassen|schüler|schueler|schülerin|schülerinnen|name|namen|vorname|nachname|familienname|geschlecht|geburtsdatum|geburtstag|webuntis|untis|suche|suchen|filter|alle|datum|heute|stundenplan|mitteilungen|abwesenheiten|übersicht|zurück|bearbeiten|drucken|export|anzahl|seite|klassenlehrer|klassenvorstand|schuljahr|kontakt|details|aktiv|eltern)$/i;

function namenAusText(text) {
  const namen = [];
  for (const zeile of text.split('\n')) {
    let z = zeile
      .replace(/\b\d{1,2}\.\d{1,2}\.\d{2,4}\b/g, ' ')
      .replace(/[|[\]{}()<>@#*_=+~"“”„;:!?/\\©®°§$%&€]/g, ' ')
      .replace(/\d+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    // Spalte „Geschlecht“ (m/w/d) am Zeilenende; die Erkennung liest ein „w“ manchmal als „Ww“
    z = z.replace(/\s+[mwdx]{1,2}\.?$/i, '').replace(/^[mwdx]\s+/i, '').replace(/^[-–•.,]+\s*|\s*[-–•.]+$/g, '').trim();
    const woerter = z.split(' ').filter(Boolean);
    if (woerter.length < 2 || woerter.length > 5) continue;
    if (woerter.some((w) => KEINE_NAMEN.test(w.replace(/[,.]/g, '')))) continue;
    const istName = woerter.every((w) => /^\p{Lu}[\p{L}'’-]*,?$/u.test(w) || PARTIKEL.test(w));
    if (!istName || woerter.filter((w) => w.replace(/[,'’-]/g, '').length >= 2).length < 2) continue;
    namen.push(woerter.join(' '));
  }
  return [...new Set(namen)];
}

document.getElementById('kl-screenshot').addEventListener('click', () => {
  const eingabe = document.getElementById('kl-datei');
  eingabe.value = '';
  eingabe.click();
});

document.getElementById('kl-datei').addEventListener('change', async (e) => {
  const datei = e.target.files?.[0];
  if (!datei) return;
  const status = document.getElementById('kl-status');
  const knopf = document.getElementById('kl-screenshot');
  knopf.disabled = true;
  status.textContent = 'Screenshot wird gelesen … (beim ersten Mal etwas länger)';
  try {
    const { ocr, farbe } = await bereiteBildVor(datei);
    farbe.width = farbe.height = 0; // Farbbild wird hier nicht gebraucht
    const worker = await holeWorker();
    const { data } = await worker.recognize(ocr);
    ocr.width = ocr.height = 0;
    const gefunden = namenAusText(data.text);
    const vorhanden = new Set(klNamen.value.split('\n').map((z) => z.trim()).filter(Boolean));
    const neu = gefunden.filter((n) => !vorhanden.has(n));
    if (neu.length) klNamen.value = [...vorhanden, ...neu].join('\n');
    // „Nachname, Vorname“ ist eindeutig; sonst die Reihenfolge prüfen lassen
    status.textContent = neu.length
      ? `${neu.length} Namen erkannt. Bitte prüfen: Stimmt die Reihenfolge (Vorname/Nachname)? Fehlt jemand?`
      : 'Keine Namen erkannt. Tipp: Screenshot nur von der Namensliste, gut lesbar; oder die Namen abtippen/einfügen.';
    zeigeKlassenVorschau();
  } catch (err) {
    status.textContent = `Lesen fehlgeschlagen: ${err?.message || err}`;
  } finally {
    knopf.disabled = false;
  }
});
