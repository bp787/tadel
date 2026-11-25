'use strict';

/* ==========================================================================
   Phase 4–7: Tadel-Blatt und Rückantwort per Foto oder Scan (PDF) einlesen
   - Texterkennung lokal im Browser mit Tesseract.js (kein Bild verlässt das Gerät;
     aus dem Netz geladen werden nur das Programm und die deutschen Sprachdaten).
   - Gespeichert wird nur das geschwärzte Bild (Phase 5), nie das Original.
   - Ergebnis: Der Termin-Dialog öffnet sich vorausgefüllt zum Prüfen.
   ========================================================================== */

// Alle Teile der Texterkennung liegen im Ordner vendor/ (das Artefakt darf sie nicht nachladen)
const TESSERACT_URL = 'vendor/tesseract/tesseract.min.js';
const vendorUrl = (pfad) => new URL(pfad, document.baseURI).href;

let tesseractLaden = null;
let ocrWorker = null;
let fotoAbgebrochen = false;

function ladeTesseract() {
  if (window.Tesseract) return Promise.resolve();
  if (!tesseractLaden) {
    tesseractLaden = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = TESSERACT_URL;
      s.onload = resolve;
      s.onerror = () => {
        tesseractLaden = null;
        reject(new Error('Die Texterkennung konnte nicht geladen werden. Besteht eine Internetverbindung?'));
      };
      document.head.append(s);
    });
  }
  return tesseractLaden;
}

function setzeFotoStatus(text, anteil) {
  document.getElementById('foto-status').textContent = text;
  const balken = document.getElementById('foto-fortschritt');
  if (anteil == null) balken.removeAttribute('value');
  else balken.value = anteil;
}

/*
 * Deutsche Sprachdaten bereitlegen.
 * Tesseract liest die Sprachdaten zuerst aus seinem Zwischenspeicher im Browser
 * (IndexedDB „keyval-store“ → „keyval“, Schlüssel „./deu.traineddata“) und lädt sie nur sonst
 * aus dem Netz (Dateiname fest „deu.traineddata.gz“). claude.ai liefert keine .gz-Dateien aus,
 * deshalb liegt die gepackte Datei als „….gz.wasm“ bei und wird hier vorab in den
 * Zwischenspeicher gelegt. Tesseract erkennt das gzip-Format und entpackt selbst.
 */
async function legeSprachdatenBereit() {
  const SCHLUESSEL = './deu.traineddata';
  const oeffne = () => new Promise((resolve, reject) => {
    const r = indexedDB.open('keyval-store', 1);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('keyval')) r.result.createObjectStore('keyval'); };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  let kv;
  try { kv = await oeffne(); } catch { return; } // ohne Zwischenspeicher: Tesseract versucht es selbst
  try {
    const vorhanden = await anfrage(kv.transaction('keyval', 'readonly').objectStore('keyval').get(SCHLUESSEL));
    if (vorhanden) return;
    const antwort = await fetch(vendorUrl('vendor/tesseract/lang/deu.traineddata.gz.wasm'));
    if (!antwort.ok) throw new Error('Die deutschen Sprachdaten für die Texterkennung fehlen.');
    const daten = new Uint8Array(await antwort.arrayBuffer());
    await anfrage(kv.transaction('keyval', 'readwrite').objectStore('keyval').put(daten, SCHLUESSEL));
  } finally {
    kv.close();
  }
}

async function holeWorker() {
  if (ocrWorker) return ocrWorker;
  await ladeTesseract();
  setzeFotoStatus('Texterkennung wird vorbereitet (beim ersten Mal etwas länger) …', null);
  await legeSprachdatenBereit();
  ocrWorker = await Tesseract.createWorker('deu', 1, {
    workerPath: vendorUrl('vendor/tesseract/worker.min.js'),
    corePath: vendorUrl('vendor/tesseract/'),
    langPath: vendorUrl('vendor/tesseract/lang'),
    workerBlobURL: false,
    logger: (m) => {
      if (m.status === 'recognizing text') setzeFotoStatus('Text wird erkannt …', m.progress);
      else if (/load|initializ/i.test(m.status)) setzeFotoStatus('Texterkennung wird vorbereitet (beim ersten Mal etwas länger) …', m.progress);
    },
  });
  return ocrWorker;
}

/* ---------- Phase 7: PDF-Scans (z. B. „Dokumente scannen“ auf dem iPhone) ---------- */

const PDFJS_URL = 'vendor/pdfjs/pdf.min.js';
const PDFJS_WORKER_URL = 'vendor/pdfjs/pdf.worker.min.js';
let pdfLaden = null;

function ladePdfJs() {
  if (window.pdfjsLib) return Promise.resolve();
  if (!pdfLaden) {
    pdfLaden = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = PDFJS_URL;
      s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = vendorUrl(PDFJS_WORKER_URL); resolve(); };
      s.onerror = () => { pdfLaden = null; reject(new Error('PDF-Unterstützung konnte nicht geladen werden. Besteht eine Internetverbindung?')); };
      document.head.append(s);
    });
  }
  return pdfLaden;
}

const istPdf = (datei) => datei.type === 'application/pdf' || /\.pdf$/i.test(datei.name || '');

