'use strict';

/*
 * Phase 10: Listen pro Klasse (Tanzgeld, Fahrkarten, Schwimmen …).
 * Eine Liste: { id, klasseId, titel, bereich, frist, spalten: [{ id, titel, art, soll }], werte, archiviert, erstellt }
 * art: 'haken' | 'text' | 'geld' | 'datum'. werte[schuelerId][spaltenId] = true / Text / Zahl / 'JJJJ-MM-TT'.
 * Zeilen sind immer die aktuellen Schüler der Klasse; wer neu dazukommt, steht sofort mit drin.
 */

const SPALTEN_ARTEN = {
  haken: { name: 'Haken', zeichen: '☑' },
  text: { name: 'Text', zeichen: '✎' },
  geld: { name: 'Geld', zeichen: '€' },
  datum: { name: 'Datum', zeichen: '📅' },
};
const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const ALLGEMEIN = 'Allgemein';
let offeneListeId = null;

/* ---------- Auswertung ---------- */

const listeSchueler = (l) => {
  const k = klassen.find((x) => x.id === l.klasseId);
  return k ? [...k.schueler].sort((a, b) => vergleich.compare(a.name, b.name)) : [];
};
const pflichtSpalten = (l) => l.spalten.filter((s) => s.art !== 'text');

function spalteErfuellt(sp, wert) {
  if (sp.art === 'haken') return wert === true;
  if (sp.art === 'geld') return wert != null && wert !== '' && (sp.soll ? Number(wert) >= sp.soll : true);
  if (sp.art === 'datum') return !!wert;
  return true;
}

// Offen = mindestens eine Haken-, Geld- oder Datum-Spalte ist noch nicht erfüllt
function offeneSchueler(l) {
  const pflicht = pflichtSpalten(l);
  if (!pflicht.length) return [];
  return listeSchueler(l).filter((s) => pflicht.some((sp) => !spalteErfuellt(sp, l.werte?.[s.id]?.[sp.id])));
}

function tageBis(iso) {
  const heute = new Date(`${heuteIso()}T00:00:00`);
  return Math.round((new Date(`${iso}T00:00:00`) - heute) / 86400000);
}
function fristText(iso) {
  const t = tageBis(iso);
  if (t < 0) return `Frist abgelaufen (${datumKurz(iso)})`;
  if (t === 0) return 'Frist heute';
  if (t === 1) return 'Frist morgen';
  return `Frist ${datumKurz(iso)}`;
}

/* ---------- Erinnerungen (in allen Reitern) ---------- */

function zeichneErinnerungen() {
  const box = document.getElementById('erinnerungen');
  const faellig = listen
    .filter((l) => !l.archiviert && l.frist && tageBis(l.frist) <= 1)
    .map((l) => ({ l, offen: offeneSchueler(l).length, k: klassen.find((x) => x.id === l.klasseId) }))
    .filter((x) => x.offen > 0 && x.k)
    .sort((a, b) => a.l.frist.localeCompare(b.l.frist));
  box.hidden = !faellig.length;
  box.replaceChildren(...faellig.map(({ l, offen, k }) => el('div', { class: `erinnerung${tageBis(l.frist) < 0 ? ' ueberfaellig' : ''}` },
    el('span', {}, `⏰ ${l.titel} (${k.name}): ${offen} noch offen · ${fristText(l.frist)}`),
    el('button', { type: 'button', class: 'btn btn-klein', onclick: () => oeffneListe(l) }, 'Öffnen'),
  )));
}

function oeffneListe(l) {
  reiter = 'listen';
  lokal('reiter', reiter);
  gewaehlteKlasse = l.klasseId;
  lokal('klasse', l.klasseId);
  offeneListeId = l.id;
  zeichne();
  window.scrollTo(0, 0);
}

/* ---------- Reiter „Listen“: Übersicht ---------- */

