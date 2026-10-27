/**
 * So Watt ! — réservation des espaces communs
 * Script à coller dans le Google Sheet « Réservation des espaces communs »
 * (Extensions → Apps Script), puis à déployer en « Application Web ».
 *
 * Il lit les onglets mensuels tels qu'Intermède les tient déjà (un bloc par salle,
 * une ligne de dates par semaine puis Matin / Après-midi / Soir) et :
 *  - GET  ?action=dispo&from=AAAA-MM-JJ&to=AAAA-MM-JJ → créneaux occupés, SANS les noms
 *  - POST {room, date, slot, from, to, who, structure, email, object, external, code}
 *         → écrit « 9h-11h : Structure (Nom) » dans la bonne case, si le créneau est libre.
 *
 * Réglages (Paramètres du projet → Propriétés du script) :
 *  - CODE   : code occupant·e à saisir pour réserver (obligatoire pour écrire)
 *  - NOTIFY : adresse prévenue à chaque réservation (facultatif, ex. zoe.ducrocq@intermede.co)
 */

var MOIS = ['JANVIER','FEVRIER','MARS','AVRIL','MAI','JUIN','JUILLET','AOUT','SEPTEMBRE','OCTOBRE','NOVEMBRE','DECEMBRE'];
var SLOTS = { 'Matin': 'matin', 'Après-midi': 'aprem', 'Apres-midi': 'aprem', 'Soir': 'soir' };
var SLOT_HOURS = { matin: [8, 12], aprem: [13, 18], soir: [18, 22] };

// ---------- lecture ----------

/** Clé de salle à partir de l'en-tête du bloc. */
function roomKey(h) {
  h = String(h || '').trim();
  if (/^Le Foyer/i.test(h)) return 'foyer';
  var m = h.match(/^(?:BUREAU|Salle)\s+(\d{3})/i); if (m) return 's' + m[1];
  if (/^Salle vid[ée]o/i.test(h)) return 'video';
  return null;
}

/** Mois et année d'un onglet « NOVEMBRE 2026 ». */
function sheetMonth(title) {
  var t = String(title).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  var m = t.match(/^([A-Z]+)\s+(\d{4})$/); if (!m) return null;
  var i = MOIS.indexOf(m[1]); return i < 0 ? null : { y: +m[2], m: i };
}

function mondaysOf(y, m) {
  var out = [], d = new Date(Date.UTC(y, m, 1));
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCMonth() === m) { out.push(new Date(d)); d.setUTCDate(d.getUTCDate() + 7); }
  return out;
}
function iso(d) { return d.toISOString().slice(0, 10); }

/**
 * Lit une grille (valeurs affichées) et renvoie les cases :
 * [{room, date:'AAAA-MM-JJ', slot:'matin|aprem|soir', text, r, c}] (r, c : index 0).
 * Semaines : la k-ième ligne de dates (hors « exemple ») = le k-ième lundi du mois.
 */
function parseGrid(values, title) {
  var mo = sheetMonth(title); if (!mo) return [];
  var mondays = mondaysOf(mo.y, mo.m), cells = [];
  var heads = [];
  for (var r = 0; r < values.length; r++) for (var c = 0; c < (values[r] || []).length; c++) {
    var k = roomKey(values[r][c]); if (k) heads.push({ r: r, c: c, key: k });
  }
  heads.forEach(function (h, hi) {
    // fin du bloc : prochain en-tête dans la même colonne, plus bas
    var end = values.length;
    heads.forEach(function (o) { if (o.c === h.c && o.r > h.r && o.r < end) end = o.r; });
    var week = -1, exemple = false;
    for (var r = h.r + 1; r < end; r++) {
      var row = values[r] || [], lab = String(row[h.c] || '').trim();
      if (!lab) {
        // ligne de dates ? (au moins 4 cases numériques ou « exemple »)
        var nums = 0, ex = false;
        for (var j = 1; j <= 7; j++) { var v = String(row[h.c + j] || '').trim(); if (/^\d{1,2}$/.test(v)) nums++; if (/exemple/i.test(v)) ex = true; }
        if (ex) { exemple = true; continue; }
        if (nums >= 4) { exemple = false; week++; }
        continue;
      }
      var slot = SLOTS[lab]; if (!slot || exemple || week < 0 || week >= mondays.length) continue;
      for (var j = 0; j < 7; j++) {
        var d = new Date(mondays[week]); d.setUTCDate(d.getUTCDate() + j);
        var txt = String(row[h.c + 1 + j] || '').trim();
        cells.push({ room: h.key, date: iso(d), slot: slot, text: txt, r: r, c: h.c + 1 + j });
      }
    }
  });
  return cells;
}