// Erste Seite eines PDFs als Bild (ca. 2400 px auf der langen Seite)
async function pdfAlsBild(datei) {
  setzeFotoStatus('PDF wird geöffnet …', null);
  await ladePdfJs();
  const pdf = await window.pdfjsLib.getDocument({ data: await datei.arrayBuffer() }).promise;
  const seite = await pdf.getPage(1);
  const basis = seite.getViewport({ scale: 1 });
  const viewport = seite.getViewport({ scale: 2400 / Math.max(basis.width, basis.height) });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await seite.render({ canvasContext: ctx, viewport }).promise;
  pdf.destroy();
  return canvas;
}

async function ladeQuelle(datei) {
  if (istPdf(datei)) return pdfAlsBild(datei);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(img.src); resolve(img); };
    img.onerror = () => reject(new Error('Das Bild konnte nicht geöffnet werden.'));
    img.src = URL.createObjectURL(datei);
  });
}

/* Bild verkleinern und in Graustufen mit mehr Kontrast umwandeln – das hilft der Erkennung */
async function bereiteBildVor(datei) {
  const bild = await ladeQuelle(datei);
  const qBreite = bild.naturalWidth || bild.width;
  const qHoehe = bild.naturalHeight || bild.height;
  const MAX = 2400;
  // Große Fotos verkleinern, kleine Bilder (z. B. verkleinerte Screenshots) vergrößern: kleine Schrift liest Tesseract schlecht
  const faktor = Math.min(MAX / Math.max(qBreite, qHoehe), Math.max(1, 1800 / Math.max(qBreite, qHoehe)));
  const breite = Math.round(qBreite * faktor);
  const hoehe = Math.round(qHoehe * faktor);
  const canvas = document.createElement('canvas');
  canvas.width = breite;
  canvas.height = hoehe;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bild, 0, 0, breite, hoehe);

  // Farbkopie gleicher Größe: daraus wird später das geschwärzte Bild (gleiche Koordinaten wie die Erkennung)
  const farbe = document.createElement('canvas');
  farbe.width = breite;
  farbe.height = hoehe;
  farbe.getContext('2d').drawImage(canvas, 0, 0);

  const daten = ctx.getImageData(0, 0, breite, hoehe);
  const p = daten.data;
  // Graustufen. (Kein globales Kontraststrecken: Bei Blättern mit wenig Text, z. B. Rückantwort
  // oder weißem PDF-Scan, würden die Buchstaben sonst zu Klecksen verdickt.)
  const gesamt = p.length / 4;
  const grau = new Uint8ClampedArray(gesamt);
  let summe = 0;
  for (let i = 0, j = 0; i < p.length; i += 4, j++) {
    grau[j] = p[i] * 0.299 + p[i + 1] * 0.587 + p[i + 2] * 0.114;
    summe += grau[j];
  }
  // Dunkler Hintergrund (z. B. Screenshot im Dunkelmodus, TeacherTool): umkehren, damit die Schrift dunkel wird
  if (summe / gesamt < 110) for (let j = 0; j < gesamt; j++) grau[j] = 255 - grau[j];

  // Schatten ausgleichen: Jeder Punkt wird mit der Helligkeit seiner Umgebung verglichen
  // (adaptive Schwelle nach Bradley). So wird Schrift im Schatten genauso schwarz wie im Licht.
  const integral = new Float64Array((breite + 1) * (hoehe + 1));
  for (let y = 1; y <= hoehe; y++) {
    let zeile = 0;
    for (let x = 1; x <= breite; x++) {
      zeile += grau[(y - 1) * breite + (x - 1)];
      integral[y * (breite + 1) + x] = integral[(y - 1) * (breite + 1) + x] + zeile;
    }
  }
  const r = Math.max(8, Math.round(breite / 32));
  const T = 0.15;
  for (let y = 0; y < hoehe; y++) {
    const y1 = Math.max(0, y - r); const y2 = Math.min(hoehe, y + r + 1);
    for (let x = 0; x < breite; x++) {
      const x1 = Math.max(0, x - r); const x2 = Math.min(breite, x + r + 1);
      const flaeche = (x2 - x1) * (y2 - y1);
      const s = integral[y2 * (breite + 1) + x2] - integral[y1 * (breite + 1) + x2]
        - integral[y2 * (breite + 1) + x1] + integral[y1 * (breite + 1) + x1];
      const j = y * breite + x;
      grau[j] = grau[j] * flaeche < s * (1 - T) ? 0 : 255;
    }
  }

  // Tabellenlinien entfernen: lange schwarze Linien (waagerecht/senkrecht) werden weiß.
  // Sonst hält die Texterkennung die Tabelle für ein Bild und überspringt die Zahlen.
  // Mindestlängen an der langen Bildseite messen, damit Buchstaben (auch bei Querformat-Ausschnitten) nie als Linie gelten
  const minWaag = Math.round(Math.max(breite, hoehe) / 10);
  const minSenk = Math.round(Math.max(breite, hoehe) / 25);
  const weg = new Uint8Array(gesamt);
  for (let y = 0; y < hoehe; y++) {
    let start = -1;
    for (let x = 0; x <= breite; x++) {
      const schwarz = x < breite && grau[y * breite + x] === 0;
      if (schwarz && start < 0) start = x;
      if (!schwarz && start >= 0) {
        if (x - start >= minWaag) for (let k = start; k < x; k++) weg[y * breite + k] = 1;
        start = -1;
      }
    }
  }
  for (let x = 0; x < breite; x++) {
    let start = -1;
    for (let y = 0; y <= hoehe; y++) {
      const schwarz = y < hoehe && grau[y * breite + x] === 0;
      if (schwarz && start < 0) start = y;
      if (!schwarz && start >= 0) {
        if (y - start >= minSenk) for (let k = start; k < y; k++) weg[k * breite + x] = 1;
        start = -1;
      }
    }
  }
  for (let j = 0; j < gesamt; j++) {
    const wert = weg[j] ? 255 : grau[j];
    const i = j * 4;
    p[i] = p[i + 1] = p[i + 2] = wert;
  }
  ctx.putImageData(daten, 0, 0);
  return { ocr: canvas, farbe };
}