function zeichneListen() {
  const bereich = document.getElementById('bereich-listen');
  bereich.replaceChildren();
  if (!klassen.length) {
    keineKlasse(bereich, 'Listen gehören zu einer Klasse. Lege zuerst eine Klasse mit ihren Schülern an.');
    return;
  }
  const offen = listen.find((l) => l.id === offeneListeId);
  if (offen && klassen.some((k) => k.id === offen.klasseId)) { zeichneListenTabelle(bereich, offen); return; }
  offeneListeId = null;

  const k = aktuelleKlasse();
  bereich.append(klassenWahl(k), klassenKopf(k));
  bereich.append(el('div', { class: 'listen-kopf' },
    el('h3', {}, 'Listen'),
    el('button', { type: 'button', class: 'btn btn-primary btn-klein', onclick: () => oeffneListenDialog(null, k) }, '+ Liste'),
  ));

  const meine = listen.filter((l) => l.klasseId === k.id);
  const aktiv = meine.filter((l) => !l.archiviert);
  if (!aktiv.length) {
    bereich.append(el('p', { class: 'leer' }, `Noch keine Listen für ${k.name}. Mit „+ Liste“ anlegen, z. B. „Tanzgeld“ oder „Schwimmen: Badesachen“.`));
  }
  // Nach Bereich gruppiert: „Allgemein“ zuerst, dann alphabetisch
  const gruppen = new Map();
  for (const l of aktiv) {
    const b = l.bereich || ALLGEMEIN;
    if (!gruppen.has(b)) gruppen.set(b, []);
    gruppen.get(b).push(l);
  }
  const namen = [...gruppen.keys()].sort((a, b) => (a === ALLGEMEIN ? -1 : b === ALLGEMEIN ? 1 : vergleich.compare(a, b)));
  for (const b of namen) {
    const liste = gruppen.get(b).sort((x, y) => (x.frist || '9999').localeCompare(y.frist || '9999') || vergleich.compare(x.titel, y.titel));
    bereich.append(el('h4', { class: 'listen-bereich' }, b), el('div', { class: 'listen-raster' }, ...liste.map(listenKarte)));
  }
  const archiv = meine.filter((l) => l.archiviert);
  if (archiv.length) {
    const details = el('details', { class: 'listen-archiv' },
      el('summary', {}, `Archiv (${archiv.length})`),
      el('div', { class: 'listen-raster' }, ...archiv.sort((x, y) => (y.erstellt || '').localeCompare(x.erstellt || '')).map(listenKarte)));
    bereich.append(details);
  }
}

function listenKarte(l) {
  const alle = listeSchueler(l).length;
  const offen = offeneSchueler(l).length;
  const pflicht = pflichtSpalten(l).length;
  const anteil = alle && pflicht ? (alle - offen) / alle : 0;
  const status = !pflicht ? `${alle} Schüler` : offen ? `Noch offen: ${offen} von ${alle}` : '✓ Alle erledigt';
  const spaet = l.frist && offen && tageBis(l.frist) < 0;
  return el('button', { type: 'button', class: `liste-karte${offen ? '' : ' fertig'}`, onclick: () => { offeneListeId = l.id; zeichneListen(); window.scrollTo(0, 0); } },
    el('span', { class: 'lk-titel' }, l.titel),
    el('span', { class: `lk-status${offen ? ' offen' : ''}` }, status),
    l.frist ? el('span', { class: `lk-frist${spaet ? ' spaet' : ''}` }, fristText(l.frist)) : null,
    pflicht ? el('span', { class: 'lk-balken' }, el('span', { style: `width:${Math.round(anteil * 100)}%` })) : null,
  );
}

/* ---------- Eine Liste als Tabelle ---------- */

function zellText(sp, wert) {
  if (sp.art === 'geld') return wert == null || wert === '' ? '–' : euro.format(Number(wert));
  if (sp.art === 'datum') return wert ? datumKurz(wert).slice(0, 6) : '–';
  return '';
}

