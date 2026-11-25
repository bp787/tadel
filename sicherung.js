'use strict';

/* ==========================================================================
   Phase 8: Datensicherung
   - Export: alle Termine + geschwärzten Fotos in eine JSON-Datei
     (iPhone: Teilen-Menü → „In Dateien sichern“ / AirDrop; sonst Download)
   - Import: „Zusammenführen“ (ergänzen/aktualisieren) oder „Alles ersetzen“
   - Erinnerung oben in der Liste, wenn die letzte Sicherung > 14 Tage her ist
   ========================================================================== */

const SICHERUNG_FORMAT = 'tadelverwaltung-sicherung';
const SICHERUNG_VERSION = 1;
const ERINNERN_NACH_TAGEN = 14;

const dlgSicherung = document.getElementById('dlg-sicherung');
let fertigeDatei = null;   // zuletzt erstellte Sicherungsdatei
let geleseneSicherung = null; // zuletzt geöffnete Sicherungsdatei (Inhalt)

/* ---------- Hilfen ---------- */

const ladeAlleFotos = () => anfrage(fotoAblage('readonly').getAll());

function blobAlsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function dataUrlAlsBlob(dataUrl) {
  const [kopf, daten] = dataUrl.split(',');
  const typ = (kopf.match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
  const bin = atob(daten);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: typ });
}

// Für die Speicherung wie speichereFoto: Bilddaten als ArrayBuffer statt Blob
function dataUrlAlsDaten(dataUrl) {
  const [kopf, daten] = dataUrl.split(',');
  const bin = atob(daten);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bildDaten: bytes.buffer, bildTyp: (kopf.match(/data:([^;]+)/) || [])[1] || 'image/jpeg' };
}