/** Plages horaires « 9h-12h », « 9h30 - 17h », « 14H-16H », « 18h21h » contenues dans un texte. */
function ranges(text) {
  var out = [], re = /(\d{1,2})\s*[hH:]\s*(\d{2})?\s*(?:-|–|à|\/|\s)?\s*(\d{1,2})\s*[hH:]\s*(\d{2})?/g, m;
  while ((m = re.exec(text))) {
    var a = +m[1] + (m[2] ? +m[2] / 60 : 0), b = +m[3] + (m[4] ? +m[4] / 60 : 0);
    if (b > a && a >= 6 && b <= 24) out.push([a, b]);
  }
  return out;
}

/** Version publique d'une case : jamais le texte, seulement les plages occupées. */
function publicCell(cell) {
  if (!cell.text) return null;
  var lines = cell.text.split(/\n+/).filter(function (s) { return s.trim(); });
  var rs = [], whole = false;
  lines.forEach(function (l) { var x = ranges(l); if (x.length) rs = rs.concat(x); else whole = true; });
  return { room: cell.room, date: cell.date, slot: cell.slot, ranges: rs, whole: whole };
}

function allCells() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), out = [];
  ss.getSheets().forEach(function (sh) {
    if (!sheetMonth(sh.getName())) return;
    var vals = sh.getDataRange().getDisplayValues();
    parseGrid(vals, sh.getName()).forEach(function (c) { c.sheet = sh.getName(); out.push(c); });
  });
  return out;
}

// ---------- API ----------

function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function doGet(e) {
  var p = (e && e.parameter) || {};
  var from = p.from || '0000', to = p.to || '9999';
  var busy = allCells().filter(function (c) { return c.text && c.date >= from && c.date <= to; }).map(publicCell);
  var months = SpreadsheetApp.getActiveSpreadsheet().getSheets().map(function (s) { return s.getName(); }).filter(sheetMonth);
  return json({ ok: true, updated: new Date().toISOString(), months: months, busy: busy });
}

function doPost(e) {
  var b; try { b = JSON.parse(e.postData.contents); } catch (err) { return json({ ok: false, error: 'Requête illisible.' }); }
  var props = PropertiesService.getScriptProperties();
  var code = props.getProperty('CODE');
  if (!code || String(b.code || '').trim().toLowerCase() !== code.trim().toLowerCase()) return json({ ok: false, error: 'Code occupant·e incorrect.' });
  if (!b.room || !/^\d{4}-\d{2}-\d{2}$/.test(b.date) || !SLOT_HOURS[b.slot]) return json({ ok: false, error: 'Salle, date ou créneau manquant.' });
  var from = +b.from, to = +b.to, lim = SLOT_HOURS[b.slot];
  if (!(to > from) || from < lim[0] - 1 || to > lim[1] + 1) return json({ ok: false, error: 'Horaires hors du créneau.' });
  if (!String(b.structure || b.who || '').trim()) return json({ ok: false, error: 'Indiquez votre structure.' });

  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var cell = allCells().filter(function (c) { return c.room === b.room && c.date === b.date && c.slot === b.slot; })[0];
    if (!cell) return json({ ok: false, error: 'Ce jour n’existe pas encore dans le planning (onglet du mois manquant ?).' });
    var pub = publicCell(cell);
    if (pub) {
      if (pub.whole) return json({ ok: false, error: 'Créneau déjà réservé.' });
      var clash = pub.ranges.some(function (r) { return from < r[1] && to > r[0]; });
      if (clash) return json({ ok: false, error: 'Ces horaires chevauchent une réservation existante.' });
    }
    var h = function (x) { var hh = Math.floor(x), mm = Math.round((x - hh) * 60); return hh + 'h' + (mm ? (mm < 10 ? '0' : '') + mm : ''); };
    var who = String(b.who || '').trim(), st = String(b.structure || '').trim();
    var line = h(from) + '-' + h(to) + ' : ' + (st || who) + (st && who ? ' (' + who + ')' : '') + (b.object ? ' – ' + String(b.object).trim() : '');
    var rng = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(cell.sheet).getRange(cell.r + 1, cell.c + 1);
    rng.setValue(cell.text ? cell.text + '\n' + line : line);
    if (b.external) rng.setNote('Public externe — réservé via la carte le ' + new Date().toLocaleString('fr-FR') + (b.email ? ' · ' + b.email : ''));
    else if (b.email) rng.setNote('Réservé via la carte le ' + new Date().toLocaleString('fr-FR') + ' · ' + b.email);
    var notify = props.getProperty('NOTIFY');
    if (notify) MailApp.sendEmail(notify, 'So Watt ! · réservation ' + b.room + ' le ' + b.date, line + (b.email ? '\nContact : ' + b.email : '') + (b.external ? '\nÉvénement ouvert au public externe.' : ''));
    return json({ ok: true, line: line });
  } finally { lock.releaseLock(); }
}

// Pour Node (tests) — ignoré par Apps Script
if (typeof module !== 'undefined') module.exports = { parseGrid: parseGrid, ranges: ranges, publicCell: publicCell, sheetMonth: sheetMonth, roomKey: roomKey };