function zeichneListenTabelle(bereich, l) {
  const k = klassen.find((x) => x.id === l.klasseId);
  const schueler = listeSchueler(l);
  const offen = offeneSchueler(l);
  bereich.append(
    el('button', { type: 'button', class: 'btn btn-klein zurueck', onclick: () => { offeneListeId = null; zeichneListen(); } }, `← Listen ${k.name}`),
    el('div', { class: 'liste-titel' },
      el('h2', {}, l.titel + (l.archiviert ? ' (Archiv)' : '')),
      el('p', { class: 'hinweis' }, [
        `Klasse ${k.name}`, l.bereich || ALLGEMEIN, l.frist ? fristText(l.frist) : null,
        pflichtSpalten(l).length ? (offen.length ? `noch offen: ${offen.length} von ${schueler.length}` : 'alle erledigt ✓') : null,
      ].filter(Boolean).join(' · ')),
    ),
  );
  const knoepfe = el('div', { class: 'liste-knoepfe' },
    pflichtSpalten(l).length ? el('button', { type: 'button', class: 'btn btn-klein', onclick: () => werFehlt(l) }, '📋 Wer fehlt noch?') : null,
    el('button', { type: 'button', class: 'btn btn-klein', onclick: () => oeffneListenDialog(l, k) }, '✎ Bearbeiten'),
    l.archiviert
      ? el('button', { type: 'button', class: 'btn btn-klein', onclick: () => archiviere(l, false) }, '↩ Zurückholen')
      : el('button', { type: 'button', class: 'btn btn-klein', onclick: () => archiviere(l, true) }, '📦 Archivieren'),
    el('button', { type: 'button', class: 'btn btn-klein btn-gefahr', onclick: () => loescheListe(l) }, '🗑 Löschen'),
  );
  bereich.append(knoepfe);

  if (!schueler.length) {
    bereich.append(el('p', { class: 'leer' }, 'Die Klasse hat noch keine Schüler.'));
    return;
  }

  const tabelle = el('table', { class: 'li-tabelle' });
  const kopf = el('tr', {}, el('th', { class: 'li-name', scope: 'col' }, 'Name'));
  for (const sp of l.spalten) {
    kopf.append(el('th', { scope: 'col', class: `li-${sp.art}` },
      el('span', { class: 'li-art' }, SPALTEN_ARTEN[sp.art].zeichen),
      ` ${sp.titel}`,
      sp.art === 'geld' && sp.soll ? el('small', {}, ` (${euro.format(sp.soll)})`) : null));
  }
  tabelle.append(el('thead', {}, kopf));

  const koerper = el('tbody');
  for (const s of schueler) {
    const zeile = el('tr', { class: offen.includes(s) ? 'offen' : '' }, el('th', { class: 'li-name', scope: 'row' }, s.name));
    for (const sp of l.spalten) zeile.append(el('td', { class: `li-${sp.art}` }, zelle(l, s, sp)));
    koerper.append(zeile);
  }
  tabelle.append(koerper);

  // Summen
  const fuss = el('tr', {}, el('th', { class: 'li-name', scope: 'row' }, 'Summe'));
  for (const sp of l.spalten) {
    const werte = schueler.map((s) => l.werte?.[s.id]?.[sp.id]);
    let text = '';
    if (sp.art === 'haken') text = `${werte.filter((w) => w === true).length}/${schueler.length}`;
    if (sp.art === 'datum') text = `${werte.filter(Boolean).length}/${schueler.length}`;
    if (sp.art === 'geld') {
      const summe = werte.reduce((a, w) => a + (w == null || w === '' ? 0 : Number(w)), 0);
      text = euro.format(summe) + (sp.soll ? ` von ${euro.format(sp.soll * schueler.length)}` : '');
    }
    fuss.append(el('td', { class: `li-${sp.art} li-summe` }, text));
  }
  tabelle.append(el('tfoot', {}, fuss));
  bereich.append(el('div', { class: 'li-huelle' }, tabelle));
}