/* ---------- Phase 5: Stellen zum Schwärzen finden ---------- */

const normWort = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zß]/g, '');

function abstand(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[a.length][b.length];
}

/*
 * Liefert Rechtecke (in Bildkoordinaten), die geschwärzt werden:
 * - Adresse: Zeilen zwischen „An die Erziehungsberechtigten von“ + Namenszeile und „Sehr geehrte“
 * - Nachname: jedes Vorkommen, bis auf den ersten Buchstaben
 */
function findeSchwaerzungen(data, vollerName, bildBreite) {
  const kaesten = [];
  const info = { adresse: false, nachname: false };
  const zeilen = data.lines || [];
  const woerter = data.words || zeilen.flatMap((z) => z.words || []);
  const rand = 4;
  const kasten = (b) => kaesten.push({ x: b.x0 - rand, y: b.y0 - rand, w: b.x1 - b.x0 + 2 * rand, h: b.y1 - b.y0 + 2 * rand });

  // Wort ab dem 2. Buchstaben schwärzen (Initiale bleibt lesbar)
  const abInitiale = (w) => {
    const zeichenBreite = (w.bbox.x1 - w.bbox.x0) / Math.max(1, w.text.length);
    // Großbuchstaben sind breiter als der Durchschnitt: etwas mehr Platz lassen
    kasten({ x0: w.bbox.x0 + zeichenBreite * 1.2 + rand, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 });
  };
  const istWort = (w) => /\p{L}/u.test(w.text || '');
  let gefundenerNachname = '';

  // Namen nach fester Regel (auch wenn die Erkennung den Namen sonst nicht findet):
  // 1) Zeile nach „An die Erziehungsberechtigten von“: 1. Wort (Vorname) bleibt,
  //    2. Wort (Nachname) bis auf den Anfangsbuchstaben schwarz, weitere Wörter ganz schwarz.
  const start = zeilen.findIndex((z) => /erziehungsberechtigten\s+von/i.test(z.text));
  if (start >= 0) {
    const kopf = zeilen[start].words || [];
    const vonIdx = kopf.findIndex((w) => /^von$/i.test(normWort(w.text)));
    // Name steht meist in der nächsten Zeile, manchmal direkt hinter „von“
    let namensWoerter = vonIdx >= 0 ? kopf.slice(vonIdx + 1).filter(istWort) : [];
    if (!namensWoerter.length && zeilen[start + 1]) namensWoerter = (zeilen[start + 1].words || []).filter(istWort);
    namensWoerter = namensWoerter.filter((w) => w.bbox.x0 < bildBreite * 0.6);
    if (namensWoerter.length >= 2) {
      abInitiale(namensWoerter[1]);
      for (const w of namensWoerter.slice(2)) kasten(w.bbox);
      gefundenerNachname = namensWoerter[1].text.replace(/[^\p{L}-]/gu, '');
      info.nachname = true;
    }
  }
  // 2) Rückantwort „Rückantwort für Vorname Nachname, 05c“: „für“ und Vorname bleiben,
  //    Nachname bis auf den Anfangsbuchstaben schwarz (weitere Namensteile bis zum Komma ganz schwarz).
  for (const z of zeilen) {
    const ws = z.words || [];
    for (let j = 1; j < ws.length; j++) {
      const istFuer = ['fur', 'fiir', 'flir', 'fir'].includes(normWort(ws[j].text));
      if (!istFuer || !/antwort/i.test(normWort(ws[j - 1].text))) continue;
      const rest = ws.slice(j + 1);
      if (rest.length < 2) continue;
      // Endet schon der Vorname mit Komma, gibt es keinen Nachnamen in dieser Zeile
      if (/,/.test(rest[0].text)) continue;
      abInitiale(rest[1]);
      if (!/,/.test(rest[1].text)) {
        for (const w of rest.slice(2, 4)) {
          if (/^\d/.test(w.text)) break; // Klasse wie „05c“ bleibt
          kasten(w.bbox);
          if (/,/.test(w.text)) break;
        }
      }
      if (!gefundenerNachname) gefundenerNachname = rest[1].text.replace(/[^\p{L}-]/gu, '');
      info.nachname = true;
    }
  }

  // Adresse
  if (start >= 0) {
    let ende = zeilen.findIndex((z, i) => i > start && /sehr\s+geehrte/i.test(z.text));
    if (ende < 0 || ende - start > 6) ende = Math.min(zeilen.length, start + 4);
    for (let i = start + 2; i < ende; i++) {
      // Nur der linke Teil der Seite (das Adressfeld), nicht z. B. Klasse oder Datum ganz rechts
      for (const w of zeilen[i].words || []) {
        if (w.bbox.x0 < bildBreite * 0.6 && /\S/.test(w.text)) { kasten(w.bbox); info.adresse = true; }
      }
    }
  }

  // Nachname: jedes weitere Vorkommen auf dem Blatt (z. B. Anrede). Ohne erkannten Namen der Nachname aus den Regeln oben.
  const teile = (vollerName || '').trim().split(/\s+/).length >= 2
    ? vollerName.trim().split(/\s+/)
    : (gefundenerNachname.length >= 2 ? ['', gefundenerNachname] : []);
  if (teile.length >= 2) {
    const nach = normWort(teile[teile.length - 1]);
    for (const w of woerter) {
      const n = normWort(w.text);
      if (!n || nach.length < 2) continue;
      const passt = n === nach
        || (nach.length >= 5 && abstand(n, nach) <= 1)
        || (n.length > nach.length && n.includes(nach));
      if (!passt) continue;
      // Ersten Buchstaben des Nachnamens im Wort finden und dahinter schwärzen
      const text = w.text;
      let pos = text.toLowerCase().indexOf(teile[teile.length - 1].charAt(0).toLowerCase());
      if (n.length > nach.length) pos = text.toLowerCase().lastIndexOf(nach.charAt(0));
      if (pos < 0) pos = 0;
      const zeichenBreite = (w.bbox.x1 - w.bbox.x0) / Math.max(1, text.length);
      // Großbuchstaben sind breiter als der Durchschnitt: etwas mehr Platz lassen, damit die Initiale lesbar bleibt
      kasten({ x0: w.bbox.x0 + (pos + 1) * zeichenBreite * 1.2 + rand, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 });
      info.nachname = true;
    }
  }
  return { kaesten, info };
}

