'use strict';

/* ---------- Speicher bei claude.ai (nur im Claude-Artefakt) ----------
   Im Artefakt löscht Safari den Browser-Speicher teils beim Schließen. Deshalb legt die App
   dort jede Änderung zusätzlich im privaten Speicher des Artefakts bei claude.ai ab
   (Pfad data/users/<eigene ID>/…, nur für mich lesbar). Beim Öffnen holt sie alles zurück.
   Der Browser-Speicher (IndexedDB) bleibt der Arbeitsspeicher der App; außerhalb des
   Artefakts (Testserver, später GitHub Pages) passiert hier nichts.

   Aufbau: data/users/<uid>/<ablage>/e/<id> = { k: id, zeit, daten } oder { k, zeit, geloescht: true }
   Fotos: Metadaten in „fotos“, das Bild (Base64) getrennt in data/users/<uid>/bilder/e/<id>,
   damit beim Öffnen nur fehlende Bilder geladen werden. Gelöschtes bleibt als „geloescht“
   stehen, damit ein anderes Gerät es nicht wieder hochlädt. */

const WOLKE_ABLAGEN = ['termine', 'klassen', 'listen', 'sammlungen', 'fotos'];
const WOLKE_MAX_BILD = 240000; // Zeichen Base64; ein Dokument darf höchstens 256 KiB groß sein

let wolke = null;            // { db, uid } sobald verbunden
let wolkeVerbindung = null;  // Promise der Verbindung
let wolkeKette = Promise.resolve(); // Schreibvorgänge nacheinander
let wolkeFehler = null;
let wolkeLetzterAbgleich = 0;

const wolkeSegment = (id) => String(id).replace(/[^A-Za-z0-9_-]/g, (c) => '~' + c.charCodeAt(0).toString(16).padStart(2, '0'));
const wolkeSammlung = (ablage) => wolke.db.doc(`data/users/${wolke.uid}/${ablage}`).collection('e');

// Noch nicht bestätigte Schreibvorgänge („termine|id“), damit ein abgebrochenes Speichern beim nächsten Start nachgeholt wird
function wolkeOffen() {
  try { return new Set(JSON.parse(localStorage.getItem('wolkeOffen') || '[]')); } catch { return new Set(); }
}
function setzeWolkeOffen(menge) {
  try { localStorage.setItem('wolkeOffen', JSON.stringify([...menge])); } catch { /* egal */ }
}
function markiereOffen(schluessel, offen) {
  const m = wolkeOffen();
  if (offen) m.add(schluessel); else m.delete(schluessel);
  setzeWolkeOffen(m);
}

function verbindeWolke() {
  if (!window.claude?.use) return Promise.resolve(null); // kein Artefakt: nichts tun (später erneut prüfen)
  if (!wolkeVerbindung) {
    wolkeVerbindung = (async () => {
      try {
        const [dbApi, userApi] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
        const uid = dbApi && userApi ? await userApi.id() : null;
        if (!dbApi || !uid) return null;
        // Nur-Lesen-Zugang (z. B. als „Betrachter“ geteilt): eigene Daten können nicht gespeichert werden
        const darf = typeof userApi.can === "function" ? await userApi.can("data.write").catch(() => null) : null;
        wolke = { db: dbApi, uid, nurLesen: darf === false };
        zeigeWolkeStatus();
        return wolke;
      } catch {
        return null;
      }
    })();
  }
  return wolkeVerbindung;
}

/* ---------- Anzeige unten auf der Seite ---------- */

function zeigeWolkeStatus(text) {
  const feld = document.getElementById('wolke-status');
  const fuss = document.getElementById('fuss-text');
  if (!feld || !wolke) return;
  if (fuss) fuss.textContent = 'Daten auf diesem Gerät und privat bei claude.ai.';
  feld.hidden = false;
  feld.classList.toggle("fehler", !!wolkeFehler || wolke.nurLesen);
  if (wolke.nurLesen) {
    feld.textContent = "⚠ Du hast für diese App nur Lesezugriff, deine Eingaben werden nicht gespeichert. Bitte den Besitzer, dich als „Mitwirkender“ freizugeben.";
    return;
  }
  feld.textContent = text || (wolkeFehler
    ? `⚠ Nicht bei claude.ai gespeichert (${wolkeFehler}). Bitte eine Datensicherung machen.`
    : '☁ Bei claude.ai gespeichert');
}