function zelle(l, s, sp) {
  const wert = l.werte?.[s.id]?.[sp.id];
  if (sp.art === 'haken') {
    const an = wert === true;
    return el('button', {
      type: 'button', class: 'li-haken-knopf', 'aria-pressed': String(an), 'aria-label': `${sp.titel}: ${s.name}`,
      onclick: () => setzeListenWert(l, s, sp, an ? null : true),
    }, an ? '✓' : '');
  }
  if (sp.art === 'text') {
    const feld = el('input', { type: 'text', class: 'li-text-feld', 'aria-label': `${sp.titel}: ${s.name}`, autocomplete: 'off' });
    feld.value = wert || '';
    // Text zählt nicht für „offen“: speichern ohne neu zu zeichnen (Tastatur bleibt offen)
    feld.addEventListener('change', () => setzeListenWert(l, s, sp, feld.value.trim() || null, false));
    return feld;
  }
  if (sp.art === 'geld') {
    const voll = spalteErfuellt(sp, wert) && wert != null;
    return el('button', {
      type: 'button', class: `li-wert-knopf${wert == null ? ' li-leer' : voll ? ' ok' : ' teil'}`, 'aria-label': `${sp.titel}: ${s.name}`,
      onclick: async () => {
        // Leer + Soll-Betrag: ein Tipp trägt den Soll-Betrag ein; sonst Betrag eingeben
        if ((wert == null || wert === '') && sp.soll) { setzeListenWert(l, s, sp, sp.soll); return; }
        const neu = await eingabe(`${sp.titel} – ${s.name}: Betrag in €`, { wert: wert ?? '', typ: 'text', modus: 'decimal', leeren: wert != null, platzhalter: 'z. B. 12,50' });
        if (neu === null) return;
        if (neu === '') { setzeListenWert(l, s, sp, null); return; }
        const zahl = Number(neu.replace(/\s|€/g, '').replace(',', '.'));
        if (!Number.isFinite(zahl) || zahl < 0) { meldung('Bitte einen Betrag eingeben, z. B. 12,50.'); return; }
        setzeListenWert(l, s, sp, Math.round(zahl * 100) / 100);
      },
    }, zellText(sp, wert));
  }
  // Datum: leer -> ein Tipp setzt heute; gesetzt -> ändern oder leeren
  return el('button', {
    type: 'button', class: `li-wert-knopf${wert ? ' ok' : ' li-leer'}`, 'aria-label': `${sp.titel}: ${s.name}`,
    onclick: async () => {
      if (!wert) { setzeListenWert(l, s, sp, heuteIso()); return; }
      const neu = await eingabe(`${sp.titel} – ${s.name}: Datum`, { wert, typ: 'date', leeren: true });
      if (neu === null) return;
      setzeListenWert(l, s, sp, neu || null);
    },
  }, zellText(sp, wert));
}

async function setzeListenWert(l, s, sp, wert, neuZeichnen = true) {
  const neu = structuredClone(l);
  neu.werte ||= {};
  neu.werte[s.id] ||= {};
  if (wert == null || wert === '') delete neu.werte[s.id][sp.id];
  else neu.werte[s.id][sp.id] = wert;
  if (!Object.keys(neu.werte[s.id]).length) delete neu.werte[s.id];
  try {
    await speichereListe(neu);
  } catch (err) {
    meldung(`Speichern fehlgeschlagen: ${err?.message || err}`);
    return;
  }
  listen = listen.map((x) => (x.id === neu.id ? neu : x));
  if (!neuZeichnen) return;
  // Waagrechte Position der Tabelle beibehalten
  const huelle = document.querySelector('#bereich-listen .li-huelle');
  const links = huelle?.scrollLeft || 0;
  zeichne();
  const neuHuelle = document.querySelector('#bereich-listen .li-huelle');
  if (neuHuelle) neuHuelle.scrollLeft = links;
}