/* ---------- Phase 5: Schwärzen prüfen und von Hand ergänzen ---------- */

function schwaerzenDialog(farbe, kaesten, info, art = 'tadel') {
  const dlgSw = document.getElementById('dlg-schwaerzen');
  const canvas = document.getElementById('sw-canvas');
  canvas.width = farbe.width;
  canvas.height = farbe.height;
  const ctx = canvas.getContext('2d');
  const liste = [...kaesten];
  const vonHand = []; // nur diese lassen sich rückgängig machen
  let ziehen = null;

  const hinweise = [];
  let warnung = !info.nachname;
  if (art === 'tadel') {
    hinweise.push(info.adresse ? '✓ Adresse geschwärzt' : '⚠ Adresse nicht gefunden, bitte von Hand schwärzen');
    warnung ||= !info.adresse;
  }
  hinweise.push(info.nachname ? '✓ Nachname geschwärzt (bis auf den ersten Buchstaben)' : '⚠ Nachname nicht gefunden, bitte von Hand schwärzen');
  if (art === 'rueckantwort') hinweise.push('Die handschriftliche Unterschrift wird nicht automatisch geschwärzt.');
  document.getElementById('sw-titel').textContent = art === 'rueckantwort' ? 'Rückantwort schwärzen' : 'Foto schwärzen';
  const hinweis = document.getElementById('sw-hinweis');
  hinweis.textContent = hinweise.join(' · ');
  hinweis.classList.toggle('warnung', warnung);

  const zeichne = () => {
    ctx.drawImage(farbe, 0, 0);
    ctx.fillStyle = '#000';
    for (const k of liste) ctx.fillRect(k.x, k.y, k.w, k.h);
    if (ziehen?.ende) {
      const k = rechteck(ziehen);
      ctx.fillStyle = 'rgba(0,0,0,.6)';
      ctx.fillRect(k.x, k.y, k.w, k.h);
    }
  };
  const punkt = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * canvas.width, y: ((e.clientY - r.top) / r.height) * canvas.height };
  };
  const rechteck = ({ start, ende }) => ({
    x: Math.min(start.x, ende.x), y: Math.min(start.y, ende.y),
    w: Math.abs(ende.x - start.x), h: Math.abs(ende.y - start.y),
  });

  // Vergrößern: Zeichenfläche breiter als der sichtbare Bereich, der Bereich scrollt.
  // Im Modus „Verschieben“ bewegt der Finger (oder die Maus) den Ausschnitt statt zu schwärzen.
  const flaeche = document.getElementById('sw-flaeche');
  const STUFEN = [1, 1.5, 2, 3, 4];
  let stufe = 0;
  let verschieben = false;
  let schieben = null;
  const setzeZoom = (neu) => {
    neu = Math.max(0, Math.min(STUFEN.length - 1, neu));
    // Mitte des sichtbaren Ausschnitts beibehalten
    const mx = (flaeche.scrollLeft + flaeche.clientWidth / 2) / flaeche.scrollWidth;
    const my = (flaeche.scrollTop + flaeche.clientHeight / 2) / flaeche.scrollHeight;
    stufe = neu;
    canvas.style.width = `${STUFEN[stufe] * 100}%`;
    flaeche.classList.toggle('gezoomt', stufe > 0);
    flaeche.scrollLeft = mx * flaeche.scrollWidth - flaeche.clientWidth / 2;
    flaeche.scrollTop = my * flaeche.scrollHeight - flaeche.clientHeight / 2;
    document.getElementById('sw-stufe').textContent = `${Math.round(STUFEN[stufe] * 100)} %`;
    document.getElementById('sw-kleiner').disabled = stufe === 0;
    document.getElementById('sw-groesser').disabled = stufe === STUFEN.length - 1;
  };
  const setzeModus = (an) => {
    verschieben = an;
    const k = document.getElementById('sw-modus');
    k.setAttribute('aria-pressed', String(an));
    k.textContent = an ? '▇ Schwärzen' : '✋ Verschieben';
    canvas.classList.toggle('verschieben', an);
  };
  document.getElementById('sw-groesser').onclick = () => setzeZoom(stufe + 1);
  document.getElementById('sw-kleiner').onclick = () => setzeZoom(stufe - 1);
  document.getElementById('sw-modus').onclick = () => setzeModus(!verschieben);
  setzeModus(false);

  canvas.onpointerdown = (e) => {
    canvas.setPointerCapture(e.pointerId);
    if (verschieben) {
      schieben = { x: e.clientX, y: e.clientY, l: flaeche.scrollLeft, t: flaeche.scrollTop };
      return;
    }
    ziehen = { start: punkt(e), ende: null };
  };
  canvas.onpointermove = (e) => {
    if (schieben) {
      flaeche.scrollLeft = schieben.l - (e.clientX - schieben.x);
      flaeche.scrollTop = schieben.t - (e.clientY - schieben.y);
      return;
    }
    if (!ziehen) return;
    ziehen.ende = punkt(e);
    zeichne();
  };
  canvas.onpointerup = canvas.onpointercancel = () => {
    if (schieben) { schieben = null; return; }
    if (ziehen?.ende) {
      const k = rechteck(ziehen);
      if (k.w > 6 && k.h > 6) { liste.push(k); vonHand.push(k); }
    }
    ziehen = null;
    zeichne();
  };
  document.getElementById('sw-zurueck').onclick = () => {
    const k = vonHand.pop();
    if (k) liste.splice(liste.indexOf(k), 1);
    zeichne();
  };

  zeichne();
  dlgSw.showModal();
  setzeZoom(0);

  return new Promise((resolve) => {
    const fertig = (wert) => {
      dlgSw.close();
      canvas.onpointerdown = canvas.onpointermove = canvas.onpointerup = canvas.onpointercancel = null;
      resolve(wert);
    };
    document.getElementById('sw-abbrechen').onclick = () => fertig(null);
    dlgSw.oncancel = (e) => { e.preventDefault(); fertig(null); };
    document.getElementById('sw-weiter').onclick = async () => {
      ziehen = null;
      zeichne();
      // Platz sparen: längste Seite max. 1600 px, JPEG. Die Schwärzung ist fest im Bild.
      const MAX = 1600;
      const f = Math.min(1, MAX / Math.max(canvas.width, canvas.height));
      const klein = document.createElement('canvas');
      klein.width = Math.round(canvas.width * f);
      klein.height = Math.round(canvas.height * f);
      klein.getContext('2d').drawImage(canvas, 0, 0, klein.width, klein.height);
      const blob = await new Promise((r) => klein.toBlob(r, 'image/jpeg', 0.65));
      // Ungeschwärzte Daten aus dem Speicher nehmen
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      fertig(blob);
    };
  });
}