/* ---------- Schreiben ---------- */

async function mitWiederholung(f) {
  try {
    return await f();
  } catch (err) {
    if (err?.code !== 'unavailable') throw err;
    await new Promise((r) => setTimeout(r, 800 + Math.random() * 1200));
    return f();
  }
}

function inWarteschlange(schluessel, arbeit) {
  markiereOffen(schluessel, true);
  wolkeKette = wolkeKette.then(async () => {
    const w = await verbindeWolke();
    if (!w || w.nurLesen) { markiereOffen(schluessel, false); return; }
    try {
      await mitWiederholung(arbeit);
      markiereOffen(schluessel, false);
      if (wolkeFehler) { wolkeFehler = null; zeigeWolkeStatus(); }
    } catch (err) {
      wolkeFehler = err?.code === "quota_exceeded" ? "Speicher voll" : err?.code === "invalid_argument" ? "kein Schreibzugriff" : (err?.message || err?.code || 'Fehler');
      zeigeWolkeStatus();
      console.warn('claude.ai-Speicher:', err);
    }
  });
  return wolkeKette;
}

// Base64 aus ArrayBuffer (in Stücken, damit große Bilder den Aufruf-Stapel nicht sprengen)
function alsBase64(puffer) {
  const bytes = new Uint8Array(puffer);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function ausBase64(text) {
  const s = atob(text);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes.buffer;
}

// Bild so weit verkleinern, dass es in ein Dokument passt (fast immer schon der Fall)
async function passendesBild(puffer, typ) {
  let b64 = alsBase64(puffer);
  if (b64.length <= WOLKE_MAX_BILD) return { b: b64, typ };
  const bild = await createImageBitmap(new Blob([puffer], { type: typ }));
  let faktor = 1;
  let qualitaet = 0.6;
  while (b64.length > WOLKE_MAX_BILD && faktor > 0.2) {
    faktor *= 0.8;
    const c = document.createElement('canvas');
    c.width = Math.round(bild.width * faktor);
    c.height = Math.round(bild.height * faktor);
    c.getContext('2d').drawImage(bild, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', qualitaet));
    b64 = alsBase64(await blob.arrayBuffer());
    qualitaet = Math.max(0.4, qualitaet - 0.05);
  }
  return { b: b64, typ: 'image/jpeg' };
}

// Aufruf nach jedem lokalen Speichern (app.js)
function wolkeMerke(ablage, obj) {
  if (!window.claude?.use || !obj?.id) return;
  const schluessel = `${ablage}|${obj.id}`;
  if (ablage === 'fotos') {
    const { bild, bildDaten, bildTyp, ...meta } = obj;
    inWarteschlange(schluessel, async () => {
      const puffer = bildDaten || (bild instanceof Blob ? await bild.arrayBuffer() : null);
      if (puffer) {
        const inhalt = await passendesBild(puffer, bildTyp || bild?.type || 'image/jpeg');
        await wolkeSammlung('bilder').doc(wolkeSegment(obj.id)).set({ k: obj.id, zeit: Date.now(), ...inhalt });
      }
      await wolkeSammlung('fotos').doc(wolkeSegment(obj.id)).set({ k: obj.id, zeit: Date.now(), daten: meta });
    });
    return;
  }
  const daten = JSON.parse(JSON.stringify(obj)); // nur reines JSON
  if (ablage === 'klassen') {
    if (daten.geteilt) wolkeCodes.set(daten.id, daten.geteilt); else wolkeCodes.delete(daten.id);
  }
  if (ablage === 'listen') {
    const code = geteiltCodeFuer(daten.klasseId);
    if (code) { inWarteschlange(schluessel, () => schreibeGeteilteListe(code, daten)); return; } // nur im gemeinsamen Bereich
  }
  inWarteschlange(schluessel, async () => {
    await wolkeSammlung(ablage).doc(wolkeSegment(obj.id)).set({ k: obj.id, zeit: Date.now(), daten });
    // Geteilte Klasse: Name, Fächer und Schülerliste auch im gemeinsamen Bereich
    if (ablage === 'klassen' && daten.geteilt) await geteiltDoc(daten.geteilt).set({ k: daten.id, zeit: Date.now(), daten });
  });
}

// Aufruf nach jedem lokalen Löschen (app.js)
function wolkeVergiss(ablage, id) {
  if (!window.claude?.use || !id) return;
  const geteilt = ablage === 'listen' ? geteiltStand.get(id) : null; // Liste einer geteilten Klasse: für beide löschen
  if (geteilt) geteiltStand.delete(id);
  inWarteschlange(`${ablage}|${id}`, async () => {
    if (geteilt) await geteiltListen(geteilt.code).doc(wolkeSegment(id)).set({ k: id, zeit: Date.now(), geloescht: true });
    await wolkeSammlung(ablage).doc(wolkeSegment(id)).set({ k: id, zeit: Date.now(), geloescht: true });
    if (ablage === 'fotos') await wolkeSammlung('bilder').doc(wolkeSegment(id)).delete();
  });
}

/* ---------- Lesen und Abgleichen ---------- */

// Alle Dokumente einer Ablage, seitenweise nach Schlüssel
async function wolkeAlle(ablage) {
  return alleAus(wolkeSammlung(ablage));
}
async function alleAus(sammlung) {
  const alle = [];
  let letzter = null;
  for (;;) {
    let q = sammlung.orderBy('k');
    if (letzter !== null) q = q.where('k', '>', letzter);
    const snap = await mitWiederholung(() => q.limit(500).get());
    for (const d of snap.docs) if (d.exists) alle.push(d.data());
    if (snap.size < 500) return alle;
    letzter = snap.docs[snap.docs.length - 1].data().k;
  }
}

const lokaleAblage = (name, modus) => db.transaction(name, modus).objectStore(name);

// Beim Öffnen: Daten von claude.ai holen, nur lokal Vorhandenes hochladen. Gibt true zurück, wenn sich lokal etwas geändert hat.
async function wolkeAbgleich() {
  if (!(await verbindeWolke())) return false;
  zeigeWolkeStatus('☁ Gleiche mit claude.ai ab …');
  await wolkeKette; // erst eigene ausstehende Schreibvorgänge abwarten
  const offen = wolkeOffen();
  let geaendert = false;
  try {
    for (const ablage of WOLKE_ABLAGEN) {
      const entfernt = await wolkeAlle(ablage);
      const lokal = await anfrage(lokaleAblage(ablage, 'readonly').getAll());
      const lokalNachId = new Map(lokal.map((o) => [o.id, o]));
      const wolkeIds = new Set();
      for (const e of entfernt) {
        wolkeIds.add(e.k);
        if (ablage === 'listen' && geteiltCodeFuer(e.daten?.klasseId)) continue; // kommt aus dem gemeinsamen Bereich
        if (offen.has(`${ablage}|${e.k}`)) continue; // lokale Änderung ist neuer und wird gleich hochgeladen
        const hier = lokalNachId.get(e.k);
        if (e.geloescht) {
          if (hier) { await anfrage(lokaleAblage(ablage, 'readwrite').delete(e.k)); geaendert = true; }
          continue;
        }
        if (ablage === 'fotos') {
          if (hier) continue; // Fotos ändern sich nicht
          const bildDoc = await mitWiederholung(() => wolkeSammlung('bilder').doc(wolkeSegment(e.k)).get());
          if (!bildDoc.exists) continue;
          const { b, typ } = bildDoc.data();
          await anfrage(lokaleAblage('fotos', 'readwrite').put({ ...e.daten, bildDaten: ausBase64(b), bildTyp: typ || 'image/jpeg' }));
          geaendert = true;
          continue;
        }
        if (!hier || JSON.stringify(hier) !== JSON.stringify(e.daten)) {
          await anfrage(lokaleAblage(ablage, 'readwrite').put(e.daten));
          geaendert = true;
        }
      }
      // Nur auf diesem Gerät vorhanden (z. B. vor dieser Version angelegt): hochladen
      for (const o of lokal) {
        if (ablage === 'listen' && geteiltCodeFuer(o.klasseId)) continue; // gleicht gleicheGeteiltAb() ab
        if (!wolkeIds.has(o.id) || offen.has(`${ablage}|${o.id}`)) wolkeMerke(ablage, o);
      }
      if (ablage === 'klassen') {
        const jetzt = await anfrage(lokaleAblage('klassen', 'readonly').getAll());
        wolkeCodes = new Map(jetzt.filter((k) => k.geteilt).map((k) => [k.id, k.geteilt]));
      }
    }
    // Geteilte Klassen: Stand aus dem gemeinsamen Bereich holen und ab jetzt live mithören
    for (const [klasseId, code] of [...wolkeCodes]) {
      if (await gleicheGeteiltAb(code, klasseId, offen)) geaendert = true;
    }
    // Ausstehende Löschungen nachholen
    for (const s of offen) {
      const [ablage, id] = s.split('|');
      const noch = await anfrage(lokaleAblage(ablage, 'readonly').get(id));
      if (!noch) wolkeVergiss(ablage, id);
    }
    wolkeLetzterAbgleich = Date.now();
    await wolkeKette;
    if (!wolkeFehler) zeigeWolkeStatus();
  } catch (err) {
    wolkeFehler = err?.message || err?.code || 'nicht erreichbar';
    zeigeWolkeStatus();
    console.warn('claude.ai-Abgleich:', err);
  }
  return geaendert;
}

/* ---------- Geteilte Klassen (Teilen-Code) ----------
   Eine geteilte Klasse liegt mit Schülerliste und Listen in einem gemeinsamen Bereich
   geteilt/<code> (Klasse) und geteilt/<code>/listen/<id> (Listen). Wer den Code kennt und die
   App als „Mitwirkender“ öffnen darf, liest und bearbeitet ihn. Tadel, Blätter und Sammlungen
   bleiben privat. Haken werden zellenweise zusammengeführt, damit zwei Personen gleichzeitig
   in derselben Liste abhaken können. */

let wolkeCodes = new Map();   // klasseId -> Code
const geteiltStand = new Map(); // listeId -> { code, daten } (zuletzt bekannter gemeinsamer Stand)
const geteiltAbos = new Map();  // Code -> [abbestellen, …]
let zeichnenGeplant = null;

const geteiltDoc = (code) => wolke.db.doc(`geteilt/${code}`);
const geteiltListen = (code) => geteiltDoc(code).collection('listen');
const CODE_ZEICHEN = 'abcdefghjkmnpqrstuvwxyz23456789'; // ohne leicht verwechselbare Zeichen (l, i, o, 0, 1)
const codeAnzeige = (c) => c.toUpperCase().match(/.{1,4}/g).join('-');
const codeNormal = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function neuerTeilenCode() {
  const zahlen = crypto.getRandomValues(new Uint8Array(20));
  return [...zahlen].map((z) => CODE_ZEICHEN[z % CODE_ZEICHEN.length]).join('');
}

function geteiltCodeFuer(klasseId) {
  return wolkeCodes.get(klasseId) || klassen.find((k) => k.id === klasseId)?.geteilt || null;
}

// Im gemeinsamen Bereich gelöschte Zellen kommen als null zurück
function bereinigeListe(l) {
  const werte = {};
  for (const [sid, zeile] of Object.entries(l.werte || {})) {
    const z = {};
    for (const [sp, w] of Object.entries(zeile || {})) if (w != null && w !== '') z[sp] = w;
    if (Object.keys(z).length) werte[sid] = z;
  }
  return { ...l, werte };
}

// Nur das Geänderte schreiben (einzelne Zellen), sonst überschreibt man die Haken der Kollegin
async function schreibeGeteilteListe(code, l) {
  const ref = geteiltListen(code).doc(wolkeSegment(l.id));
  const vorher = geteiltStand.get(l.id)?.daten;
  if (vorher) {
    const patch = {};
    for (const feld of new Set([...Object.keys(vorher), ...Object.keys(l)])) {
      if (feld !== 'werte' && JSON.stringify(vorher[feld]) !== JSON.stringify(l[feld])) patch[feld] = l[feld] ?? null;
    }
    const a = vorher.werte || {};
    const b = l.werte || {};
    const werte = {};
    for (const sid of new Set([...Object.keys(a), ...Object.keys(b)])) {
      for (const sp of new Set([...Object.keys(a[sid] || {}), ...Object.keys(b[sid] || {})])) {
        const neu = b[sid]?.[sp];
        if (JSON.stringify(a[sid]?.[sp]) !== JSON.stringify(neu)) (werte[sid] ||= {})[sp] = neu ?? null;
      }
    }
    if (Object.keys(werte).length) patch.werte = werte;
    geteiltStand.set(l.id, { code, daten: l });
    if (!Object.keys(patch).length) return;
    try {
      await ref.update({ zeit: Date.now(), daten: patch });
      return;
    } catch (err) {
      if (err?.code !== 'invalid_argument') throw err; // Dokument fehlt: ganz schreiben
    }
  }
  await ref.set({ k: l.id, zeit: Date.now(), daten: l });
  geteiltStand.set(l.id, { code, daten: l });
}

function planeZeichnen() {
  clearTimeout(zeichnenGeplant);
  zeichnenGeplant = setTimeout(async () => {
    klassen = await ladeKlassen();
    listen = await ladeListen();
    zeichne();
  }, 250);
}

// Eine Liste aus dem gemeinsamen Bereich lokal übernehmen. Gibt true zurück, wenn sich etwas geändert hat.
async function uebernimmGeteilteListe(code, e) {
  if (wolkeOffen().has(`listen|${e.k}`)) return false; // eigene Änderung ist unterwegs
  const hier = await anfrage(lokaleAblage('listen', 'readonly').get(e.k));
  if (e.geloescht) {
    geteiltStand.delete(e.k);
    if (!hier) return false;
    await anfrage(lokaleAblage('listen', 'readwrite').delete(e.k));
    return true;
  }
  const daten = bereinigeListe(e.daten);
  geteiltStand.set(e.k, { code, daten });
  if (hier && JSON.stringify(hier) === JSON.stringify(daten)) return false;
  await anfrage(lokaleAblage('listen', 'readwrite').put(daten));
  return true;
}

async function uebernimmGeteilteKlasse(code, klasseId, d) {
  if (!d || d.geloescht) { await geteiltBeendet(code, klasseId); return true; }
  const hier = await anfrage(lokaleAblage('klassen', 'readonly').get(klasseId));
  if (!hier?.geteilt) return false; // inzwischen verlassen
  if (JSON.stringify(hier) === JSON.stringify(d.daten)) return false;
  await anfrage(lokaleAblage('klassen', 'readwrite').put(d.daten));
  return true;
}

async function gleicheGeteiltAb(code, klasseId, offen = wolkeOffen()) {
  let geaendert = false;
  const kd = await mitWiederholung(() => geteiltDoc(code).get());
  if (!offen.has(`klassen|${klasseId}`) && (await uebernimmGeteilteKlasse(code, klasseId, kd.exists ? kd.data() : null))) geaendert = true;
  if (!wolkeCodes.has(klasseId)) return geaendert; // Teilen wurde beendet
  const entfernt = await alleAus(geteiltListen(code));
  const ids = new Set();
  for (const e of entfernt) {
    ids.add(e.k);
    if (await uebernimmGeteilteListe(code, e)) geaendert = true;
  }
  // Auf diesem Gerät neu angelegt, aber noch nicht im gemeinsamen Bereich
  const lokal = (await anfrage(lokaleAblage('listen', 'readonly').getAll())).filter((l) => l.klasseId === klasseId);
  for (const l of lokal) if (!ids.has(l.id)) wolkeMerke('listen', l);
  abonniereGeteilt(code, klasseId);
  return geaendert;
}

// Live mithören: Änderungen der Kollegin erscheinen nach wenigen Sekunden
function abonniereGeteilt(code, klasseId) {
  if (geteiltAbos.has(code)) return;
  const fehler = (err) => { console.warn('Geteilte Klasse:', err); geteiltAbos.delete(code); };
  const abo1 = geteiltDoc(code).onSnapshot(async (snap) => {
    if (snap.metadata?.hasPendingWrites || wolkeOffen().has(`klassen|${klasseId}`)) return;
    if (await uebernimmGeteilteKlasse(code, klasseId, snap.exists ? snap.data() : null)) planeZeichnen();
  }, fehler);
  const abo2 = geteiltListen(code).onSnapshot(async (snap) => {
    let geaendert = false;
    for (const ch of snap.docChanges()) {
      if (ch.type === 'removed' || ch.doc.metadata?.hasPendingWrites) continue;
      if (await uebernimmGeteilteListe(code, ch.doc.data())) geaendert = true;
    }
    if (geaendert) planeZeichnen();
  }, fehler);
  geteiltAbos.set(code, [abo1, abo2]);
}

function beendeAbo(code) {
  for (const ab of geteiltAbos.get(code) || []) ab();
  geteiltAbos.delete(code);
}

// Der gemeinsame Bereich ist weg (Teilen beendet). Wer geteilt hat, behält die Klasse; alle anderen verlieren sie.
async function geteiltBeendet(code, klasseId) {
  beendeAbo(code);
  wolkeCodes.delete(klasseId);
  const k = await anfrage(lokaleAblage('klassen', 'readonly').get(klasseId));
  if (!k) return;
  const ihreListen = (await anfrage(lokaleAblage('listen', 'readonly').getAll())).filter((l) => l.klasseId === klasseId);
  for (const l of ihreListen) geteiltStand.delete(l.id);
  if (k.geteiltVon === wolke.uid) {
    const { geteilt, geteiltVon, ...frei } = k;
    await speichereKlasse(frei);
    klassen = await ladeKlassen(); // damit die Listen wieder in den privaten Speicher gehen
    for (const l of ihreListen) wolkeMerke('listen', l);
    return;
  }
  for (const l of ihreListen) await anfrage(lokaleAblage('listen', 'readwrite').delete(l.id));
  await anfrage(lokaleAblage('klassen', 'readwrite').delete(klasseId));
  wolkeVergiss('klassen', klasseId);
  zeigeToast(`Die Klasse ${k.name} wird nicht mehr mit dir geteilt.`);
}

const kannTeilen = () => !!(wolke && !wolke.nurLesen);

// „🔗 Teilen“: Code erzeugen, Klasse und Listen in den gemeinsamen Bereich legen
async function teileKlasse(k) {
  if (!kannTeilen()) { meldung('Teilen geht nur in der App bei claude.ai.'); return; }
  if (!(await frage(`Klasse ${k.name} mit einer Kollegin oder einem Kollegen teilen? Geteilt werden die Schülerliste und alle Listen der Klasse (z. B. Tanzgeld), beide könnt ihr sie bearbeiten. Deine Tadel, Blätter und Sammlungen bleiben privat. Wer den Code hat, sieht die Klasse: Gib ihn nur an die Person weiter, die die Klasse mit dir betreut.`, { ja: 'Code erzeugen' }))) return;
  const code = neuerTeilenCode();
  const neu = { ...k, geteilt: code, geteiltVon: wolke.uid };
  try {
    await geteiltDoc(code).set({ k: k.id, zeit: Date.now(), daten: neu });
  } catch (err) {
    meldung(`Teilen hat nicht geklappt (${err?.message || err?.code || err}).`);
    return;
  }
  await speichereKlasse(neu);
  for (const l of listen.filter((x) => x.klasseId === k.id)) wolkeMerke('listen', l);
  await wolkeKette;
  abonniereGeteilt(code, k.id);
  klassen = await ladeKlassen();
  zeichne();
  await zeigeTeilenCode(neu);
}

async function zeigeTeilenCode(k) {
  const anzeige = codeAnzeige(k.geteilt);
  try { await navigator.clipboard.writeText(anzeige); } catch { /* im Artefakt teils gesperrt */ }
  await eingabe(`Teilen-Code für Klasse ${k.name}. Schick ihn deiner Kollegin, z. B. per Nachricht. Sie tippt in ihrer App im Reiter „Klassenbuch“ oder „Listen“ auf „🔗 Code eingeben“.`, { wert: anzeige });
}

// „🔗 Geteilt“ an einer geteilten Klasse: Code zeigen oder Teilen beenden / verlassen
async function geteiltMenue(k) {
  const meine = k.geteiltVon === wolke?.uid;
  if (meine) {
    if (await frage(`Klasse ${k.name} ist geteilt. Du kannst den Code noch einmal anzeigen oder das Teilen beenden: Dann verliert die andere Person die Klasse und ihre Listen, du behältst alles.`, { ja: 'Code anzeigen', nein: 'Teilen beenden' })) {
      await zeigeTeilenCode(k);
      return;
    }
    if (!(await frage(`Teilen von Klasse ${k.name} wirklich beenden?`, { ja: 'Teilen beenden', gefahr: true }))) return;
  } else if (!(await frage(`Klasse ${k.name} ist mit dir geteilt. Möchtest du sie nicht mehr sehen? Für die andere Person bleibt sie erhalten.`, { ja: 'Klasse entfernen', gefahr: true }))) {
    return;
  }
  await loeseGeteilt(k);
  klassen = await ladeKlassen();
  listen = await ladeListen();
  zeichne();
}

// Teilen beenden (wer geteilt hat) bzw. geteilte Klasse verlassen (alle anderen)
async function loeseGeteilt(k) {
  const code = k.geteilt;
  if (!code) return;
  if (k.geteiltVon === wolke?.uid) {
    beendeAbo(code);
    const ihre = await alleAus(geteiltListen(code));
    await mitWiederholung(() => geteiltDoc(code).set({ k: k.id, zeit: Date.now(), geloescht: true }));
    for (const e of ihre) await geteiltListen(code).doc(wolkeSegment(e.k)).delete();
    await geteiltBeendet(code, k.id);
    zeigeToast(`Klasse ${k.name} wird nicht mehr geteilt.`);
  } else {
    beendeAbo(code);
    wolkeCodes.delete(k.id);
    const ihreListen = listen.filter((l) => l.klasseId === k.id);
    for (const l of ihreListen) { geteiltStand.delete(l.id); await anfrage(lokaleAblage('listen', 'readwrite').delete(l.id)); }
    await anfrage(lokaleAblage('klassen', 'readwrite').delete(k.id));
    wolkeVergiss('klassen', k.id);
    zeigeToast(`Klasse ${k.name} entfernt. Für die andere Person bleibt sie erhalten.`);
  }
}

// „🔗 Code eingeben“: geteilte Klasse übernehmen
async function trittGeteiltBei() {
  if (!kannTeilen()) { meldung('Geteilte Klassen gehen nur in der App bei claude.ai.'); return; }
  const eingegeben = await eingabe('Teilen-Code der Klasse (von deiner Kollegin oder deinem Kollegen):', { platzhalter: 'XXXX-XXXX-XXXX-XXXX-XXXX' });
  const code = codeNormal(eingegeben);
  if (!code) return;
  let d;
  try {
    const snap = await mitWiederholung(() => geteiltDoc(code).get());
    d = snap.exists ? snap.data() : null;
  } catch (err) {
    meldung(`Der Code konnte nicht geprüft werden (${err?.message || err?.code || err}).`);
    return;
  }
  if (!d || d.geloescht || !d.daten) { meldung('Zu diesem Code gibt es keine geteilte Klasse. Bitte den Code prüfen.'); return; }
  const k = d.daten;
  if (klassen.some((x) => x.id === k.id)) { meldung(`Die Klasse ${k.name} hast du schon.`); return; }
  const gleich = klassen.find((x) => klassenSchluessel(x.name) === klassenSchluessel(k.name));
  if (gleich) { meldung(`Du hast schon eine eigene Klasse ${gleich.name}. Bitte benenne sie vorher um (✎ Bearbeiten) oder lösche sie, dann den Code noch einmal eingeben.`); return; }
  await speichereKlasse(k);
  await gleicheGeteiltAb(code, k.id);
  klassen = await ladeKlassen();
  listen = await ladeListen();
  gewaehlteKlasse = k.id;
  lokal('klasse', k.id);
  zeichne();
  zeigeToast(`Klasse ${k.name} übernommen (${k.schueler.length} Schüler, ${listen.filter((l) => l.klasseId === k.id).length} Listen).`);
}

// Nach dem Einspielen einer Sicherung: alles hochladen; bei „Alles ersetzen“ das Übrige bei claude.ai als gelöscht markieren
async function wolkeNachImport(ersetzen) {
  if (!(await verbindeWolke())) return;
  zeigeWolkeStatus('☁ Lade die Sicherung zu claude.ai hoch …');
  for (const ablage of WOLKE_ABLAGEN) {
    const lokal = await anfrage(lokaleAblage(ablage, 'readonly').getAll());
    for (const o of lokal) wolkeMerke(ablage, o);
    if (ersetzen) {
      const ids = new Set(lokal.map((o) => o.id));
      for (const e of await wolkeAlle(ablage)) if (!e.geloescht && !ids.has(e.k)) wolkeVergiss(ablage, e.k);
    }
  }
  await wolkeKette;
  zeigeWolkeStatus();
}

// Nach dem Start und beim Zurückkehren in die App (anderes Gerät könnte etwas geändert haben)
async function wolkeAktualisiere() {
  const geaendert = await wolkeAbgleich();
  if (!wolke) return;
  if (!geaendert) { zeichne(); return; } // zeigt u. a. die Knöpfe zum Teilen
  termine = await ladeAlle();
  klassen = await ladeKlassen();
  listen = await ladeListen();
  sammlungen = await ladeSammlungen();
  zeichne();
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && wolke && db && Date.now() - wolkeLetzterAbgleich > 60000) wolkeAktualisiere();
});