async function werFehlt(l) {
  const offen = offeneSchueler(l);
  const k = klassen.find((x) => x.id === l.klasseId);
  const text = offen.length
    ? `${l.titel} (${k.name}) – noch offen (${offen.length}): ${offen.map((s) => s.name).join(', ')}`
    : `${l.titel} (${k.name}): alle erledigt.`;
  try {
    await navigator.clipboard.writeText(text);
    zeigeToast('Kopiert – zum Einfügen z. B. in eine Nachricht.');
  } catch {
    // Zwischenablage gesperrt (z. B. im Artefakt): Text anzeigen, er lässt sich markieren
    meldung(text);
  }
}

async function archiviere(l, an) {
  const neu = { ...l, archiviert: an };
  await speichereListe(neu);
  listen = await ladeListen();
  if (an) offeneListeId = null;
  zeichne();
  zeigeToast(an ? `„${l.titel}“ ist im Archiv.` : `„${l.titel}“ ist wieder aktiv.`);
}

async function loescheListe(l) {
  if (!(await frage(`Liste „${l.titel}“ endgültig löschen? Alle Haken und Einträge darin gehen verloren.`, { ja: 'Löschen', gefahr: true }))) return false;
  await entferneListe(l.id);
  listen = await ladeListen();
  offeneListeId = null;
  zeichne();
  return true;
}

/* ---------- Fenster „Liste anlegen / bearbeiten“ ---------- */

const dlgListe = document.getElementById('dlg-liste');
let bearbeiteListe = null;
let listenKlasse = null;

function spaltenZeile(sp) {
  const art = el('select', { class: 'sp-art', 'aria-label': 'Art der Spalte' },
    ...Object.entries(SPALTEN_ARTEN).map(([wert, a]) => el('option', { value: wert }, `${a.zeichen} ${a.name}`)));
  art.value = sp.art;
  const titel = el('input', { type: 'text', class: 'sp-titel', placeholder: 'Spaltenname', autocomplete: 'off', 'aria-label': 'Spaltenname' });
  titel.value = sp.titel || '';
  const soll = el('input', { type: 'text', inputmode: 'decimal', class: 'sp-soll', placeholder: 'Soll €', 'aria-label': 'Soll-Betrag in Euro' });
  soll.value = sp.soll ? String(sp.soll).replace('.', ',') : '';
  soll.hidden = sp.art !== 'geld';
  art.addEventListener('change', () => { soll.hidden = art.value !== 'geld'; });
  const zeile = el('div', { class: 'sp-zeile', 'data-id': sp.id }, titel, art, soll,
    el('button', { type: 'button', class: 'z-weg', 'aria-label': 'Spalte entfernen', title: 'Spalte entfernen', onclick: () => zeile.remove() }, '×'));
  return zeile;
}

function oeffneListenDialog(l, k) {
  bearbeiteListe = l;
  listenKlasse = k;
  document.getElementById('li-titel').textContent = l ? 'Liste bearbeiten' : `Neue Liste für ${k.name}`;
  document.getElementById('li-name').value = l?.titel || '';
  document.getElementById('li-bereich').value = l?.bereich || '';
  document.getElementById('li-frist').value = l?.frist || '';
  document.getElementById('li-fehler').textContent = '';
  document.getElementById('li-loeschen').hidden = !l;
  // Vorschläge für den Bereich: Allgemein, Fächer der Klasse, schon benutzte Bereiche
  const bereiche = [...new Set([ALLGEMEIN, 'Schwimmen', ...(k.faecher || []), ...listen.map((x) => x.bereich).filter(Boolean)])];
  document.getElementById('li-bereiche').replaceChildren(...bereiche.map((b) => el('option', { value: b })));
  // Vorlage: Spalten einer vorhandenen Liste (auch aus anderen Klassen) übernehmen
  const vorlage = document.getElementById('li-vorlage');
  document.getElementById('li-vorlage-feld').hidden = !!l || !listen.length;
  vorlage.replaceChildren(el('option', { value: '' }, '– keine –'),
    ...[...listen].sort((a, b) => vergleich.compare(a.titel, b.titel)).map((x) => {
      const kl = klassen.find((y) => y.id === x.klasseId);
      return el('option', { value: x.id }, `${x.titel}${kl ? ` (${kl.name})` : ''}`);
    }));
  const spalten = document.getElementById('li-spalten');
  spalten.replaceChildren(...(l ? l.spalten : [{ id: neueId(), titel: 'Abgegeben', art: 'haken' }]).map(spaltenZeile));
  dlgListe.showModal();
  if (!l) document.getElementById('li-name').focus();
}