/* ---------- Text des Blatts auswerten ---------- */

const z2 = (n) => String(n).padStart(2, '0');

function isoAusDeutsch(t, m, j) {
  const tag = Number(t); const monat = Number(m); const jahr = Number(j);
  if (tag < 1 || tag > 31 || monat < 1 || monat > 12 || jahr < 2000) return '';
  return `${jahr}-${z2(monat)}-${z2(tag)}`;
}

function zeit(h, m) {
  // Die Erkennung liest eine Null manchmal als „O“
  const std = Number(String(h).replace(/O/gi, '0')); const min = Number(String(m).replace(/O/gi, '0'));
  if (!Number.isFinite(std) || !Number.isFinite(min) || std > 23 || min > 59) return '';
  return `${z2(std)}:${z2(min)}`;
}

// Zahlenzeile der Tabelle: typische Lesefehler bei Ziffern ausgleichen (O -> 0, l/I/| -> 1 …)
function zahlenAusZeile(zeile) {
  const tokens = zeile
    .replace(/[|[\]{}()]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((x) => x.replace(/^[Oo]$/, '0').replace(/^[lI!]$/, '1').replace(/^S$/, '5').replace(/^B$/, '8'));
  const zahlen = tokens.filter((x) => /^\d{1,3}$/.test(x));
  if (zahlen.length >= 6 && zahlen.length >= tokens.length * 0.7) return zahlen.slice(0, 7).map(Number);
  return null;
}

function alsArten(zahlen) {
  if (!zahlen) return null;
  const werte = {};
  ARTEN.forEach((a, i) => { werte[a.key] = zahlen[i] ?? 0; });
  return werte;
}

function saeubereName(roh) {
  return roh
    .replace(/[^\p{L}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((w) => w.length > 1 || /\p{Lu}/u.test(w))
    .join(' ');
}

function werteBlattAus(text) {
  const roh = text.replace(/\r/g, '').replace(/[‐‑‒–—]/g, '-');
  const zeilen = roh.split('\n').map((z) => z.trim()).filter(Boolean);
  const flach = zeilen.join('\n');
  const erg = {};

  // Name: Zeile nach „An die Erziehungsberechtigten von“, sonst aus der Rückantwort
  const i = zeilen.findIndex((z) => /erziehungsberechtigten\s+von/i.test(z));
  if (i >= 0 && zeilen[i + 1]) {
    const n = saeubereName(zeilen[i + 1]);
    if (n.split(' ').length >= 2) erg.name = n;
  }
  const rueck = flach.match(/R[üu]ckantwort\s+f[üu]r\s+([^,\n]+?)\s*,\s*(\d{1,2}\s?[a-zA-Z])\b/);
  if (!erg.name && rueck) {
    const n = saeubereName(rueck[1]);
    if (n.split(' ').length >= 2) erg.name = n;
  }

  // Klasse: aus der Rückantwort („…, 05c“) oder eine Zeile, die nur aus der Klasse besteht
  if (rueck) erg.klasse = rueck[2].replace(/\s/g, '').toLowerCase();
  if (!erg.klasse) {
    const k = zeilen.find((z) => /^\d{1,2}\s?[a-zA-Z]$/.test(z));
    if (k) erg.klasse = k.replace(/\s/g, '').toLowerCase();
  }
  if (!erg.klasse) {
    const k = flach.match(/\b(0[5-9]|1[0-3])([a-f])\b/i);
    if (k) erg.klasse = `${k[1]}${k[2].toLowerCase()}`;
  }

  // Datum des Tadels: „Den Tadel vom TT.MM.JJJJ“ (Rückantwort), sonst erstes Datum TT.MM.JJJJ
  const td = flach.match(/Tadel\s+vom\s+(\d{1,2})\.(\d{1,2})\.(20\d{2})\b/i)
    || flach.match(/\b(\d{1,2})\.(\d{1,2})\.(20\d{2})\b/);
  if (td) erg.tadelDatum = isoAusDeutsch(td[1], td[2], td[3]);

  // Reflexionsstunde: „… 07:30 Uhr bis 08:10 Uhr in R0.54 … am 2026-11-20“
  // Raum: „R0.54“; die Erkennung liest die Null nach dem R manchmal als „O“ („RO0.54“, „RO.54“)
  const raumAus = (roh) => roh.replace(/\s/g, '').replace(',', '.').toUpperCase().replace(/^R[O0]+(?=[.\d])/, 'R0');
  const RAUM = 'R\\s?[O0-9][O\\d.,]*\\d';
  const z = flach.match(new RegExp(`(\\d{1,2})[:.](\\d{2})\\s*(?:Uhr)?\\s*bis\\s*(\\d{1,2})[:.](\\d{2})\\s*(?:Uhr)?\\s*in\\s*(${RAUM})`, 'i'));
  if (z) {
    erg.von = zeit(z[1], z[2]);
    erg.bis = zeit(z[3], z[4]);
    erg.raum = raumAus(z[5]);
  }
  // Ist der Satz durch Durchstreichen zerrissen: die ersten beiden Uhrzeiten im Text nehmen
  if (!erg.von) {
    const zeiten = [...flach.matchAll(/\b([01]?\d|2[0-3])[:.]([0-5][\dO])\s*Uhr/gi)];
    if (zeiten[0]) erg.von = zeit(zeiten[0][1], zeiten[0][2]);
    if (zeiten[1]) erg.bis = zeit(zeiten[1][1], zeiten[1][2]);
    if (erg.bis && erg.bis <= erg.von) delete erg.bis;
  }
  if (!erg.raum) {
    const r = flach.match(new RegExp(`\\bin\\s+(${RAUM})`, 'i'));
    if (r) erg.raum = raumAus(r[1]);
  }
  const am = flach.match(/\bam\s+(20\d{2})-(\d{1,2})-(\d{1,2})\b/i)
    || flach.match(/(?:Reflexionsstunde|teilnehmen)[\s\S]{0,120}?(20\d{2})-(\d{1,2})-(\d{1,2})/i);
  if (am) erg.datum = isoAusDeutsch(am[3], am[2], am[1]);
  if (!erg.datum) {
    // Irgendein JJJJ-MM-TT, das nicht zum Zeitraum der Rückantwort („… bis …“) gehört
    const kandidaten = [...flach.matchAll(/(20\d{2})-(\d{1,2})-(\d{1,2})/g)]
      .filter((m) => !/bis\s*$/i.test(flach.slice(Math.max(0, m.index - 6), m.index))
        && !/^\s*bis/i.test(flach.slice(m.index + m[0].length, m.index + m[0].length + 6)));
    if (kandidaten[0]) erg.datum = isoAusDeutsch(kandidaten[0][3], kandidaten[0][2], kandidaten[0][1]);
  }
  if (!erg.datum) {
    const am2 =flach.match(/\bam\s+(\d{1,2})\.(\d{1,2})\.(20\d{2})\b/i);
    if (am2) erg.datum = isoAusDeutsch(am2[1], am2[2], am2[3]);
  }

  // Tabelle: erste Zahlenzeile = vergangene Schulwoche, nächste = „In diesem Halbjahr“
  const hj = zeilen.findIndex((x) => /halbjahr/i.test(x));
  const zahlenZeilen = [];
  zeilen.forEach((x, idx) => {
    const zahlen = zahlenAusZeile(x);
    if (zahlen) zahlenZeilen.push({ idx, zahlen });
  });
  if (hj >= 0) {
    const vorher = zahlenZeilen.filter((x) => x.idx < hj).pop();
    const nachher = zahlenZeilen.find((x) => x.idx > hj);
    if (vorher) erg.woche = alsArten(vorher.zahlen);
    if (nachher) erg.halbjahr = alsArten(nachher.zahlen);
  } else if (zahlenZeilen.length >= 2) {
    erg.woche = alsArten(zahlenZeilen[0].zahlen);
    erg.halbjahr = alsArten(zahlenZeilen[1].zahlen);
  }

  // „folgende 2 Klassenbucheinträge“ – zum Gegenprüfen der Wochen-Zahlen
  const anz = flach.match(/folgende\s+(\d{1,2}|[Il])\s+Klassenbuch/i);
  if (anz) erg.anzahl = /^[Il]$/.test(anz[1]) ? 1 : Number(anz[1]);

  for (const k of Object.keys(erg)) if (erg[k] === '' || erg[k] == null) delete erg[k];
  return erg;
}

/* ---------- Phase 7: Rückantwort einem Termin zuordnen ---------- */

// Passende Termine zuerst: gleicher (gekürzter) Name + Klasse, gleiches Tadel-Datum, noch ohne Rückantwort
function rueckantwortKandidaten(werte) {
  const kurz = werte.name ? kuerzelInKlasse(werte.name, werte.klasse) : '';
  return termine
    .map((t) => {
      let punkte = 0;
      if (kurz && t.name === kurz) punkte += 4;
      else if (kurz && t.name.split(' ')[0] === kurz.split(' ')[0]) punkte += 1;
      if (werte.klasse && t.klasse === werte.klasse) punkte += 2;
      if (werte.tadelDatum && t.tadelDatum === werte.tadelDatum) punkte += 3;
      if (!t.rueckantwortId) punkte += 1;
      if (!t.unterschrieben) punkte += 1;
      return { t, punkte };
    })
    .sort((a, b) => b.punkte - a.punkte || tadelDatumVon(b.t).localeCompare(tadelDatumVon(a.t)));
}

function zuordnenDialog(werte) {
  const dlgZu = document.getElementById('dlg-zuordnen');
  const auswahl = document.getElementById('zu-termin');
  const kandidaten = rueckantwortKandidaten(werte);
  const erkannt = [
    werte.name ? `Name: ${kurzName(werte.name)}` : 'Name nicht erkannt',
    werte.klasse ? `Klasse: ${werte.klasse}` : null,
    werte.tadelDatum ? `Tadel vom ${datumKurz(werte.tadelDatum)}` : null,
  ].filter(Boolean).join(' · ');
  document.getElementById('zu-erkannt').textContent = `Erkannt: ${erkannt}`;
  auswahl.replaceChildren(...kandidaten.map(({ t }) => el('option', { value: t.id },
    `${t.name} (${t.klasse}) · ${t.tadelDatum ? `Tadel ${datumKurz(t.tadelDatum)}` : `Termin ${datumKurz(t.datum)}`}${t.rueckantwortId ? ' · hat schon eine' : ''}`)));
  document.getElementById('zu-abhaken').checked = true;
  dlgZu.showModal();
  return new Promise((resolve) => {
    const fertig = (wert) => { dlgZu.close(); resolve(wert); };
    document.getElementById('zu-abbrechen').onclick = () => fertig(null);
    dlgZu.oncancel = (e) => { e.preventDefault(); fertig(null); };
    document.getElementById('zu-speichern').onclick = () => fertig({
      termin: termine.find((t) => t.id === auswahl.value),
      abhaken: document.getElementById('zu-abhaken').checked,
    });
  });
}

/* ---------- Ablauf ---------- */

let fotoArt = 'tadel';   // 'tadel' oder 'rueckantwort'
let rueckZiel = null;    // Termin-ID, wenn die Rückantwort direkt aus einem Termin eingelesen wird

async function liesFoto(datei) {
  const overlay = document.getElementById('foto-laden');
  const art = fotoArt;
  const ziel = rueckZiel;
  fotoAbgebrochen = false;
  overlay.hidden = false;
  setzeFotoStatus('Bild wird vorbereitet …', null);
  try {
    const { ocr, farbe } = await bereiteBildVor(datei);
    const worker = await holeWorker();
    if (fotoAbgebrochen) return;
    setzeFotoStatus('Text wird erkannt …', 0);
    const { data } = await worker.recognize(ocr);
    if (fotoAbgebrochen) return;
    const werte = werteBlattAus(data.text);
    // Bei einer Rückantwort direkt aus dem Termin ist der Name bekannt, falls die Erkennung ihn nicht findet
    const zielTermin = ziel ? termine.find((t) => t.id === ziel) : null;
    const { kaesten, info } = findeSchwaerzungen(data, werte.name, farbe.width);
    overlay.hidden = true;
    // Phase 5: Schwärzung prüfen/ergänzen; nur das geschwärzte Bild wird weitergegeben
    const fotoBlob = await schwaerzenDialog(farbe, kaesten, info, art);
    farbe.width = farbe.height = 0; // ungeschwärztes Bild verwerfen
    if (!fotoBlob) return;

    if (art === 'tadel') {
      // Vollen Nachnamen nie in den Dialog geben: nur Vorname + Initiale
      oeffneDialog(null, { ...werte, name: werte.name ? kuerzelInKlasse(werte.name, werte.klasse) : '', fotoBlob });
      return;
    }
    // Phase 7: Rückantwort
    if (zielTermin) {
      const neu = await speichereRueckantwort(zielTermin, fotoBlob, true);
      oeffneDialog(neu); // zurück zum Termin, jetzt mit Rückantwort
      return;
    }
    if (!termine.length) { meldung('Es gibt noch keine Termine, zu denen die Rückantwort gehören könnte.'); return; }
    const wahl = await zuordnenDialog(werte);
    if (wahl?.termin) await speichereRueckantwort(wahl.termin, fotoBlob, wahl.abhaken);
  } catch (err) {
    overlay.hidden = true;
    if (!fotoAbgebrochen) meldung(err?.message || String(err));
  }
}

// Fenster „Blatt einlesen“: Was (Tadel-Blatt/Rückantwort) und Woher (Kamera, Mediathek, Dateien).
// Mit terminId kommt der Aufruf aus einem Termin: dann steht „Rückantwort“ fest.
const dlgWahl = document.getElementById('dlg-foto-wahl');
const QUELLEN = { kamera: 'foto-kamera', mediathek: 'foto-mediathek', datei: 'foto-datei' };

function setzeWahlArt(art) {
  fotoArt = art;
  document.querySelectorAll('.wahl-art-knopf').forEach((k) =>
    k.setAttribute('aria-pressed', String(k.dataset.art === art)));
}

function starteFotoEingabe(art = 'tadel', terminId = null) {
  setzeWahlArt(art);
  rueckZiel = terminId;
  document.getElementById('wahl-art-block').hidden = !!terminId;
  document.getElementById('wahl-titel').textContent = terminId ? 'Rückantwort einlesen' : 'Blatt einlesen';
  dlgWahl.showModal();
}

// Datei aus beliebiger Quelle (Auswahl, Ziehen, Einfügen) prüfen und einlesen
function nimmDatei(datei) {
  if (!datei) return;
  const ok = /^image\//.test(datei.type) || istPdf(datei) || /\.(heic|heif|jpe?g|png|webp|gif|bmp|tiff?)$/i.test(datei.name || '');
  if (!ok) { meldung(`„${datei.name || 'Diese Datei'}“ ist kein Bild und kein PDF. Bitte ein Foto (JPG, PNG, HEIC) oder einen PDF-Scan wählen.`); return; }
  liesFoto(datei);
}

document.getElementById('btn-foto').addEventListener('click', () => starteFotoEingabe('tadel'));
document.getElementById('wahl-abbrechen').addEventListener('click', () => dlgWahl.close());
document.querySelectorAll('.wahl-art-knopf').forEach((k) => k.addEventListener('click', () => setzeWahlArt(k.dataset.art)));
document.querySelectorAll('.wahl-knopf').forEach((k) => k.addEventListener('click', () => {
  dlgWahl.close();
  const eingabe = document.getElementById(QUELLEN[k.dataset.quelle]);
  eingabe.value = '';
  eingabe.click();
}));
document.querySelectorAll('.foto-eingabe').forEach((eingabe) => eingabe.addEventListener('change', (e) => {
  nimmDatei(e.target.files?.[0]);
}));

// Ziehen & Ablegen (PC, iPad mit geteiltem Bildschirm) und Einfügen aus der Zwischenablage.
// Ohne vorherige Auswahl gilt „Tadel-Blatt“; ist das Auswahlfenster offen, gilt die dort gewählte Art.
function bereitFuerFremdeDatei() {
  const offen = [...document.querySelectorAll('dialog[open]')].filter((d) => d !== dlgWahl);
  if (offen.length || !document.getElementById('foto-laden').hidden) return false;
  if (!dlgWahl.open) { setzeWahlArt('tadel'); rueckZiel = null; }
  dlgWahl.close();
  return true;
}
let ziehZaehler = 0;
const hatDatei = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
document.addEventListener('dragenter', (e) => {
  if (!hatDatei(e)) return;
  e.preventDefault();
  if (++ziehZaehler === 1) document.body.classList.add('ziehen');
});
document.addEventListener('dragover', (e) => { if (hatDatei(e)) e.preventDefault(); });
document.addEventListener('dragleave', (e) => {
  if (!hatDatei(e)) return;
  if (--ziehZaehler <= 0) { ziehZaehler = 0; document.body.classList.remove('ziehen'); }
});
document.addEventListener('drop', (e) => {
  if (!hatDatei(e)) return;
  e.preventDefault();
  ziehZaehler = 0;
  document.body.classList.remove('ziehen');
  const datei = e.dataTransfer.files?.[0];
  if (datei && bereitFuerFremdeDatei()) nimmDatei(datei);
});
document.addEventListener('paste', (e) => {
  const datei = [...(e.clipboardData?.files || [])][0];
  if (!datei) return; // normaler Text wird ganz normal eingefügt
  if (!bereitFuerFremdeDatei()) return;
  e.preventDefault();
  nimmDatei(datei);
});
document.getElementById('foto-abbrechen').addEventListener('click', () => {
  fotoAbgebrochen = true;
  document.getElementById('foto-laden').hidden = true;
});