function tageSeit(iso) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function groesse(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

function seitText(tage) {
  if (tage == null) return 'noch nie';
  if (tage === 0) return 'heute';
  if (tage === 1) return 'gestern';
  return `vor ${tage} Tagen`;
}

/* ---------- Erinnerung in der Hauptansicht ---------- */

function aktualisiereSicherungsHinweis() {
  const box = document.getElementById('sicherung-hinweis');
  if (!box) return;
  const letzte = lokal('letzteSicherung');
  const tage = tageSeit(letzte);
  const faellig = (termine.length > 0 || klassen.length > 0) && (tage == null || tage >= ERINNERN_NACH_TAGEN);
  box.hidden = !faellig;
  if (!faellig) return;
  box.replaceChildren(
    el('span', {}, `💾 Letzte Datensicherung: ${seitText(tage)}. Sichere deine Daten regelmäßig, damit nichts verloren geht.`),
    el('button', { type: 'button', class: 'btn btn-klein', onclick: oeffneSicherung }, 'Jetzt sichern'),
  );
}

/* ---------- Dialog ---------- */

async function oeffneSicherung() {
  fertigeDatei = null;
  geleseneSicherung = null;
  document.getElementById('si-fertig').hidden = true;
  document.getElementById('si-vorschau').hidden = true;
  const fotos = await ladeAlleFotos();
  const letzte = lokal('letzteSicherung');
  let stand = `Auf diesem Gerät: ${termine.length} Termine, ${klassen.length} Klassen, ${listen.length} Listen, ${sammlungen.length} Sammlungen, ${fotos.length} Blätter/Rückantworten. Letzte Sicherung: ${seitText(tageSeit(letzte))}`;
  if (letzte) stand += ` (${datumKurz(letzte.slice(0, 10))})`;
  stand += '.';
  try {
    if (navigator.storage?.estimate) {
      const { usage } = await navigator.storage.estimate();
      if (usage) stand += ` Belegter Speicher: ca. ${groesse(usage)}.`;
    }
    if (navigator.storage?.persisted && !(await navigator.storage.persisted())) {
      stand += ' Hinweis: Der Browser hat den dauerhaften Speicher nicht zugesichert. Umso wichtiger sind Sicherungen.';
    }
  } catch { /* nur Zusatzinfo */ }
  document.getElementById('si-stand').textContent = stand;
  dlgSicherung.showModal();
}

/* ---------- Export ---------- */

async function erstelleSicherung() {
  const knopf = document.getElementById('si-export');
  knopf.disabled = true;
  knopf.textContent = 'Sicherung wird erstellt …';
  try {
    const fotos = await ladeAlleFotos();
    const fotoDaten = [];
    for (const f of fotos) {
      fotoDaten.push({ id: f.id, terminId: f.terminId, art: f.art, erstellt: f.erstellt, bild: await blobAlsDataUrl(fotoBild(f)) });
    }
    const inhalt = {
      format: SICHERUNG_FORMAT,
      version: SICHERUNG_VERSION,
      erstellt: new Date().toISOString(),
      termine: await ladeAlle(),
      klassen: await ladeKlassen(),
      listen: await ladeListen(),
      sammlungen: await ladeSammlungen(),
      fotos: fotoDaten,
    };
    // Immer derselbe Dateiname: Die neue Sicherung ersetzt die alte, statt dass sich Dateien ansammeln.
    // Das Datum steht in der Datei (erstellt) und wird beim Öffnen angezeigt.
    const name = 'tadel-sicherung.json';
    fertigeDatei = new File([JSON.stringify(inhalt)], name, { type: 'application/json' });

    document.getElementById('si-fertig-text').textContent =
      `Fertig: ${name} (${groesse(fertigeDatei.size)}) mit ${inhalt.termine.length} Terminen, ${inhalt.klassen.length} Klassen, ${inhalt.listen.length} Listen und ${fotoDaten.length} Bildern. `
      + 'Speichere sie am selben Ort wie die letzte Sicherung und tippe bei der Frage auf „Ersetzen“, dann bleibt immer nur eine Datei.';
    // Im Claude-Artefakt gibt es nur den Speichern-Dialog von claude.ai; Teilen ist dort gesperrt
    const imArtefakt = !!(await holeDownloads());
    const teilenMoeglich = !imArtefakt && !!(navigator.canShare && navigator.canShare({ files: [fertigeDatei] }));
    document.getElementById('si-teilen').hidden = !teilenMoeglich;
    document.getElementById('si-laden').textContent = imArtefakt ? '💾 Datei speichern' : '⬇ Herunterladen';
    document.getElementById('si-fertig').hidden = false;
  } catch (err) {
    meldung(`Die Sicherung konnte nicht erstellt werden: ${err?.message || err}`);
  } finally {
    knopf.disabled = false;
    knopf.textContent = '💾 Sicherung erstellen';
  }
}

function merkeSicherung() {
  lokal('letzteSicherung', new Date().toISOString());
  aktualisiereSicherungsHinweis();
  zeigeToast('Sicherung gespeichert.');
}

async function teileSicherung() {
  if (!fertigeDatei) return;
  try {
    await navigator.share({ files: [fertigeDatei], title: 'Tadelverwaltung – Sicherung' });
    merkeSicherung();
  } catch (err) {
    if (err?.name !== 'AbortError') meldung(`Teilen hat nicht geklappt (${err?.message || err}). Bitte „Herunterladen“ verwenden.`);
  }
}

// Speichern-Funktion von claude.ai (nur im Artefakt vorhanden, sonst null)
let downloadsApi;
async function holeDownloads() {
  if (downloadsApi !== undefined) return downloadsApi;
  try {
    downloadsApi = window.claude?.use ? await window.claude.use('downloads') : null;
  } catch {
    downloadsApi = null;
  }
  return downloadsApi;
}
holeDownloads(); // früh anfragen, damit der Klick später nicht warten muss

async function ladeSicherungHerunter() {
  if (!fertigeDatei) return;
  const dl = await holeDownloads();
  if (dl) {
    try {
      await dl.save({ filename: fertigeDatei.name, data: fertigeDatei });
      merkeSicherung();
    } catch (err) {
      if (err?.code === 'declined') return;
      if (err?.code === 'rate_limited') { meldung('Es ist schon ein Speichern-Fenster offen. Bitte kurz warten und noch einmal tippen.'); return; }
      meldung(`Die Datei konnte nicht gespeichert werden (${err?.message || err?.code || err}).`);
    }
    return;
  }
  const url = URL.createObjectURL(fertigeDatei);
  const a = el('a', { href: url, download: fertigeDatei.name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  merkeSicherung();
}

/* ---------- Import ---------- */

function pruefeSicherung(inhalt) {
  if (!inhalt || inhalt.format !== SICHERUNG_FORMAT) throw new Error('Das ist keine Sicherungsdatei der Tadelverwaltung.');
  if (inhalt.version > SICHERUNG_VERSION) throw new Error('Die Sicherung stammt aus einer neueren Version der App.');
  if (!Array.isArray(inhalt.termine) || !Array.isArray(inhalt.fotos)) throw new Error('Die Sicherungsdatei ist unvollständig.');
  for (const t of inhalt.termine) {
    if (!t?.id || !t.name || !t.datum) throw new Error('Die Sicherungsdatei enthält fehlerhafte Termine.');
  }
  for (const f of inhalt.fotos) {
    if (!f?.id || typeof f.bild !== 'string' || !f.bild.startsWith('data:')) throw new Error('Die Sicherungsdatei enthält fehlerhafte Bilder.');
  }
  // Klassen gibt es erst seit Phase 9; ältere Sicherungen haben keine
  if (inhalt.klassen != null && !Array.isArray(inhalt.klassen)) throw new Error('Die Sicherungsdatei enthält fehlerhafte Klassen.');
  for (const k of inhalt.klassen || []) {
    if (!k?.id || !k.name || !Array.isArray(k.schueler)) throw new Error('Die Sicherungsdatei enthält fehlerhafte Klassen.');
  }
  // Listen gibt es erst seit Phase 10
  if (inhalt.listen != null && !Array.isArray(inhalt.listen)) throw new Error('Die Sicherungsdatei enthält fehlerhafte Listen.');
  for (const l of inhalt.listen || []) {
    if (!l?.id || !l.klasseId || !Array.isArray(l.spalten)) throw new Error('Die Sicherungsdatei enthält fehlerhafte Listen.');
  }
  // Sammlungen gibt es erst seit Phase 11
  if (inhalt.sammlungen != null && !Array.isArray(inhalt.sammlungen)) throw new Error('Die Sicherungsdatei enthält fehlerhafte Sammlungen.');
  for (const s of inhalt.sammlungen || []) {
    if (!s?.id || !s.klasseId || !Array.isArray(s.eintraege)) throw new Error('Die Sicherungsdatei enthält fehlerhafte Sammlungen.');
  }
}

async function liesSicherungsdatei(datei) {
  try {
    const inhalt = JSON.parse(await datei.text());
    pruefeSicherung(inhalt);
    geleseneSicherung = inhalt;
    const vorhanden = new Set(termine.map((t) => t.id));
    const neu = inhalt.termine.filter((t) => !vorhanden.has(t.id)).length;
    document.getElementById('si-vorschau-text').textContent =
      `„${datei.name}“ vom ${datumKurz(inhalt.erstellt.slice(0, 10))}: ${inhalt.termine.length} Termine (${neu} davon neu auf diesem Gerät), ${(inhalt.klassen || []).length} Klassen, ${(inhalt.listen || []).length} Listen und ${inhalt.fotos.length} Bilder.`;
    document.getElementById('si-vorschau').hidden = false;
  } catch (err) {
    geleseneSicherung = null;
    document.getElementById('si-vorschau').hidden = true;
    meldung(err instanceof SyntaxError ? 'Die Datei konnte nicht gelesen werden (keine gültige Sicherung).' : err.message);
  }
}

async function spieleSicherungEin(ersetzen) {
  const inhalt = geleseneSicherung;
  if (!inhalt) return;
  if (ersetzen && !(await frage(`Wirklich ALLE Daten auf diesem Gerät (${termine.length} Termine) löschen und durch die Sicherung ersetzen?`, { ja: 'Alles ersetzen', gefahr: true }))) return;

  // Bilder vorher umwandeln, damit die Speicher-Transaktion nicht auf etwas Asynchrones warten muss
  const fotos = inhalt.fotos.map((f) => ({ id: f.id, terminId: f.terminId, art: f.art, erstellt: f.erstellt, ...dataUrlAlsDaten(f.bild) }));

  await new Promise((resolve, reject) => {
    const tx = db.transaction(['termine', 'fotos', 'klassen', 'listen', 'sammlungen'], 'readwrite');
    const tSpeicher = tx.objectStore('termine');
    const fSpeicher = tx.objectStore('fotos');
    const kSpeicher = tx.objectStore('klassen');
    const lSpeicher = tx.objectStore('listen');
    const sSpeicher = tx.objectStore('sammlungen');
    if (ersetzen) {
      tSpeicher.clear();
      fSpeicher.clear();
      kSpeicher.clear();
      lSpeicher.clear();
      sSpeicher.clear();
    }
    for (const k of inhalt.klassen || []) kSpeicher.put(k);
    for (const l of inhalt.listen || []) lSpeicher.put(l);
    for (const s of inhalt.sammlungen || []) sSpeicher.put(s);
    for (const t of inhalt.termine) tSpeicher.put(t);
    for (const f of fotos) fSpeicher.put(f);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Abgebrochen'));
  });

  termine = await ladeAlle();
  klassen = await ladeKlassen();
  listen = await ladeListen();
  sammlungen = await ladeSammlungen();
  zeichne();
  dlgSicherung.close();
  if (typeof wolkeNachImport === "function") wolkeNachImport(ersetzen);
  zeigeToast(ersetzen
    ? `Sicherung eingespielt: ${inhalt.termine.length} Termine, ${fotos.length} Bilder.`
    : `Zusammengeführt: ${inhalt.termine.length} Termine und ${fotos.length} Bilder übernommen bzw. aktualisiert.`);
}

/* ---------- Bedienelemente ---------- */

document.getElementById('btn-sicherung').addEventListener('click', oeffneSicherung);
document.getElementById('si-zu').addEventListener('click', () => dlgSicherung.close());
document.getElementById('si-export').addEventListener('click', erstelleSicherung);
document.getElementById('si-teilen').addEventListener('click', teileSicherung);
document.getElementById('si-laden').addEventListener('click', ladeSicherungHerunter);
document.getElementById('si-import').addEventListener('click', () => {
  const eingabe = document.getElementById('si-datei');
  eingabe.value = '';
  eingabe.click();
});
document.getElementById('si-datei').addEventListener('change', (e) => {
  const datei = e.target.files?.[0];
  if (datei) liesSicherungsdatei(datei);
});
document.getElementById('si-zusammen').addEventListener('click', () => spieleSicherungEin(false).catch((err) => meldung(err?.message || err)));
document.getElementById('si-ersetzen').addEventListener('click', () => spieleSicherungEin(true).catch((err) => meldung(err?.message || err)));