document.getElementById('li-vorlage').addEventListener('change', (e) => {
  const v = listen.find((x) => x.id === e.target.value);
  if (!v) return;
  document.getElementById('li-spalten').replaceChildren(...v.spalten.map((sp) => spaltenZeile({ ...sp, id: neueId() })));
  const name = document.getElementById('li-name');
  if (!name.value.trim()) name.value = v.titel;
  const bereich = document.getElementById('li-bereich');
  if (!bereich.value.trim()) bereich.value = v.bereich || '';
});
document.getElementById('li-spalte-neu').addEventListener('click', () => {
  const zeile = spaltenZeile({ id: neueId(), titel: '', art: 'haken' });
  document.getElementById('li-spalten').append(zeile);
  zeile.querySelector('.sp-titel').focus();
});
document.getElementById('li-abbrechen').addEventListener('click', () => dlgListe.close());
document.getElementById('li-loeschen').addEventListener('click', async () => {
  if (!bearbeiteListe) return;
  dlgListe.close();
  if (!(await loescheListe(bearbeiteListe))) dlgListe.showModal();
});

document.getElementById('li-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fehler = document.getElementById('li-fehler');
  const titel = document.getElementById('li-name').value.trim();
  if (!titel) { fehler.textContent = 'Bitte einen Titel eingeben.'; return; }
  const spalten = [...document.querySelectorAll('#li-spalten .sp-zeile')].map((z) => {
    const art = z.querySelector('.sp-art').value;
    const sollRoh = z.querySelector('.sp-soll').value.replace(/\s|€/g, '').replace(',', '.');
    const soll = art === 'geld' && sollRoh ? Number(sollRoh) : null;
    return {
      id: z.dataset.id,
      titel: z.querySelector('.sp-titel').value.trim() || SPALTEN_ARTEN[art].name,
      art,
      ...(soll && Number.isFinite(soll) && soll > 0 ? { soll: Math.round(soll * 100) / 100 } : {}),
    };
  });
  if (!spalten.length) { fehler.textContent = 'Die Liste braucht mindestens eine Spalte.'; return; }
  const alt = bearbeiteListe;
  const werte = structuredClone(alt?.werte || {});
  // Gelöschte Spalten oder geänderte Art: alte Werte dieser Spalte passen nicht mehr
  for (const altSp of alt?.spalten || []) {
    const neuSp = spalten.find((s) => s.id === altSp.id);
    if (neuSp && neuSp.art === altSp.art) continue;
    for (const sid of Object.keys(werte)) {
      delete werte[sid][altSp.id];
      if (!Object.keys(werte[sid]).length) delete werte[sid];
    }
  }
  const liste = {
    ...(alt || { id: neueId(), klasseId: listenKlasse.id, archiviert: false, erstellt: new Date().toISOString() }),
    titel,
    bereich: document.getElementById('li-bereich').value.trim() || ALLGEMEIN,
    frist: document.getElementById('li-frist').value || null,
    spalten,
    werte,
  };
  try {
    await speichereListe(liste);
  } catch (err) {
    fehler.textContent = `Speichern fehlgeschlagen: ${err?.message || err}`;
    return;
  }
  listen = await ladeListen();
  offeneListeId = liste.id;
  dlgListe.close();
  zeichne();
});
