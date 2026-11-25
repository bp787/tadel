'use strict';

/* ---------- Speicher (IndexedDB, bleibt nur auf diesem Gerät) ---------- */

const DB_NAME = 'tadelverwaltung';
const DB_VERSION = 5; // v2: Ablage „fotos“ für geschwärzte Blätter; v3: „klassen“; v4: „listen“; v5: „sammlungen“
let db;

function oeffneDb() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('termine')) {
        d.createObjectStore('termine', { keyPath: 'id' });
      }
      if (!d.objectStoreNames.contains('fotos')) {
        d.createObjectStore('fotos', { keyPath: 'id' });
      }
      if (!d.objectStoreNames.contains('klassen')) {
        d.createObjectStore('klassen', { keyPath: 'id' });
      }
      if (!d.objectStoreNames.contains('listen')) {
        d.createObjectStore('listen', { keyPath: 'id' });
      }
      if (!d.objectStoreNames.contains('sammlungen')) {
        d.createObjectStore('sammlungen', { keyPath: 'id' });
      }
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function anfrage(r) {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

const ablage = (modus) => db.transaction('termine', modus).objectStore('termine');
const ladeAlle = () => anfrage(ablage('readonly').getAll());
// Jede Änderung geht zusätzlich an den Speicher bei claude.ai (wolke.js, nur im Artefakt)
const nachWolke = (ablageName, obj) => (r) => { if (typeof wolkeMerke === 'function') wolkeMerke(ablageName, obj); return r; };
const ausWolke = (ablageName, id) => (r) => { if (typeof wolkeVergiss === 'function') wolkeVergiss(ablageName, id); return r; };
const speichere = (t) => anfrage(ablage('readwrite').put(t)).then(nachWolke('termine', t));
const entferne = (id) => anfrage(ablage('readwrite').delete(id)).then(ausWolke('termine', id));

// Fotos: nur geschwärzte Bilder { id, terminId, art: 'tadel', bild: Blob, erstellt }
const fotoAblage = (modus) => db.transaction('fotos', modus).objectStore('fotos');
// Bild als ArrayBuffer speichern: Safari lehnt Blobs in IndexedDB bei eingebetteten Seiten (z. B. claude.ai) teils ab
async function speichereFoto(f) {
  const { bild, ...rest } = f;
  const bildDaten = await bild.arrayBuffer();
  const eintrag = { ...rest, bildDaten, bildTyp: bild.type || 'image/jpeg' };
  return anfrage(fotoAblage('readwrite').put(eintrag)).then(nachWolke('fotos', eintrag));
}
// Bild eines gespeicherten Fotos als Blob (neues und altes Speicherformat)
const fotoBild = (f) => (f.bild instanceof Blob ? f.bild : new Blob([f.bildDaten], { type: f.bildTyp || 'image/jpeg' }));
const ladeFoto = (id) => anfrage(fotoAblage('readonly').get(id));

// Klassen (Phase 9): { id, name: '05c', faecher: ['Deutsch', …], schueler: [{ id, name: 'Max M.' }], erstellt }
const klassenAblage = (modus) => db.transaction('klassen', modus).objectStore('klassen');
const ladeKlassen = () => anfrage(klassenAblage('readonly').getAll());
const speichereKlasse = (k) => anfrage(klassenAblage('readwrite').put(k)).then(nachWolke('klassen', k));
const entferneKlasse = (id) => anfrage(klassenAblage('readwrite').delete(id)).then(ausWolke('klassen', id));
let klassen = [];

// Listen (Phase 10): { id, klasseId, titel, bereich, frist, spalten: [{ id, titel, art, soll }], werte: { schuelerId: { spaltenId: wert } }, archiviert, erstellt }
const listenAblage = (modus) => db.transaction('listen', modus).objectStore('listen');
const ladeListen = () => anfrage(listenAblage('readonly').getAll());
const speichereListe = (l) => anfrage(listenAblage('readwrite').put(l)).then(nachWolke('listen', l));
const entferneListe = (id) => anfrage(listenAblage('readwrite').delete(id)).then(ausWolke('listen', id));
let listen = [];

// Klassenbuch-Sammlungen (Phase 11): { id, klasseId, titel, erstellt, faecherAuswahl, eintraege: [{ id, schuelerId, name, datum, stunde, fach, text, quelle }] }
const sammlungsAblage = (modus) => db.transaction('sammlungen', modus).objectStore('sammlungen');
const ladeSammlungen = () => anfrage(sammlungsAblage('readonly').getAll());
const speichereSammlung = (s) => anfrage(sammlungsAblage('readwrite').put(s)).then(nachWolke('sammlungen', s));
const entferneSammlung = (id) => anfrage(sammlungsAblage('readwrite').delete(id)).then(ausWolke('sammlungen', id));
let sammlungen = [];

// Klassen vergleichen: „05c“, „5c“ und „5 C“ sind dieselbe Klasse
const klassenSchluessel = (s) => String(s || '').replace(/\s/g, '').toLowerCase().replace(/^0+(?=\d)/, '');
const findeKlasse = (name) => klassen.find((k) => klassenSchluessel(k.name) === klassenSchluessel(name));

// „Max Mü.“ / „Max M. 2“ -> „Max M.“ (Vorname + Initiale), zum Abgleich mit Tadel-Namen
function basisName(n) {
  const m = String(n || '').trim().match(/^(.*\S)\s+(\p{L})\p{L}*\.(?:\s+\d+)?$/u);
  return m ? `${m[1]} ${m[2].toUpperCase()}.` : String(n || '').trim();
}

// Gehört ein Tadel-Termin zu diesem Schüler? Gleicher Name, oder gleiche Grundform,
// wenn die Klassenliste nur einen Schüler mit dieser Grundform hat (sonst wäre es nicht eindeutig).
function gehoertZu(t, name, klasse) {
  if (klassenSchluessel(t.klasse) !== klassenSchluessel(klasse)) return false;
  if (t.name === name) return true;
  if (basisName(t.name) !== basisName(name)) return false;
  const k = findeKlasse(klasse);
  if (!k) return false;
  return k.schueler.filter((s) => basisName(s.name) === basisName(name)).length === 1;
}

/*
 * Kürzel für eine ganze Klasse (Regel aus dem Blueprint):
 * - normal „Vorname N.“
 * - gleicher Vorname + gleiche Initiale: so viele Buchstaben des Nachnamens, bis es eindeutig ist („Max Me.“ / „Max Mü.“)
 * - steckt ein Nachname ganz im anderen (Meyer / Meyerstedt) oder sind sie gleich: „Max M. 1“, „Max M. 2“
 * personen: [{ vorname, nachname, fertig }] – „fertig“ ist ein schon gespeichertes Kürzel, das bleibt;
 * sein Nachname ist dann nur der bekannte Anfang (z. B. „Mü“).
 */
function bildeKuerzel(personen) {
  const gross = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const erg = personen.map((p) => p.fertig || null);
  const gruppen = new Map();
  personen.forEach((p, i) => {
    const schluessel = p.vorname.toLowerCase();
    if (!gruppen.has(schluessel)) gruppen.set(schluessel, []);
    gruppen.get(schluessel).push(i);
  });
  for (const idx of gruppen.values()) {
    for (const i of idx) {
      if (erg[i]) continue;
      const p = personen[i];
      const n = p.nachname.toLowerCase();
      const andere = idx.filter((j) => j !== i);
      // Verwandte (ein Name steckt ganz im anderen) unter den neuen, vollständigen Namen
      const verwandt = andere.filter((j) => !personen[j].fertig && (personen[j].nachname.toLowerCase().startsWith(n) || n.startsWith(personen[j].nachname.toLowerCase())));
      // So viele Buchstaben, wie nötig sind, um sich von den übrigen (nicht verwandten) Namen zu unterscheiden
      let laenge = 1;
      for (const j of andere.filter((x) => !verwandt.includes(x))) {
        const o = personen[j].nachname.toLowerCase();
        let gleich = 0;
        while (gleich < n.length && gleich < o.length && n[gleich] === o[gleich]) gleich++;
        laenge = Math.max(laenge, Math.min(n.length, gleich + 1));
      }
      if (verwandt.length) {
        // Für die ganze Gruppe dieselbe Länge, damit die Nummern zusammenpassen („Max Me. 1“, „Max Me. 2“)
        const gruppe = [i, ...verwandt].sort((a, b) => vergleich.compare(personen[a].nachname, personen[b].nachname) || a - b);
        for (const g of gruppe) {
          for (const j of andere.filter((x) => !gruppe.includes(x))) {
            const a = personen[g].nachname.toLowerCase();
            const o = personen[j].nachname.toLowerCase();
            let gleich = 0;
            while (gleich < a.length && gleich < o.length && a[gleich] === o[gleich]) gleich++;
            laenge = Math.max(laenge, Math.min(n.length, gleich + 1));
          }
        }
        erg[i] = `${p.vorname} ${gross(p.nachname.slice(0, laenge))}. ${gruppe.indexOf(i) + 1}`;
        continue;
      }
      laenge = 1;
      for (const j of andere) {
        const o = personen[j].nachname.toLowerCase();
        let gleich = 0;
        while (gleich < n.length && gleich < o.length && n[gleich] === o[gleich]) gleich++;
        laenge = Math.max(laenge, Math.min(n.length, gleich + 1));
      }
      erg[i] = `${p.vorname} ${gross(p.nachname.slice(0, laenge))}.`;
    }
  }
  return erg;
}

// Für einen vollen Namen das Kürzel aus der Klassenliste suchen (z. B. „Max Müller“ in 05c -> „Max Mü.“)
function kuerzelInKlasse(voll, klasse) {
  const teile = String(voll || '').trim().split(/\s+/);
  const standard = kurzName(voll);
  const k = findeKlasse(klasse);
  if (!k || teile.length < 2) return standard;
  const vorname = teile.slice(0, -1).join(' ').toLowerCase();
  const nach = teile[teile.length - 1].toLowerCase();
  const treffer = k.schueler.filter((s) => {
    const m = s.name.match(/^(.*\S)\s+(\p{L}+)\.(?:\s+\d+)?$/u);
    return m && m[1].toLowerCase() === vorname && nach.startsWith(m[2].toLowerCase());
  });
  if (!treffer.length) return standard;
  // Den Eintrag mit dem längsten passenden Anfang nehmen; bei Gleichstand (nummeriert) bleibt die Wahl beim Nutzer
  const laenge = (s) => s.name.match(/(\p{L}+)\.(?:\s+\d+)?$/u)[1].length;
  const beste = Math.max(...treffer.map(laenge));
  const kandidaten = treffer.filter((s) => laenge(s) === beste);
  return kandidaten.length === 1 ? kandidaten[0].name : standard;
}
const entferneFoto = (id) => anfrage(fotoAblage('readwrite').delete(id)).then(ausWolke('fotos', id));

/* ---------- Hilfsfunktionen ---------- */

// "Almir Mustermann" -> "Almir M."; "Anna Lena Meier" -> "Anna Lena M."; "Almir M." bleibt.
function kurzName(eingabe) {
  const teile = eingabe.trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
  if (teile.length < 2) return teile.join('');
  // Schon ein Kürzel („Max M.“, „Max Mü.“, „Max M. 2“): so lassen
  const fertig = teile.join(' ').match(/^(.*\S)\s+(\p{L})(\p{L}*)\.((?:\s+\d+)?)$/u);
  if (fertig) return `${fertig[1]} ${fertig[2].toUpperCase()}${fertig[3].toLowerCase()}.${fertig[4]}`;
  const nachname = teile[teile.length - 1];
  const vorname = teile.slice(0, -1).join(' ');
  return `${vorname} ${nachname.charAt(0).toUpperCase()}.`;
}

function neueId() {
  if (window.crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function heuteIso() {
  const d = new Date();
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

function datumLang(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('de-DE', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function datumKurz(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Die 7 Eintragsarten in der Reihenfolge des Tadel-Blatts
const ARTEN = [
  { key: 'handy', name: 'Gelbe Karte Handy', farbe: 'gelb' },
  { key: 'stoert', name: 'Gelbe Karte stört', farbe: 'gelb' },
  { key: 'streit', name: 'Gelbe Karte Streitschlichter', farbe: 'gelb' },
  { key: 'rot', name: 'Rote Karte', farbe: 'rotkarte' },
  { key: 'hausaufgaben', name: 'Keine Hausaufgaben' },
  { key: 'material', name: 'Ohne Material' },
  { key: 'sonstiges', name: 'Sonstiges' },
];

const vergleich = new Intl.Collator('de', { numeric: true, sensitivity: 'base' });

// Reihenfolge: Datum -> Uhrzeit -> Raum -> Name
function sortiere(a, b) {
  return a.datum.localeCompare(b.datum)
    || a.von.localeCompare(b.von)
    || vergleich.compare(a.raum, b.raum)
    || vergleich.compare(a.name, b.name);
}

function el(tag, attrs = {}, ...kinder) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const kind of kinder) {
    if (kind != null) e.append(kind);
  }
  return e;
}

function lokal(schluessel, wert) {
  try {
    if (wert === undefined) return localStorage.getItem(schluessel);
    localStorage.setItem(schluessel, wert);
  } catch { /* privater Modus o. ä.: einfach ignorieren */ }
  return null;
}

/* ---------- Eigene Melde- und Rückfragefenster ----------
   (alert/confirm zeigt ein Claude-Artefakt nicht an, deshalb immer diese verwenden) */

function frage(text, { ja = 'OK', nein = 'Abbrechen', gefahr = false } = {}) {
  const d = document.getElementById('dlg-frage');
  document.getElementById('frage-text').textContent = text;
  const jaKnopf = document.getElementById('frage-ja');
  const neinKnopf = document.getElementById('frage-nein');
  jaKnopf.textContent = ja;
  jaKnopf.className = `btn ${gefahr ? 'btn-gefahr-voll' : 'btn-primary'}`;
  neinKnopf.hidden = !nein;
  neinKnopf.textContent = nein || '';
  d.showModal();
  jaKnopf.focus();
  return new Promise((resolve) => {
    const fertig = (wert) => { d.close(); resolve(wert); };
    jaKnopf.onclick = () => fertig(true);
    neinKnopf.onclick = () => fertig(false);
    d.oncancel = (e) => { e.preventDefault(); fertig(false); };
  });
}

const meldung = (text) => frage(text, { nein: null });

// Eingabefenster (prompt gibt es im Artefakt nicht). Ergebnis: Text, '' (Leeren) oder null (Abbrechen).
function eingabe(text, { wert = '', typ = 'text', platzhalter = '', leeren = false, modus = '' } = {}) {
  const d = document.getElementById('dlg-eingabe');
  const feld = document.getElementById('ein-feld');
  document.getElementById('ein-text').textContent = text;
  feld.type = typ;
  feld.value = wert ?? '';
  feld.placeholder = platzhalter;
  if (modus) feld.setAttribute('inputmode', modus); else feld.removeAttribute('inputmode');
  if (typ === 'number') feld.step = '0.01'; else feld.removeAttribute('step');
  const leerenKnopf = document.getElementById('ein-leeren');
  leerenKnopf.hidden = !leeren;
  d.showModal();
  feld.focus();
  if (typ === 'text') feld.select();
  return new Promise((resolve) => {
    const fertig = (wertNeu) => { d.close(); resolve(wertNeu); };
    document.getElementById('ein-form').onsubmit = (e) => { e.preventDefault(); fertig(feld.value.trim()); };
    document.getElementById('ein-nein').onclick = () => fertig(null);
    leerenKnopf.onclick = () => fertig('');
    d.oncancel = (e) => { e.preventDefault(); fertig(null); };
  });
}

/* ---------- Zustand ---------- */

let termine = [];
// Ansicht: 'aktuell' (noch nicht beide Haken) oder 'archiv' (erschienen UND unterschrieben)
let ansicht = ['archiv', 'blaetter'].includes(lokal('ansicht')) ? lokal('ansicht') : 'aktuell';
let suchtext = '';
let bearbeiteId = null;
let aktuellerVorschlag = null; // Werte (und geschwärztes Foto) aus der Fotoerkennung

const erledigt = (t) => !!(t.erschienen && t.unterschrieben);

/* ---------- Anzeige ---------- */

function sichtbareTermine() {
  const s = suchtext.trim().toLowerCase();
  const liste = termine.filter((t) => {
    if ((ansicht === 'archiv') !== erledigt(t)) return false;
    if (s && !`${t.name} ${t.klasse} ${t.raum}`.toLowerCase().includes(s)) return false;
    return true;
  });
  liste.sort(sortiere);
  // Im Archiv stehen die neuesten Tage oben
  if (ansicht === 'archiv') liste.sort((a, b) => b.datum.localeCompare(a.datum));
  return liste;
}

let toastZeit;
function zeigeToast(text, rueckgaengig) {
  const toast = document.getElementById('toast');
  toast.replaceChildren(el('span', {}, text));
  if (rueckgaengig) {
    toast.append(el('button', {
      type: 'button',
      class: 'toast-knopf',
      onclick: async () => {
        clearTimeout(toastZeit);
        toast.hidden = true;
        await rueckgaengig();
      },
    }, 'Rückgängig'));
  }
  toast.hidden = false;
  clearTimeout(toastZeit);
  toastZeit = setTimeout(() => { toast.hidden = true; }, 6000);
}

function hakenKnopf(t, feld, beschriftung) {
  const an = !!t[feld];
  return el('button', {
    type: 'button',
    class: 'check',
    'aria-pressed': String(an),
    'aria-label': `${beschriftung}: ${t.name}`,
    title: beschriftung,
    onclick: async () => {
      const warErledigt = erledigt(t);
      t[feld] = !t[feld];
      await speichere(t);
      zeichne();
      if (!warErledigt && erledigt(t)) {
        zeigeToast(`${t.name} ist erledigt und wurde ins Archiv verschoben.`, async () => {
          t[feld] = false;
          await speichere(t);
          zeichne();
        });
      } else if (warErledigt && !erledigt(t)) {
        zeigeToast(`${t.name} ist wieder in der aktuellen Liste.`);
      }
    },
  }, an ? '✓' : '–', el('span', { class: 'text' }, beschriftung));
}

function zeichne() {
  const liste = document.getElementById('liste');
  liste.replaceChildren();
  // Phase 8: Erinnerung an die Datensicherung (sicherung.js)
  if (typeof aktualisiereSicherungsHinweis === 'function') aktualisiereSicherungsHinweis();
  // Phase 9: Reiter Klassenbuch/Listen (klassen.js) mitzeichnen
  if (typeof zeichneReiter === 'function') zeichneReiter();

  const anzahlAktuell = termine.filter((t) => !erledigt(t)).length;
  const anzahlArchiv = termine.length - anzahlAktuell;
  const anzahlBlaetter = termine.filter((t) => t.fotoId || t.rueckantwortId).length;
  const zahlen = { aktuell: anzahlAktuell, archiv: anzahlArchiv, blaetter: anzahlBlaetter };
  document.querySelectorAll('.chip[data-ansicht]').forEach((c) => {
    c.setAttribute('aria-pressed', String(c.dataset.ansicht === ansicht));
    c.querySelector('.zahl').textContent = zahlen[c.dataset.ansicht];
  });

  if (ansicht === 'blaetter') {
    zeichneBlaetter(liste);
    return;
  }

  const sichtbar = sichtbareTermine();
  const offen = termine.filter((t) => !erledigt(t));
  const nichtErschienen = offen.filter((t) => t.datum < heuteIso() && !t.erschienen).length;
  const ohneUnterschrift = offen.filter((t) => !t.unterschrieben).length;
  document.getElementById('zusammenfassung').textContent = ansicht === 'archiv'
    ? (anzahlArchiv ? `${anzahlArchiv} erledigte Termine (erschienen und unterschrieben). Wird ein Haken entfernt, kommt der Termin zurück in die aktuelle Liste.` : '')
    : (anzahlAktuell ? `${anzahlAktuell} offene Termine · ${nichtErschienen} vergangene ohne „erschienen“ · ${ohneUnterschrift} ohne Unterschrift` : '');

  if (!sichtbar.length) {
    let text;
    if (suchtext.trim()) text = 'Keine Treffer für die Suche.';
    else if (ansicht === 'archiv') text = 'Noch nichts im Archiv. Termine landen hier, sobald „erschienen“ und „unterschrieben“ abgehakt sind.';
    else if (termine.length) text = 'Alles erledigt, keine offenen Termine.';
    else text = 'Noch keine Termine. Tippe oben rechts auf „+ Termin“.';
    liste.append(el('p', { class: 'leer' }, text));
    return;
  }

  const heute = heuteIso();
  const tage = new Map();
  for (const t of sichtbar) {
    if (!tage.has(t.datum)) tage.set(t.datum, []);
    tage.get(t.datum).push(t);
  }

  for (const [datum, eintraege] of tage) {
    const klassen = ['tag'];
    if (datum < heute) klassen.push('vergangen');
    if (datum === heute) klassen.push('ist-heute');

    const tbody = el('tbody');
    for (const t of eintraege) {
      tbody.append(el('tr', {},
        el('td', { class: 'zeit' }, t.bis ? `${t.von}–${t.bis}` : t.von),
        el('td', { class: 'raum' }, t.raum),
        el('td', { class: 'name' }, el('button', {
          type: 'button',
          class: 'name-link',
          title: 'Übersicht dieses Schülers öffnen',
          onclick: () => oeffneSchueler(t.name, t.klasse),
        }, t.name), t.fotoId ? el('button', {
          type: 'button',
          class: 'blatt-mini',
          'aria-label': `Blatt von ${t.name} ansehen`,
          title: 'Blatt ansehen',
          onclick: () => zeigeFoto(t.fotoId),
        }, '📄') : null, t.rueckantwortId ? el('button', {
          type: 'button',
          class: 'blatt-mini',
          'aria-label': `Rückantwort von ${t.name} ansehen`,
          title: 'Rückantwort ansehen',
          onclick: () => zeigeFoto(t.rueckantwortId),
        }, '📎') : null),
        el('td', { class: 'klasse' }, t.klasse),
        el('td', { class: 'haken' }, hakenKnopf(t, 'erschienen', 'Erschienen')),
        el('td', { class: 'haken' }, hakenKnopf(t, 'unterschrieben', 'Unterschrieben')),
        el('td', { class: 'mehr' }, el('button', {
          type: 'button',
          class: 'bearbeiten',
          'aria-label': `Termin von ${t.name} bearbeiten`,
          title: 'Bearbeiten',
          onclick: () => oeffneDialog(t),
        }, '✎')),
      ));
    }

    liste.append(el('section', { class: klassen.join(' ') },
      el('h2', {},
        datumLang(datum),
        datum === heute ? el('span', { class: 'badge-heute' }, 'heute') : null,
        el('span', { class: 'anzahl' }, `${eintraege.length} ${eintraege.length === 1 ? 'Schüler' : 'Schüler'}`),
      ),
      el('table', {},
        el('thead', {}, el('tr', {},
          el('th', { class: 'c-zeit' }, 'Uhrzeit'),
          el('th', { class: 'c-raum' }, 'Raum'),
          el('th', {}, 'Name'),
          el('th', { class: 'c-klasse' }, 'Klasse'),
          el('th', { class: 'haken' }, 'Erschienen'),
          el('th', { class: 'haken' }, 'Unterschrift'),
          el('th', { class: 'c-mehr', 'aria-label': 'Bearbeiten' }),
        )),
        tbody,
      ),
    ));
  }
}

function fuelleVorschlaege() {
  const setze = (id, werte) => {
    const dl = document.getElementById(id);
    dl.replaceChildren(...[...new Set(werte)].sort(vergleich.compare).map((w) => el('option', { value: w })));
  };
  setze('raeume', termine.map((t) => t.raum));
  setze('klassen', [...termine.map((t) => t.klasse), ...klassen.map((k) => k.name)]);
}

/* ---------- Dialog: Termin anlegen / bearbeiten ---------- */

const dlg = document.getElementById('dlg');
const form = document.getElementById('form');

function oeffneDialog(t = null, vorschlag = null) {
  bearbeiteId = t ? t.id : null;
  aktuellerVorschlag = vorschlag;
  const blattKnopf = document.getElementById('btn-blatt');
  blattKnopf.hidden = !t?.fotoId;
  blattKnopf.onclick = () => zeigeFoto(t.fotoId);
  // Rückantwort: ansehen (falls vorhanden) und neu einlesen – nur bei bestehendem Termin
  const rueckAnsehen = document.getElementById('btn-rueck-ansehen');
  rueckAnsehen.hidden = !t?.rueckantwortId;
  rueckAnsehen.onclick = () => zeigeFoto(t.rueckantwortId);
  const rueckNeu = document.getElementById('btn-rueck-neu');
  rueckNeu.hidden = !t;
  rueckNeu.textContent = t?.rueckantwortId ? '📎 Rückantwort ersetzen' : '📎 Rückantwort einlesen';
  rueckNeu.onclick = () => { dlg.close(); starteFotoEingabe('rueckantwort', t.id); };
  document.getElementById('dlg-knoepfe').hidden = blattKnopf.hidden && rueckAnsehen.hidden && rueckNeu.hidden;
  form.reset();
  document.getElementById('fehler').textContent = '';
  document.getElementById('dlg-titel').textContent = t ? 'Termin bearbeiten' : 'Neuer Termin';
  document.getElementById('btn-loeschen').hidden = !t;
  document.getElementById('btn-weiter').hidden = !!t;

  const box = document.getElementById('eintraege-box');
  box.open = true; // immer aufgeklappt: hier stehen Woche und Halbjahr vom Blatt
  document.getElementById('schueler-zeilen').replaceChildren();
  // Ein Foto = ein Tadel-Blatt = ein Schüler
  document.getElementById('btn-zeile').hidden = !!t || !!vorschlag;
  if (t) {
    for (const f of ['datum', 'von', 'bis', 'raum', 'tadelDatum']) form.elements[f].value = t[f] || '';
    neueZeile(t.name, t.klasse);
    for (const a of ARTEN) {
      form.elements[`w_${a.key}`].value = t.woche?.[a.key] ?? '';
      form.elements[`h_${a.key}`].value = t.halbjahr?.[a.key] ?? '';
    }
  } else if (vorschlag) {
    // Werte aus der Fotoerkennung: nur übernehmen, was erkannt wurde; der Rest bleibt leer und wird markiert
    for (const f of ['datum', 'von', 'bis', 'raum', 'tadelDatum']) form.elements[f].value = vorschlag[f] || '';
    neueZeile(vorschlag.name || '', vorschlag.klasse || '');
    for (const a of ARTEN) {
      form.elements[`w_${a.key}`].value = vorschlag.woche?.[a.key] ?? '';
      form.elements[`h_${a.key}`].value = vorschlag.halbjahr?.[a.key] ?? '';
    }
    box.open = true;
  } else {
    // Vorbelegung mit den Werten des zuletzt angelegten Termins (gleicher Tag/Raum ist häufig)
    const letzter = JSON.parse(lokal('letzterTermin') || 'null');
    form.elements.datum.value = letzter?.datum || heuteIso();
    form.elements.von.value = letzter?.von || '';
    form.elements.bis.value = letzter?.bis || '';
    form.elements.raum.value = letzter?.raum || '';
    neueZeile();
  }
  zeigeFotoHinweis(vorschlag);
  aktualisiereZeilen();
  fuelleVorschlaege();
  dlg.showModal();
  if (vorschlag) dlg.scrollTop = 0;
  else (t ? form.elements.datum : document.querySelector('.z-name')).focus();
}

// Hinweis oben im Dialog nach dem Einlesen eines Fotos; nicht erkannte Felder werden rot umrandet
function zeigeFotoHinweis(vorschlag) {
  const hinweis = document.getElementById('foto-hinweis');
  form.querySelectorAll('.pruefen').forEach((x) => x.classList.remove('pruefen'));
  if (!vorschlag) { hinweis.hidden = true; return; }
  const fehlend = [];
  const markiere = (feld, text) => { feld.classList.add('pruefen'); fehlend.push(text); };
  if (!vorschlag.datum) markiere(form.elements.datum, 'Datum');
  if (!vorschlag.von) markiere(form.elements.von, 'Uhrzeit');
  if (!vorschlag.raum) markiere(form.elements.raum, 'Raum');
  if (!vorschlag.name) markiere(document.querySelector('.z-name'), 'Name');
  if (!vorschlag.klasse) markiere(document.querySelector('.z-klasse'), 'Klasse');
  if (!vorschlag.woche || !vorschlag.halbjahr) fehlend.push('Einträge laut Blatt');
  // Plausibilität: Halbjahr kann nicht kleiner sein als die Woche; Wochensumme = Anzahl im Text
  const zweifel = [];
  if (vorschlag.woche && vorschlag.halbjahr) {
    for (const a of ARTEN) {
      if (vorschlag.halbjahr[a.key] < vorschlag.woche[a.key]) {
        form.elements[`w_${a.key}`].classList.add('pruefen');
        form.elements[`h_${a.key}`].classList.add('pruefen');
        zweifel.push(a.name);
      }
    }
  }
  if (vorschlag.woche && vorschlag.anzahl != null) {
    const summe = ARTEN.reduce((s, a) => s + (vorschlag.woche[a.key] || 0), 0);
    if (summe !== vorschlag.anzahl) {
      ARTEN.forEach((a) => form.elements[`w_${a.key}`].classList.add('pruefen'));
      zweifel.push(`Wochensumme ${summe} statt ${vorschlag.anzahl} laut Text`);
    }
  }
  if (zweifel.length) fehlend.push(`Zahlen unsicher (${zweifel.join('; ')})`);
  hinweis.replaceChildren(
    el('strong', {}, 'Vom Foto übernommen. Bitte prüfen!'),
    el('span', {}, ' Handschriftliche Änderungen (z. B. eine durchgestrichene Uhrzeit) erkennt die App nicht.'),
  );
  if (fehlend.length) hinweis.append(el('span', { class: 'fehlt-liste' }, ` Nicht erkannt: ${fehlend.join(', ')}.`));
  hinweis.hidden = false;
}

/* Schüler-Zeilen im Dialog: beim neuen Termin beliebig viele, beim Bearbeiten genau eine */

function neueZeile(name = '', klasse = null) {
  const zeilen = document.getElementById('schueler-zeilen');
  // Klasse der vorigen Zeile übernehmen (oft kommen mehrere aus derselben Klasse)
  const vorige = zeilen.querySelector('.schueler-zeile:last-child .z-klasse');
  const zeile = el('div', { class: 'schueler-zeile' },
    el('input', { class: 'z-name', type: 'text', autocomplete: 'off', placeholder: 'Vorname Nachname', 'aria-label': 'Name' }),
    el('input', { class: 'z-klasse', type: 'text', list: 'klassen', autocomplete: 'off', placeholder: '05c', 'aria-label': 'Klasse' }),
    el('button', {
      type: 'button',
      class: 'z-weg',
      'aria-label': 'Zeile entfernen',
      title: 'Zeile entfernen',
      onclick: () => { zeile.remove(); aktualisiereZeilen(); },
    }, '×'),
    el('small', { class: 'z-vorschau hinweis' }),
  );
  zeile.querySelector('.z-name').value = name;
  zeile.querySelector('.z-klasse').value = klasse ?? (vorige?.value || '');
  zeile.querySelector('.z-name').addEventListener('input', () => zeigeVorschau(zeile));
  // Beim Verlassen des Feldes gleich kürzen, damit nie der volle Nachname dasteht
  zeile.querySelector('.z-name').addEventListener('change', (e) => {
    // Kürzel passend zur Klassenliste (z. B. „Max Mü.“, wenn es zwei „Max M.“ gibt)
    const k = kuerzelInKlasse(e.target.value, zeile.querySelector('.z-klasse').value);
    if (k && k !== e.target.value.trim()) e.target.value = k;
    zeigeVorschau(zeile);
  });
  zeilen.append(zeile);
  zeigeVorschau(zeile);
  aktualisiereZeilen();
  return zeile;
}

function zeigeVorschau(zeile) {
  const roh = zeile.querySelector('.z-name').value.trim();
  const k = kuerzelInKlasse(roh, zeile.querySelector(".z-klasse").value);
  zeile.querySelector('.z-vorschau').textContent = k && k !== roh ? `wird gespeichert als: ${k}` : '';
}

function aktualisiereZeilen() {
  const zeilen = document.querySelectorAll('.schueler-zeile');
  zeilen.forEach((z) => { z.querySelector('.z-weg').hidden = zeilen.length < 2; });
  // Einträge laut Blatt gehören zu genau einem Schüler
  const mehrere = zeilen.length > 1;
  document.getElementById('eintraege-box').hidden = mehrere;
  document.getElementById('eintraege-mehrere').hidden = !mehrere;
}

function leseZeilen() {
  return [...document.querySelectorAll('.schueler-zeile')]
    .map((z) => ({ name: z.querySelector('.z-name').value.trim(), klasse: z.querySelector('.z-klasse').value.trim() }))
    .filter((s) => s.name || s.klasse);
}

// Liest die 7 Zahlenfelder (Präfix 'w' = Woche, 'h' = Halbjahr). Alles leer -> null.
function leseZahlen(praefix) {
  const werte = {};
  let irgendwas = false;
  for (const a of ARTEN) {
    const roh = form.elements[`${praefix}_${a.key}`].value.trim();
    if (roh !== '') irgendwas = true;
    const n = Number.parseInt(roh, 10);
    werte[a.key] = Number.isFinite(n) && n > 0 ? n : 0;
  }
  return irgendwas ? werte : null;
}

function baueEintragsRaster() {
  const raster = document.getElementById('eintraege-raster');
  for (const a of ARTEN) {
    const feld = (praefix, art) => el('input', {
      name: `${praefix}_${a.key}`,
      type: 'number',
      min: '0',
      step: '1',
      inputmode: 'numeric',
      'aria-label': `${a.name}, ${art}`,
    });
    raster.append(el('span', { class: `art ${a.farbe || ''}` }, a.name), feld('w', 'Woche'), feld('h', 'Halbjahr'));
  }
}

/* ---------- Gespeichertes (geschwärztes) Blatt anzeigen ---------- */

const dlgBild = document.getElementById('dlg-bild');
let bildUrl = null;

async function zeigeFoto(fotoId) {
  const foto = await ladeFoto(fotoId);
  if (!foto) { meldung('Das Foto wurde nicht gefunden.'); return; }
  if (bildUrl) URL.revokeObjectURL(bildUrl);
  bildUrl = URL.createObjectURL(fotoBild(foto));
  document.getElementById('bild-anzeige').src = bildUrl;

  // Verknüpfungen: vom Blatt direkt zum Termin und zur Schülerübersicht
  const t = termine.find((x) => x.fotoId === fotoId || x.rueckantwortId === fotoId);
  const istRueck = foto.art === 'rueckantwort';
  const fuss = document.getElementById('bild-fuss');
  fuss.replaceChildren();
  if (t) {
    document.getElementById('bild-titel').textContent =
      `${istRueck ? 'Rückantwort' : 'Tadel-Blatt'}: ${t.name}, ${t.klasse} · ${t.tadelDatum ? `Tadel vom ${datumKurz(t.tadelDatum)}` : `Termin am ${datumKurz(t.datum)}`}`;
    // Zwischen Tadel-Blatt und Rückantwort umschalten
    const anderes = istRueck ? t.fotoId : t.rueckantwortId;
    if (anderes) {
      fuss.append(el('button', {
        type: 'button',
        class: 'btn',
        onclick: () => { dlgBild.close(); zeigeFoto(anderes); },
      }, istRueck ? '📄 Tadel-Blatt' : '📎 Rückantwort'));
    }
    fuss.append(
      el('button', {
        type: 'button',
        class: 'btn',
        onclick: () => { dlgBild.close(); if (dlgSchueler.open) dlgSchueler.close(); if (dlg.open) dlg.close(); oeffneSchueler(t.name, t.klasse); },
      }, '👤 Schülerübersicht'),
      el('button', {
        type: 'button',
        class: 'btn',
        onclick: () => { dlgBild.close(); if (dlgSchueler.open) dlgSchueler.close(); if (!dlg.open) oeffneDialog(t); },
      }, '✎ Termin'),
    );
  } else {
    document.getElementById('bild-titel').textContent = istRueck ? 'Rückantwort (geschwärzt)' : 'Tadel-Blatt (geschwärzt)';
  }
  dlgBild.showModal();
}

/* ---------- Phase 7: Rückantwort beim Termin ablegen ---------- */

async function speichereRueckantwort(t, blob, abhaken) {
  const jetzt = new Date().toISOString();
  const warErledigt = erledigt(t);
  if (t.rueckantwortId) await entferneFoto(t.rueckantwortId);
  const fotoId = neueId();
  await speichereFoto({ id: fotoId, terminId: t.id, art: 'rueckantwort', bild: blob, erstellt: jetzt });
  const neu = { ...t, rueckantwortId: fotoId };
  if (abhaken) neu.unterschrieben = true;
  await speichere(neu);
  termine = await ladeAlle();
  zeichne();
  let text = `Rückantwort von ${t.name} gespeichert${abhaken ? ' und als unterschrieben abgehakt' : ''}.`;
  if (!warErledigt && erledigt(neu)) text += ' Der Termin ist erledigt und steht jetzt im Archiv.';
  zeigeToast(text);
  return neu;
}

/* ---------- Ansicht „Blätter“: alle gespeicherten Blätter nach Datum ---------- */

let vorschauUrls = [];
let vorschauBeobachter = null;

function zeichneBlaetter(liste) {
  // Alte Vorschaubilder freigeben
  vorschauUrls.forEach((u) => URL.revokeObjectURL(u));
  vorschauUrls = [];
  vorschauBeobachter?.disconnect();

  const s = suchtext.trim().toLowerCase();
  const mitBlatt = termine
    .filter((t) => t.fotoId || t.rueckantwortId)
    .filter((t) => !s || `${t.name} ${t.klasse} ${t.raum}`.toLowerCase().includes(s))
    .sort((a, b) => tadelDatumVon(b).localeCompare(tadelDatumVon(a)) || vergleich.compare(a.name, b.name));

  const anzahl = termine.filter((t) => t.fotoId || t.rueckantwortId).length;
  document.getElementById('zusammenfassung').textContent = anzahl
    ? `${anzahl} Termine mit gespeicherten Blättern (geschwärzt), neueste oben. 📎 = Rückantwort liegt vor. Tippe auf ein Blatt, um es groß zu sehen.`
    : '';

  if (!mitBlatt.length) {
    liste.append(el('p', { class: 'leer' }, s
      ? 'Keine Treffer für die Suche.'
      : 'Noch keine Blätter. Blätter kommen hierher, wenn du einen Termin über „📷 Foto“ anlegst.'));
    return;
  }

  // Vorschaubilder erst laden, wenn sie in den sichtbaren Bereich kommen
  vorschauBeobachter = 'IntersectionObserver' in window
    ? new IntersectionObserver((eintraege) => {
      for (const e of eintraege) {
        if (!e.isIntersecting) continue;
        vorschauBeobachter.unobserve(e.target);
        ladeVorschau(e.target);
      }
    }, { rootMargin: '300px' })
    : null;

  // Nach Monat gruppieren
  const monate = new Map();
  for (const t of mitBlatt) {
    const d = new Date(`${tadelDatumVon(t)}T00:00:00`);
    const key = d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    if (!monate.has(key)) monate.set(key, []);
    monate.get(key).push(t);
  }

  for (const [monat, eintraege] of monate) {
    const raster = el('div', { class: 'blatt-raster' });
    for (const t of eintraege) {
      const bild = el('img', { class: 'blatt-vorschau', alt: '', 'data-foto': t.fotoId || t.rueckantwortId });
      raster.append(el('button', {
        type: 'button',
        class: 'blatt-karte',
        'aria-label': `Blatt von ${t.name} öffnen`,
        onclick: () => zeigeFoto(t.fotoId || t.rueckantwortId),
      },
      el('span', { class: 'blatt-bildrahmen' }, bild),
      el('span', { class: 'blatt-info' },
        el('strong', {}, t.name, t.rueckantwortId ? el('span', { class: 'rueck-badge', title: 'Rückantwort liegt vor' }, ' 📎') : null),
        el('span', { class: 'blatt-zeile' }, `${t.klasse} · ${t.tadelDatum ? `Tadel ${datumKurz(t.tadelDatum)}` : `Termin ${datumKurz(t.datum)}`}`),
        el('span', { class: 'blatt-marken' },
          statusMarke(t.erschienen, 'erschienen'),
          statusMarke(t.unterschrieben, 'unterschrieben')),
      )));
      if (vorschauBeobachter) vorschauBeobachter.observe(bild);
      else ladeVorschau(bild);
    }
    liste.append(el('section', { class: 'tag' },
      el('h2', {}, monat, el('span', { class: 'anzahl' }, `${eintraege.length} ${eintraege.length === 1 ? 'Blatt' : 'Blätter'}`)),
      raster));
  }
}

async function ladeVorschau(img) {
  try {
    const foto = await ladeFoto(img.dataset.foto);
    if (!foto) return;
    const url = URL.createObjectURL(fotoBild(foto));
    vorschauUrls.push(url);
    img.src = url;
  } catch { /* Vorschau ist nicht wichtig */ }
}
document.getElementById('bild-zu').addEventListener('click', () => dlgBild.close());
dlgBild.addEventListener('click', (e) => { if (e.target === dlgBild) dlgBild.close(); });

/* ---------- Schülerdetail ---------- */

const dlgSchueler = document.getElementById('dlg-schueler');

const tadelDatumVon = (t) => t.tadelDatum || t.datum;

// Einträge einer Woche als kleine Kärtchen (gelbe Karten gelb, Rote Karte rot)
function eintragsChips(zahlen) {
  if (!zahlen) return 'Einträge der Woche nicht erfasst';
  const arten = ARTEN.filter((a) => zahlen[a.key] > 0);
  if (!arten.length) return 'keine Einträge';
  const box = el('span');
  for (const a of arten) {
    box.append(el('span', { class: `e-chip ${a.farbe || ''}` }, `${zahlen[a.key]}× ${a.name}`));
  }
  return box;
}

function statusMarke(an, text) {
  return el('span', { class: `marke ${an ? 'marke-ok' : 'marke-fehlt'}` }, `${an ? '✓' : '–'} ${text}`);
}

function oeffneSchueler(name, klasse) {
  const seine = termine
    .filter((t) => gehoertZu(t, name, klasse))
    .sort((a, b) => tadelDatumVon(b).localeCompare(tadelDatumVon(a)) || b.datum.localeCompare(a.datum));

  document.getElementById('sch-titel').textContent = name;
  const erschienen = seine.filter((t) => t.erschienen).length;
  const unterschrieben = seine.filter((t) => t.unterschrieben).length;
  document.getElementById('sch-unter').textContent =
    `Klasse ${klasse} · ${seine.length} ${seine.length === 1 ? 'Tadel' : 'Tadel'} · erschienen ${erschienen}/${seine.length} · unterschrieben ${unterschrieben}/${seine.length}`;

  const inhalt = document.getElementById('sch-inhalt');
  inhalt.replaceChildren();

  // Halbjahres-Zusammenfassung: vom neuesten Blatt, das eine hat
  // Die 7 Felder werden immer gezeigt (gelbe Karten gelb, Rote Karte rot); ohne Zahlen mit „–“
  const mitHalbjahr = seine.find((t) => t.halbjahr);
  const hjAbschnitt = el('section', { class: 'sch-abschnitt' });
  hjAbschnitt.append(el('h3', {}, mitHalbjahr
    ? `Im Halbjahr (laut Blatt vom ${datumKurz(tadelDatumVon(mitHalbjahr))})`
    : 'Im Halbjahr'));
  const raster = el('div', { class: 'hj-raster' });
  for (const a of ARTEN) {
    const n = mitHalbjahr ? (mitHalbjahr.halbjahr[a.key] || 0) : null;
    raster.append(el('div', { class: `hj-zelle ${a.farbe || ''}${n ? ' hat' : ' null'}` },
      el('span', { class: 'hj-zahl' }, n == null ? '–' : String(n)),
      el('span', { class: 'hj-art' }, a.name)));
  }
  hjAbschnitt.append(raster);
  if (!mitHalbjahr && seine.length) {
    hjAbschnitt.append(el('div', { class: 'hj-leer' },
      el('p', { class: 'hinweis' }, 'Noch keine Zahlen erfasst. Übernimm die Zeile „In diesem Halbjahr“ vom Tadel-Blatt (oder lies das Blatt per 📷 ein).'),
      el('button', {
        type: 'button',
        class: 'btn btn-klein',
        onclick: () => { dlgSchueler.close(); oeffneDialog(seine[0]); },
      }, '✎ Zahlen vom Blatt eintragen')));
  }
  inhalt.append(hjAbschnitt);

  // Verlauf: ein Eintrag pro Blatt/Termin, neueste oben
  const verlauf = el('section', { class: 'sch-abschnitt' }, el('h3', {}, 'Verlauf'));
  for (const t of seine) {
    verlauf.append(el('article', { class: 'verlauf-eintrag' },
      el('div', { class: 'verlauf-kopf' },
        el('strong', {}, t.tadelDatum ? `Tadel vom ${datumKurz(t.tadelDatum)}` : `Termin am ${datumKurz(t.datum)}`),
        el('button', {
          type: 'button',
          class: 'bearbeiten',
          'aria-label': 'Termin bearbeiten',
          title: 'Bearbeiten',
          onclick: () => { dlgSchueler.close(); oeffneDialog(t); },
        }, '✎')),
      (t.fotoId || t.rueckantwortId) ? el('div', { class: 'verlauf-knoepfe' },
        t.fotoId ? el('button', {
          type: 'button',
          class: 'btn btn-klein',
          onclick: () => zeigeFoto(t.fotoId),
        }, '📄 Blatt') : null,
        t.rueckantwortId ? el('button', {
          type: 'button',
          class: 'btn btn-klein',
          onclick: () => zeigeFoto(t.rueckantwortId),
        }, '📎 Rückantwort') : null) : null,
      el('p', { class: 'verlauf-text' }, eintragsChips(t.woche)),
      el('p', { class: 'verlauf-termin' },
        `Reflexionsstunde: ${datumLang(t.datum)}, ${t.bis ? `${t.von}–${t.bis}` : t.von} Uhr, ${t.raum}`),
      el('div', { class: 'verlauf-marken' },
        statusMarke(t.erschienen, 'erschienen'),
        statusMarke(t.unterschrieben, 'unterschrieben')),
    ));
  }
  inhalt.append(verlauf);

  dlgSchueler.showModal();
  document.getElementById('sch-zu').focus();
}

document.getElementById('sch-zu').addEventListener('click', () => dlgSchueler.close());
dlgSchueler.addEventListener('click', (e) => { if (e.target === dlgSchueler) dlgSchueler.close(); });

function leseFormular() {
  const w = (f) => form.elements[f].value.trim();
  const daten = {
    datum: w('datum'),
    von: w('von'),
    bis: w('bis'),
    raum: w('raum'),
    schueler: leseZeilen().map((s) => ({ name: kuerzelInKlasse(s.name, s.klasse), klasse: s.klasse })),
  };
  const fehlt = [];
  if (!daten.datum) fehlt.push('Datum');
  if (!daten.von) fehlt.push('Uhrzeit (von)');
  if (!daten.raum) fehlt.push('Raum');
  if (!daten.schueler.length) fehlt.push('mindestens ein Name');
  if (daten.schueler.some((s) => !s.name)) fehlt.push('Name in jeder Zeile');
  if (daten.schueler.some((s) => !s.klasse)) fehlt.push('Klasse in jeder Zeile');
  if (fehlt.length) {
    document.getElementById('fehler').textContent = `Bitte ausfüllen: ${fehlt.join(', ')}`;
    return null;
  }
  if (daten.bis && daten.bis <= daten.von) {
    document.getElementById('fehler').textContent = '„Bis“ muss nach „Von“ liegen.';
    return null;
  }
  return daten;
}

let speichertGerade = false;
async function speichereFormular(weiter) {
  if (speichertGerade) return;
  const daten = leseFormular();
  if (!daten) {
    document.getElementById('fehler').scrollIntoView({ block: 'center', behavior: 'smooth' });
    return;
  }
  speichertGerade = true;
  try {
    await speichereFormularDaten(daten, weiter);
  } catch (err) {
    document.getElementById('fehler').textContent = `Speichern fehlgeschlagen: ${err?.message || err}`;
    document.getElementById('fehler').scrollIntoView({ block: 'center', behavior: 'smooth' });
  } finally {
    speichertGerade = false;
  }
}

let fotoFehler = null;
async function speichereFormularDaten(daten, weiter) {
  fotoFehler = null;

  const { schueler, ...gemeinsam } = daten;
  // Einträge laut Blatt nur, wenn es genau ein Schüler ist
  const blatt = schueler.length === 1
    ? { tadelDatum: form.elements.tadelDatum.value.trim(), woche: leseZahlen('w'), halbjahr: leseZahlen('h') }
    : {};

  if (bearbeiteId) {
    await speichere({ ...termine.find((x) => x.id === bearbeiteId), ...gemeinsam, ...schueler[0], ...blatt });
  } else {
    const jetzt = new Date().toISOString();
    for (const s of schueler) {
      const neu = { id: neueId(), erschienen: false, unterschrieben: false, erstellt: jetzt, ...gemeinsam, ...s, ...blatt };
      // Geschwärztes Foto vom Blatt (nur bei einem Schüler aus der Fotoerkennung)
      if (aktuellerVorschlag?.fotoBlob && schueler.length === 1) {
        // Scheitert das Bild, wird der Termin trotzdem gespeichert
        try {
          const fotoId = neueId();
          await speichereFoto({ id: fotoId, terminId: neu.id, art: 'tadel', bild: aktuellerVorschlag.fotoBlob, erstellt: jetzt });
          neu.fotoId = fotoId;
        } catch (err) {
          fotoFehler = err;
        }
      }
      await speichere(neu);
    }
    lokal('letzterTermin', JSON.stringify({ datum: gemeinsam.datum, von: gemeinsam.von, bis: gemeinsam.bis, raum: gemeinsam.raum }));
    if (schueler.length > 1) zeigeToast(`${schueler.length} Termine angelegt.`);
    // Neue Termine sind nie erledigt: zur aktuellen Liste wechseln, damit man sie sieht
    ansicht = 'aktuell';
    lokal('ansicht', ansicht);
  }
  termine = await ladeAlle();
  zeichne();

  if (weiter) {
    oeffneDialog();
  } else {
    dlg.close();
  }
  if (fotoFehler) meldung(`Der Termin ist gespeichert, aber das Foto vom Blatt konnte nicht gespeichert werden (${fotoFehler?.message || fotoFehler}).`);
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  speichereFormular(false);
});
document.getElementById('btn-weiter').addEventListener('click', () => speichereFormular(true));
document.getElementById('btn-abbrechen').addEventListener('click', () => dlg.close());
document.getElementById('btn-loeschen').addEventListener('click', async () => {
  const t = termine.find((x) => x.id === bearbeiteId);
  if (!t) return;
  if (!(await frage(`Termin von ${t.name} am ${datumLang(t.datum)} wirklich löschen? Auch gespeicherte Blätter dieses Termins werden gelöscht.`, { ja: 'Löschen', gefahr: true }))) return;
  await entferne(t.id);
  if (t.fotoId) await entferneFoto(t.fotoId);
  if (t.rueckantwortId) await entferneFoto(t.rueckantwortId);
  termine = await ladeAlle();
  dlg.close();
  zeichne();
});
document.getElementById('btn-zeile').addEventListener('click', () => {
  neueZeile().querySelector('.z-name').focus();
});

/* ---------- Bedienelemente ---------- */

document.getElementById('btn-neu').addEventListener('click', () => oeffneDialog());
document.querySelectorAll('.chip[data-ansicht]').forEach((c) => c.addEventListener('click', () => {
  ansicht = c.dataset.ansicht;
  lokal('ansicht', ansicht);
  zeichne();
  window.scrollTo(0, 0);
}));
document.getElementById('suche').addEventListener('input', (e) => {
  suchtext = e.target.value;
  zeichne();
});

/* ---------- Start ---------- */

(async function start() {
  // Erst loslegen, wenn alle Skripte (klassen.js, listen.js, sammlung.js …) geladen sind
  if (document.readyState === 'loading') await new Promise((r) => document.addEventListener('DOMContentLoaded', r, { once: true }));
  baueEintragsRaster();
  try {
    db = await oeffneDb();
    termine = await ladeAlle();
    klassen = await ladeKlassen();
    listen = await ladeListen();
    sammlungen = await ladeSammlungen();
    // Browser bitten, die Daten dauerhaft zu behalten (wichtig auf dem iPad)
    if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
  } catch (err) {
    document.getElementById('liste').append(el('p', { class: 'leer' },
      `Der Speicher konnte nicht geöffnet werden (${err?.message || err}). Ist der private Modus aktiv?`));
    return;
  }
  zeichne();
  // Im Claude-Artefakt: Daten mit dem Speicher bei claude.ai abgleichen (wolke.js)
  if (typeof wolkeAktualisiere === "function") wolkeAktualisiere();
})();
